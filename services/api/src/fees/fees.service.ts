import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { formatUsd, isWithinStoreRange, MoneyError, parseUsd, type Usd } from './money.js';
import {
  dominates, overlaps, specificityOf,
  type FeeAssetCategory, type FeeBasis, type FeeConflict, type FeeKind, type FeeOperation,
  type FeeQuery, type FeeRule, type Specificity,
} from './fee-rule.js';
import { resolveBreakdown, toPublicBreakdown, type PublicFeeBreakdown } from './fee-breakdown.js';
import type { CreateFeeRuleDto, ListFeeRulesDto, UpdateFeeRuleDto } from './dto/fee-rule.dto.js';

/** The operator behind a change. From the session, never from the body. */
export interface FeeActor {
  id: string;
  role: string;
}

/** What any caller must state to be given a breakdown. */
export interface FeeBreakdownInput {
  operation: FeeOperation;
  assetId?: string | null;
  assetCategory?: FeeAssetCategory | null;
  providerSlug?: string | null;
  country?: string | null;
  region?: string | null;
  notionalUsd?: string | null;
}

type RuleRow = {
  id: string; operation: string; kind: string; basis: string; label: string;
  rateBps: number | null; fixedUsd: { toString(): string } | null;
  assetId: string | null; assetCategory: string | null; providerSlug: string | null;
  country: string | null; region: string | null;
  minNotionalUsd: { toString(): string } | null; maxNotionalUsd: { toString(): string } | null;
  priority: number; effectiveFrom: Date | null; effectiveUntil: Date | null; active: boolean;
  createdById: string | null; updatedById: string | null; createdAt: Date; updatedAt: Date;
};

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * The itemised breakdown for one operation.
   *
   * §37's whole requirement: "exactly what they are paying before
   * confirmation." One line per fee kind, a total only when every line is
   * real, and no path that folds a fee into a price — the notional is echoed
   * back beside the fees, unchanged, and nothing here accepts or returns a
   * price.
   *
   * `notionalUsd` stays a decimal string in and out. A `number` at either end
   * is a float at the boundary of an otherwise exact calculation.
   */
  async breakdown(input: FeeBreakdownInput): Promise<PublicFeeBreakdown> {
    const query = await this.buildQuery(input);
    const rules = await this.rulesFor(input.operation);
    const result = resolveBreakdown(query, rules, new Date());

    if (result.status === 'conflict') {
      // A conflict is a positive contradiction: two rules claim to govern and
      // neither is more specific. Refusing is the whole point — picking one
      // would charge a real customer one of two rates for no stated reason.
      //
      // The rule ids go to the log and to `diagnostics()`, never to the
      // caller. An internal identifier in a customer-facing error is exactly
      // the detail `AllExceptionsFilter` exists to withhold.
      this.logger.error(
        `Fee rules for ${input.operation} are ambiguous: ${result.conflicts
          .map((c) => `${c.kind}=[${c.ruleIds.join(',')}]`)
          .join(' ')}`,
      );
      throw AppError.feeConfigurationInvalid(
        'The fee for this operation cannot be stated: more than one fee rule applies and none of them takes precedence. Correnthian will not guess a fee. Our team has been notified.',
      );
    }

    return toPublicBreakdown(result.breakdown);
  }

  /**
   * Resolve an asset's category from the registry.
   *
   * The caller names an asset; a rule may be written against its category. The
   * join lives here so a caller that passes a category itself — the swap
   * engine, which has already read the row — does not pay for a second query.
   */
  async categoryOf(assetId: string): Promise<FeeAssetCategory | null> {
    const row = await this.prisma.asset.findUnique({
      where: { assetId },
      select: { category: true },
    });
    return row ? (row.category as FeeAssetCategory) : null;
  }

  /**
   * Parse and validate a notional, refusing malformed money before it resolves.
   *
   * Out of range is refused here rather than at the database: `Decimal(36, 8)`
   * holds 28 digits before the point, and a longer amount would fail as a
   * Prisma error mapped to a 500 instead of a 400 naming the field.
   */
  parseNotional(notionalUsd: string | null | undefined): Usd | null {
    if (notionalUsd === null || notionalUsd === undefined || notionalUsd === '') return null;
    try {
      const units = parseUsd(notionalUsd);
      if (!isWithinStoreRange(units)) {
        throw new MoneyError('Amount is larger than an exact USD amount can store');
      }
      return units;
    } catch (cause) {
      throw AppError.badRequest(cause instanceof MoneyError ? cause.message : 'notionalUsd is not a valid amount');
    }
  }

  // --- admin: reading the rules ---------------------------------------------

  /**
   * The rule table, for an operator.
   *
   * Read is gated `admin` and write is gated `owner` — deliberately different
   * requirements. Reading the rate table answers "how is everybody priced?";
   * changing it re-prices every subsequent quote. A surface that grants both
   * for one permission has decided those are the same trust, and they are not.
   */
  async listRules(query: ListFeeRulesDto) {
    const rows = await this.prisma.feeRule.findMany({
      where: {
        ...(query.operation ? { operation: query.operation } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.active !== undefined ? { active: query.active } : {}),
      },
      orderBy: [{ operation: 'asc' }, { kind: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
      take: Math.min(query.limit, 200),
      select: RULE_SELECT,
    });
    return rows.map((r) => this.presentRule(r));
  }

  /**
   * One rule, for the operator's edit form.
   *
   * A not-found is a not-found and nothing more. This route is gated like the
   * list, so a 404 here is not an existence oracle for anyone who could not
   * already read every row.
   */
  async findRule(id: string) {
    const row = await this.prisma.feeRule.findUnique({ where: { id }, select: RULE_SELECT });
    if (!row) throw AppError.notFound('Fee rule not found');
    return this.presentRule(row);
  }

  /**
   * Conflicts, before a customer finds one.
   *
   * Two rules that can both apply to one operation and kind and neither of
   * which dominates the other. The resolver refuses these; this route exists
   * so an operator sees the same set without having to construct the query
   * that trips it.
   *
   * Pairwise rather than exhaustive: it reports the pairs, not every
   * combination of them, because an operator fixes rules and a list of
   * overlapping pairs is the actionable form.
   */
  async diagnostics() {
    const rows = await this.prisma.feeRule.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      select: RULE_SELECT,
    });
    const rules = rows.map(toDomainRule);

    const conflicts: Array<FeeConflict & { specificity: Record<string, Specificity> }> = [];
    for (let i = 0; i < rules.length; i += 1) {
      for (let j = i + 1; j < rules.length; j += 1) {
        const a = rules[i];
        const b = rules[j];
        if (!a || !b) continue;
        // Unequal priority is already resolved by the resolver, so it is not a
        // conflict. Reporting it would be noise that trains an operator to
        // ignore the list.
        if (a.priority !== b.priority) continue;
        if (!overlaps(a, b)) continue;
        if (dominates(a, b) || dominates(b, a)) continue;
        conflicts.push({
          operation: a.operation,
          kind: a.kind,
          ruleIds: [a.id, b.id].sort(),
          detail:
            `Two ${a.kind} fee rules for ${a.operation} can both apply and neither takes ` +
            `precedence. Set "priority" on the one that should win.`,
          specificity: { [a.id]: specificityOf(a), [b.id]: specificityOf(b) },
        });
      }
    }

    return {
      ruleCount: rules.length,
      conflicts,
      clear: conflicts.length === 0,
      note:
        'Every kind not listed is reported as unknown on a quote, not as zero. ' +
        'A rule that is absent is not a fee of nothing.',
    };
  }

  // --- admin: changing the rules --------------------------------------------

  async createRule(dto: CreateFeeRuleDto, actor: FeeActor) {
    const rowInput = this.toRowInput(dto);
    this.assertBasisConsistency(dto.basis, rowInput.rateBps, rowInput.fixedUsd);
    // A fixed rule never stores a rate, whatever the request carried.
    if (dto.basis === 'fixed') delete rowInput.rateBps;

    const rule = await this.prisma.feeRule.create({
      data: {
        ...rowInput,
        // The four required columns come straight off the validated DTO, so
        // the compiler can see they are present. Spreading a loose record into
        // a Prisma write would hide a missing one until runtime — and DEF-002
        // is a reminder that Prisma's generated inputs defeat excess-property
        // checks, so nothing downstream would catch it either.
        operation: dto.operation,
        kind: dto.kind,
        basis: dto.basis,
        label: dto.label,
        active: dto.active,
        priority: dto.priority,
        createdById: actor.id,
        updatedById: actor.id,
      },
      select: RULE_SELECT,
    });

    await this.audit.recordChange({
      action: 'feeRule.created',
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'FeeRule',
      targetId: rule.id,
      // A create is destructive in the sense §55 means: from this moment on,
      // every quote is priced by it. So it owes a reason, and `recordChange`
      // with `destructive: true` is what makes that non-optional rather than a
      // habit. `@RequireAuditReason` on the route rejects the request before
      // the write; this is the second gate, for any caller that reaches here
      // by another path.
      destructive: true,
      after: rule,
    });

    return this.presentRule(rule);
  }

  async updateRule(id: string, dto: UpdateFeeRuleDto, actor: FeeActor) {
    const before = await this.prisma.feeRule.findUnique({ where: { id }, select: RULE_SELECT });
    if (!before) throw AppError.notFound('Fee rule not found');

    // Omission leaves a field alone; `null` clears it. Collapsing the two
    // would make it impossible to widen a rule back out, which is the
    // direction an operator actually needs — see the DTO's note.
    //
    // `toRowInput` already carries that distinction for every column it maps.
    const data: RuleWrite = { ...this.toRowInput(dto), updatedById: actor.id };
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.priority !== undefined) data.priority = dto.priority;

    // Consistency is checked against what the row would say after this write,
    // not against the patch alone: a patch that sets only `rateBps` on a fixed
    // rule would otherwise leave a row with both.
    const basis = dto.basis ?? before.basis;
    const rateBps = dto.rateBps !== undefined ? dto.rateBps : before.rateBps;
    const fixedUsd = 'fixedUsd' in dto ? (dto.fixedUsd ?? null) : (before.fixedUsd ?? null);
    this.assertBasisConsistency(basis as FeeBasis, rateBps, fixedUsd);
    if (basis === 'fixed') delete data.rateBps;

    const after = await this.prisma.feeRule.update({ where: { id }, data, select: RULE_SELECT });

    const change = await this.audit.recordChange({
      action: 'feeRule.changed',
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'FeeRule',
      targetId: id,
      // Not derived from the action name — `changed` is deliberately not a
      // destructive verb, because a generic rule would fire on ordinary work
      // and a rule that fires on ordinary work gets waived. A fee rate is not
      // ordinary work, so this one opts in by name.
      destructive: true,
      before,
      after,
      fields: [
        'rateBps', 'fixedUsd', 'assetId', 'assetCategory', 'providerSlug', 'country', 'region',
        'minNotionalUsd', 'maxNotionalUsd', 'priority', 'effectiveFrom', 'effectiveUntil',
        'active', 'operation', 'kind', 'basis', 'label',
      ],
    });

    // A change that rewrites the rate is the one that has to be noticed.
    if (change.changed.includes('rateBps') || change.changed.includes('fixedUsd')) {
      this.logger.warn(
        `Fee rate changed on rule ${id} (${before.kind}/${before.operation}): ` +
          `${presentAmount(before)} -> ${presentAmount(after)}`,
      );
    }

    return this.presentRule(after);
  }

  // --- internals -------------------------------------------------------------

  private async buildQuery(input: FeeBreakdownInput): Promise<FeeQuery> {
    const assetId = input.assetId ?? null;
    // A caller that named an asset gets its category resolved here, so a rule
    // written against `metal` matches a query that named a gold token.
    const assetCategory = input.assetCategory ?? (assetId ? await this.categoryOf(assetId) : null);

    return {
      operation: input.operation,
      assetId,
      assetCategory,
      providerSlug: input.providerSlug ?? null,
      country: input.country ? input.country.toUpperCase() : null,
      region: input.region ?? null,
      notional: this.parseNotional(input.notionalUsd),
    };
  }

  private async rulesFor(operation: FeeOperation): Promise<FeeRule[]> {
    const rows = await this.prisma.feeRule.findMany({
      where: { operation, active: true },
      orderBy: { createdAt: 'asc' },
      select: RULE_SELECT,
    });
    return rows.map(toDomainRule);
  }

  /**
   * Map validated input onto a row.
   *
   * Pure mapping. Omission means "leave alone" and `null` means "clear", and
   * the two are never collapsed — see the DTO's note.
   *
   * Returns a typed shape rather than a `Record<string, unknown>`. Prisma's
   * generated inputs are `XOR` unions, which defeat the excess-property check,
   * so a typo'd column in a loose object is invisible to `tsc` and to the
   * runtime until Postgres rejects it — DEF-002 shipped that way.
   */
  private toRowInput(dto: CreateFeeRuleDto | UpdateFeeRuleDto): RuleWrite {
    const out: RuleWrite = {};

    if (dto.operation !== undefined) out.operation = dto.operation;
    if (dto.kind !== undefined) out.kind = dto.kind;
    if (dto.basis !== undefined) out.basis = dto.basis;
    if (dto.label !== undefined) out.label = dto.label;
    if (dto.assetId !== undefined) out.assetId = dto.assetId ?? null;
    if (dto.assetCategory !== undefined) out.assetCategory = dto.assetCategory ?? null;
    if (dto.providerSlug !== undefined) out.providerSlug = dto.providerSlug ?? null;
    if (dto.country !== undefined) out.country = dto.country ?? null;
    if (dto.region !== undefined) out.region = dto.region ?? null;
    if (dto.effectiveFrom !== undefined) out.effectiveFrom = dto.effectiveFrom ?? null;
    if (dto.effectiveUntil !== undefined) out.effectiveUntil = dto.effectiveUntil ?? null;
    if (dto.rateBps !== undefined) out.rateBps = dto.rateBps ?? null;

    // Amounts go in as strings so Prisma sends a decimal literal. Passing a
    // float here would defeat the exactness `money.ts` establishes.
    const fixedUsd = this.amountOrNull('fixedUsd', dto.fixedUsd);
    const minNotionalUsd = this.amountOrNull('minNotionalUsd', dto.minNotionalUsd);
    const maxNotionalUsd = this.amountOrNull('maxNotionalUsd', dto.maxNotionalUsd);
    if (fixedUsd !== undefined) out.fixedUsd = fixedUsd;
    if (minNotionalUsd !== undefined) out.minNotionalUsd = minNotionalUsd;
    if (maxNotionalUsd !== undefined) out.maxNotionalUsd = maxNotionalUsd;

    return out;
  }

  /**
   * A `fixed` rule carries an amount and no rate; a `percent` or `spread` rule
   * carries a rate and no amount. Never both, never neither.
   *
   * Checked against the **merged** state — what this write would leave the row
   * saying — not against the patch alone. A patch that sets only `rateBps` on
   * a fixed rule would otherwise pass a check that looked at the patch and
   * leave a row with both.
   */
  private assertBasisConsistency(
    basis: FeeBasis,
    rateBps: number | null | undefined,
    fixedUsd: string | null | undefined,
  ): void {
    if (basis === 'fixed') {
      if (fixedUsd === null || fixedUsd === undefined) {
        throw AppError.badRequest('A fixed fee needs an amount');
      }
      if (rateBps !== null && rateBps !== undefined) {
        throw AppError.badRequest('A fixed fee must not carry a rate');
      }
      return;
    }
    if (rateBps === null || rateBps === undefined) {
      throw AppError.badRequest(`A ${basis} fee needs a rate in basis points`);
    }
    if (fixedUsd !== null && fixedUsd !== undefined) {
      throw AppError.badRequest(`A ${basis} fee must not carry a fixed amount`);
    }
  }

  /**
   * An amount field, already in `undefined`-means-leave-alone form.
   *
   * `null` clears, and a value is re-rendered at the engine's scale so a row
   * never holds `100.5` beside `100.50000000`.
   */
  private amountOrNull(
    field: 'fixedUsd' | 'minNotionalUsd' | 'maxNotionalUsd',
    raw: string | null | undefined,
  ): string | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    try {
      const units = parseUsd(raw);
      if (!isWithinStoreRange(units)) {
        throw new MoneyError('Amount is larger than an exact USD amount can store');
      }
      return formatUsd(units);
    } catch (cause) {
      throw AppError.badRequest(cause instanceof MoneyError ? cause.message : `${field} is not a valid amount`);
    }
  }

  private presentRule(row: RuleRow) {
    return {
      id: row.id,
      operation: row.operation as FeeOperation,
      kind: row.kind as FeeKind,
      basis: row.basis as FeeBasis,
      label: row.label,
      rateBps: row.rateBps,
      // Every amount is normalised to the same 10^-8 scale the money module
      // uses, so the operator reads "0.00000000" for a zero and not "0", which
      // is indistinguishable from a field that was never filled in. Prisma's
      // Decimal would otherwise render a trimmed string and a real zero would
      // look like an empty one.
      fixedUsd: presentDecimal(row.fixedUsd),
      assetId: row.assetId,
      assetCategory: row.assetCategory as FeeAssetCategory | null,
      providerSlug: row.providerSlug,
      country: row.country,
      region: row.region,
      minNotionalUsd: presentDecimal(row.minNotionalUsd),
      maxNotionalUsd: presentDecimal(row.maxNotionalUsd),
      priority: row.priority,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      effectiveUntil: row.effectiveUntil?.toISOString() ?? null,
      active: row.active,
      specificity: specificityOf(toDomainRule(row)),
      createdById: row.createdById,
      updatedById: row.updatedById,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

const RULE_SELECT = {
  id: true, operation: true, kind: true, basis: true, label: true,
  rateBps: true, fixedUsd: true, assetId: true, assetCategory: true, providerSlug: true,
  country: true, region: true, minNotionalUsd: true, maxNotionalUsd: true,
  priority: true, effectiveFrom: true, effectiveUntil: true, active: true,
  createdById: true, updatedById: true, createdAt: true, updatedAt: true,
} as const;

/**
 * A Prisma decimal as an exact, fixed-precision string.
 *
 * `toString()` on a Decimal is exact but trimmed: `0` renders as `"0"` and
 * `100.5` as `"100.5"`. Round-tripping through `money.ts` gives one scale for
 * every amount the API returns, which is what makes two amounts comparable by
 * eye and by string.
 */
function presentDecimal(value: { toString(): string } | null): string | null {
  if (value === null) return null;
  return formatUsd(parseUsd(value.toString()));
}

/** The rate or the amount, whichever this row carries. For the change log. */
function presentAmount(row: RuleRow): string {
  if (row.rateBps !== null) return `${row.rateBps} bps`;
  return presentDecimal(row.fixedUsd) ?? '(no amount)';
}

/**
 * Map a row to the domain shape.
 *
 * Both the resolver and the diagnostics need this, and both need it to agree:
 * a diagnostic that disagreed with the resolver about what a row means would
 * point an operator at the wrong row.
 */
function toDomainRule(row: RuleRow): FeeRule {
  return {
    id: row.id,
    operation: row.operation as FeeOperation,
    kind: row.kind as FeeKind,
    basis: row.basis as FeeBasis,
    rateBps: row.rateBps,
    fixedUsd: presentDecimal(row.fixedUsd),
    assetId: row.assetId,
    assetCategory: row.assetCategory as FeeAssetCategory | null,
    providerSlug: row.providerSlug,
    country: row.country,
    region: row.region,
    minNotionalUsd: presentDecimal(row.minNotionalUsd),
    maxNotionalUsd: presentDecimal(row.maxNotionalUsd),
    priority: row.priority,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
    active: row.active,
    label: row.label,
  };
}
