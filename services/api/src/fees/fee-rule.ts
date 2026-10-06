/**
 * Fee rules, and the precedence that decides which of them applies.
 *
 * ---------------------------------------------------------------------------
 * WHY RULES ARE DATA
 *
 * A fee is a commercial term. It changes because counsel read a contract, or
 * because a provider repriced, or because a promotion ended. Every one of
 * those is a business event, not a release. A rate compiled into a service is
 * a rate that requires a deploy, a review and a rollback plan to change, and
 * the pressure that creates is to batch changes up and ship them rarely —
 * which is how a stale rate ends up quoting a price nobody agreed to.
 *
 * So a rule is a row. `FeesService` reads it, and this file decides which rows
 * apply. Nothing here knows what a quote is.
 *
 * ---------------------------------------------------------------------------
 * THE PRECEDENCE RULE, WHICH IS THE WHOLE POINT OF THIS FILE
 *
 * "Most specific wins" is easy to say and, on its own, meaningless. Two rules
 * can both be specific in *different* directions — one names a gold asset, the
 * other names a US customer — and "most specific" does not rank them. Any
 * implementation that does rank them has silently invented a policy: it has
 * decided, without telling anyone, that asset beats jurisdiction.
 *
 * The rule here is a **partial order**. Each matching rule is scored on four
 * independent dimensions; a rule *dominates* another when it is at least as
 * specific on every dimension and strictly more specific on one. Then:
 *
 *   1. The highest `priority` band wins. `priority` is explicit and lives on
 *      the row, so an operator can separate two rules deliberately.
 *   2. Within that band, a rule that dominates every other wins.
 *   3. If two rules survive and neither dominates the other, the resolution
 *      **refuses**. It does not pick one.
 *
 * Refusing is the right failure. Picking arbitrarily charges a real customer
 * one of two rates for no stated reason, and the operator never finds out. A
 * refusal costs an error message — and there is an operator surface
 * (`FeesService.diagnostics`) that finds these conflicts before a customer
 * does.
 *
 * ---------------------------------------------------------------------------
 * A SPREAD IS A LINE, NOT A PRICE
 *
 * §37 lists "Spread" alongside the fees. A spread is different in kind: it is
 * a margin that most venues bury inside the exchange rate, which is precisely
 * why the design spec forbids it. It is modelled here as a `basis` rather than
 * as a thing the engine does to a price — `spreadBps` is computed into an
 * amount by the same arithmetic as a percentage, and emitted as its own line.
 *
 * The structural guarantee: nothing in this module returns, accepts or
 * mentions a price. A `FeeBreakdown` echoes the notional it was given,
 * unchanged, and the sum of its lines. There is no field an adjusted price
 * could be written into, so there is no path that folds a fee into one.
 */

import { applyBps, formatUsd, parseUsd, type Usd } from './money.js';

/** §37's operations. One rule applies to exactly one of them. */
export const FEE_OPERATIONS = ['swap', 'buy', 'sell', 'redeem', 'onramp', 'offramp'] as const;
export type FeeOperation = (typeof FEE_OPERATIONS)[number];

/**
 * Who is paid.
 *
 * §37 lists seven fee categories: network, provider, Correnthian, spread,
 * redemption, on-ramp and off-ramp. The first three answer *who is paid*. The
 * last three answer *which operation*. They are orthogonal, and flattening
 * them means a redemption fee cannot be a provider fee, and an on-ramp fee
 * cannot be split into the network cost and the margin on top — which is
 * exactly the itemisation §37 asks for.
 *
 * So `kind` is who is paid, and the operation is its own field. Every one of
 * §37's seven lines is expressible: a redemption fee is a `correnthian` rule
 * on the `redeem` operation; an on-ramp fee is a `correnthian` rule on the
 * `onramp` operation; a spread is a `spread` basis with whichever kind earns
 * it.
 */
export const FEE_KINDS = ['network', 'provider', 'correnthian'] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

/** How a rule turns a notional into an amount. */
export const FEE_BASES = ['percent', 'fixed', 'spread'] as const;
export type FeeBasis = (typeof FEE_BASES)[number];

/** Asset categories a rule may target instead of a specific asset. */
export const FEE_ASSET_CATEGORIES = ['crypto', 'stablecoin', 'metal', 'treasury', 'fund', 'other'] as const;
export type FeeAssetCategory = (typeof FEE_ASSET_CATEGORIES)[number];

/**
 * A fee rule, as the resolver sees it.
 *
 * Deliberately plain — no Prisma types, no dates as strings. The service maps
 * a row into this shape, which is what lets the whole precedence rule be
 * tested without a database.
 */
export interface FeeRule {
  readonly id: string;
  readonly operation: FeeOperation;
  readonly kind: FeeKind;
  readonly basis: FeeBasis;

  /** Integer basis points. Set for `percent` and `spread`, null for `fixed`. */
  readonly rateBps: number | null;
  /** An exact USD decimal string. Set for `fixed`, null otherwise. */
  readonly fixedUsd: string | null;

  /** A specific asset. Null means "not restricted to one asset". */
  readonly assetId: string | null;
  /** An asset category. Null means "not restricted to one category". */
  readonly assetCategory: FeeAssetCategory | null;

  /** A provider slug. Null means "any provider, or none". */
  readonly providerSlug: string | null;

  /** ISO-3166 alpha-2. Null means "any country". */
  readonly country: string | null;
  /** A subdivision code. Null means "the whole country". */
  readonly region: string | null;

  /** Inclusive lower bound on the notional. Null means "no lower bound". */
  readonly minNotionalUsd: string | null;
  /** Inclusive upper bound on the notional. Null means "no upper bound". */
  readonly maxNotionalUsd: string | null;

  /** Higher wins. The explicit, operator-set tie-break. Defaults to 0. */
  readonly priority: number;

  readonly effectiveFrom: Date | null;
  /** Exclusive: a rule stops applying at this instant. */
  readonly effectiveUntil: Date | null;

  readonly active: boolean;
  /** What the customer reads. Never generated from the selectors. */
  readonly label: string;
}

/** What is being priced. */
export interface FeeQuery {
  readonly operation: FeeOperation;
  /**
   * The asset the fee is levied against.
   *
   * For a swap this is the **from** asset — you pay a fee on what you are
   * converting, not on what you receive. For a buy or an on-ramp it is the
   * asset being acquired. One asset per query, stated rather than inferred.
   */
  readonly assetId: string | null;
  readonly assetCategory: FeeAssetCategory | null;
  readonly providerSlug: string | null;
  readonly country: string | null;
  readonly region: string | null;
  /**
   * The USD notional, already parsed to exact units. Null when the caller
   * could not state one.
   *
   * A null notional is not zero: it means a percentage cannot be applied at
   * all, and a `percent` or `spread` rule reports `unknown` rather than a
   * confident `0`. A `fixed` rule is unaffected, which is the honest asymmetry.
   */
  readonly notional: Usd | null;
}

/**
 * Where a rule sits on each dimension. Higher is more specific.
 *
 * Exported so a test can pin the numbers rather than assert on behaviour that
 * happens to follow from them.
 */
export interface Specificity {
  readonly asset: 0 | 1 | 2;
  readonly provider: 0 | 1;
  readonly jurisdiction: 0 | 1 | 2;
  readonly notional: 0 | 1;
}

export function specificityOf(rule: FeeRule): Specificity {
  // A named asset beats a category, which beats no restriction at all. A rule
  // naming both an asset and a category is scored on the asset, because the
  // category is then redundant.
  const asset: Specificity['asset'] = rule.assetId ? 2 : rule.assetCategory ? 1 : 0;
  const jurisdiction: Specificity['jurisdiction'] = rule.region ? 2 : rule.country ? 1 : 0;
  return {
    asset,
    provider: rule.providerSlug ? 1 : 0,
    jurisdiction,
    notional: rule.minNotionalUsd !== null || rule.maxNotionalUsd !== null ? 1 : 0,
  };
}

const DIMENSIONS = ['asset', 'provider', 'jurisdiction', 'notional'] as const;

/**
 * True when `a` is at least as specific as `b` on every dimension and strictly
 * more specific on one.
 *
 * Note what this is not: it is not a comparison of totals. Summing the
 * dimensions would rank "gold asset" against "US customer" and invent a
 * policy; refusal is the honest answer for that pair, and `priority` is the
 * lever for someone who has actually decided.
 */
export function dominates(a: FeeRule, b: FeeRule): boolean {
  const sa = specificityOf(a);
  const sb = specificityOf(b);
  let strictlyMore = false;
  for (const d of DIMENSIONS) {
    if (sa[d] < sb[d]) return false;
    if (sa[d] > sb[d]) strictlyMore = true;
  }
  return strictlyMore;
}

/** The country/region a rule is scoped to, normalised for comparison. */
function sameJurisdiction(a: string | null, b: string | null): boolean {
  return (a ?? '').toUpperCase() === (b ?? '').toUpperCase();
}

/**
 * Does this rule apply to this query?
 *
 * Every selector is a restriction: a rule that names a country does not apply
 * elsewhere, and a rule that names nothing applies everywhere. The effective
 * window is a restriction too, and an inactive rule is not a rule at all —
 * matching `JurisdictionService`, and matching how an operator expects a
 * disabled row to behave.
 */
export function matches(rule: FeeRule, query: FeeQuery, now: Date): boolean {
  if (!rule.active) return false;
  if (rule.operation !== query.operation) return false;

  if (rule.assetId !== null && rule.assetId !== query.assetId) return false;
  if (rule.assetCategory !== null && rule.assetCategory !== query.assetCategory) return false;
  if (rule.providerSlug !== null && rule.providerSlug !== query.providerSlug) return false;
  if (rule.country !== null && !sameJurisdiction(rule.country, query.country)) return false;
  if (rule.region !== null && !sameJurisdiction(rule.region, query.region)) return false;

  // Bounds are only checkable against a stated notional. A query with no
  // notional cannot satisfy a bounded rule, because we cannot show it falls
  // inside the window — and assuming it does would apply a tier nobody
  // verified.
  if (rule.minNotionalUsd !== null || rule.maxNotionalUsd !== null) {
    if (query.notional === null) return false;
    if (rule.minNotionalUsd !== null && query.notional < parseBound(rule.minNotionalUsd)) return false;
    if (rule.maxNotionalUsd !== null && query.notional > parseBound(rule.maxNotionalUsd)) return false;
  }

  if (rule.effectiveFrom !== null && now < rule.effectiveFrom) return false;
  if (rule.effectiveUntil !== null && now >= rule.effectiveUntil) return false;

  return true;
}

/** Bounds are authored by operators, so a malformed one is a configuration error. */
function parseBound(value: string): Usd {
  return parseUsd(value);
}

/**
 * Could these two rules ever both apply?
 *
 * Used only by the operator diagnostic. Two rules conflict in practice exactly
 * when they can both match one query and neither dominates — which is why this
 * asks about *overlap* of the selectors rather than about equality of them.
 * Two rules with different countries never overlap; two rules with different
 * asset ids never overlap; a category rule and an asset rule overlap only when
 * the category is the asset's.
 */
export function overlaps(a: FeeRule, b: FeeRule): boolean {
  if (a.operation !== b.operation) return false;
  if (a.kind !== b.kind) return false;
  if (!a.active || !b.active) return false;

  if (!selectorsIntersect(a.assetId, b.assetId)) return false;
  // Two different named categories cannot both be the asset's category; an
  // asset rule and a category rule are left as overlapping, because whether
  // the category matches depends on the asset, which is not known here. A
  // diagnostic that under-reports is worse than one that over-reports.
  if (a.assetId === null && b.assetId === null
    && a.assetCategory !== null && b.assetCategory !== null
    && a.assetCategory !== b.assetCategory) return false;

  if (!selectorsIntersect(a.providerSlug, b.providerSlug)) return false;
  if (!selectorsIntersect(a.country, b.country)) return false;
  if (!selectorsIntersect(a.region, b.region)) return false;

  return windowsIntersect(a, b) && effectiveWindowsIntersect(a, b);
}

/** Two restrictions intersect when one is unrestricted, or they are equal. */
function selectorsIntersect(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return true;
  return sameJurisdiction(a, b);
}

/** Either a real bound, or the absence of one. Never conflated. */
type Bound = Usd | 'unbounded';

/**
 * The tighter of two lower bounds.
 *
 * The `'unbounded'` sentinel is not decoration. Returning `null` for "no lower
 * bound" and also for "the tighter of these two is unknown" collapses two
 * different things, and the collapse is not conservative: a rule with a
 * ceiling of 100 and a rule with a floor of 200 would be reported as
 * overlapping, because both comparisons came back null and null was read as
 * "no opinion". They can never both apply, and the diagnostic exists to say so.
 */
function greatestMin(a: string | null, b: string | null): Bound {
  if (a === null && b === null) return 'unbounded';
  if (a === null) return parseBound(b as string);
  if (b === null) return parseBound(a);
  const ua = parseBound(a);
  const ub = parseBound(b);
  return ua > ub ? ua : ub;
}

function leastMax(a: string | null, b: string | null): Bound {
  if (a === null && b === null) return 'unbounded';
  if (a === null) return parseBound(b as string);
  if (b === null) return parseBound(a);
  const ua = parseBound(a);
  const ub = parseBound(b);
  return ua < ub ? ua : ub;
}

function windowsIntersect(a: FeeRule, b: FeeRule): boolean {
  const low = greatestMin(a.minNotionalUsd, b.minNotionalUsd);
  const high = leastMax(a.maxNotionalUsd, b.maxNotionalUsd);
  // Only one side unbounded, or neither: the windows always meet.
  if (low === 'unbounded' || high === 'unbounded') return true;
  return low <= high;
}

/**
 * The later of two effective starts, or `'unconstrained'` when neither rule
 * states one.
 *
 * The same trap as `windowsIntersect`, and the same fix. `null` on an
 * `effectiveFrom` means "always applies from now on"; reading it back out of a
 * comparison as "no opinion" would let a rule that ended in January be
 * reported as overlapping one that begins in February.
 *
 * One sentinel serves both directions because an absent `from` can only be a
 * missing lower bound and an absent `until` only a missing upper bound.
 */
function laterStart(a: Date | null, b: Date | null): Date | 'unconstrained' {
  if (a === null && b === null) return 'unconstrained';
  if (a === null) return b as Date;
  if (b === null) return a;
  return a > b ? a : b;
}

function earlierEnd(a: Date | null, b: Date | null): Date | 'unconstrained' {
  if (a === null && b === null) return 'unconstrained';
  if (a === null) return b as Date;
  if (b === null) return a;
  return a < b ? a : b;
}

function effectiveWindowsIntersect(a: FeeRule, b: FeeRule): boolean {
  const start = laterStart(a.effectiveFrom, b.effectiveFrom);
  const end = earlierEnd(a.effectiveUntil, b.effectiveUntil);
  if (start === 'unconstrained' || end === 'unconstrained') return true;
  // Exclusive ends: a rule that ends exactly when another starts does not
  // overlap it, because at that instant the first has already ended.
  return start < end;
}

/** A line of the itemised breakdown, before it is projected for the wire. */
export interface ResolvedFeeLine {
  readonly kind: FeeKind;
  readonly label: string;
  /**
   * `computed` carries an exact amount. `unknown` carries `null` and a reason.
   *
   * This is the distinction the engine exists to make. A fee of zero that came
   * from a rule is `computed` with `"0.00000000"`; a fee nobody has configured
   * is `unknown` with `null`. Collapsing them is how a quote reports zero and
   * means "we have no idea".
   */
  readonly status: 'computed' | 'unknown';
  readonly basis: FeeBasis | null;
  readonly rateBps: number | null;
  readonly amountUsd: string | null;
  readonly reason: string | null;
  /** Internal. Stripped by the public projection. */
  readonly ruleId: string | null;
}

/** Why a resolution produced no answer at all. */
export interface FeeConflict {
  readonly operation: FeeOperation;
  readonly kind: FeeKind;
  readonly ruleIds: readonly string[];
  readonly detail: string;
}

export type KindResolution =
  | { readonly status: 'resolved'; readonly line: ResolvedFeeLine }
  | { readonly status: 'conflict'; readonly conflict: FeeConflict };

/**
 * Resolve one fee kind.
 *
 * Exported separately from the whole-breakdown resolution because the
 * precedence rule is the part worth testing in isolation, and because a caller
 * asking "what is the provider fee here" should not have to construct a full
 * breakdown to find out.
 */
export function resolveKind(
  kind: FeeKind,
  query: FeeQuery,
  rules: readonly FeeRule[],
  now: Date,
): KindResolution {
  const candidates = rules.filter((r) => r.kind === kind && matches(r, query, now));

  if (candidates.length === 0) return { status: 'resolved', line: absentLine(kind, query) };

  // 1. The highest explicit priority band. Nothing below it is considered, so
  //    an operator can always separate two rules without deleting either.
  const topPriority = Math.max(...candidates.map((r) => r.priority));
  const band = candidates.filter((r) => r.priority === topPriority);

  // 2. Within the band, drop anything another rule dominates.
  const survivors = band.filter((candidate) => !band.some((other) => dominates(other, candidate)));

  if (survivors.length > 1) {
    // 3. Incomparable. Refuse rather than pick.
    const ruleIds = survivors.map((r) => r.id).sort();
    return {
      status: 'conflict',
      conflict: {
        operation: query.operation,
        kind,
        ruleIds,
        detail:
          `${survivors.length} ${kind} fee rules apply to ${query.operation} and no one of ` +
          `them is more specific than the others in every respect. Set ` +
          `"priority" on the one that should win.`,
      },
    };
  }

  const winner = survivors[0];
  if (!winner) {
    // Unreachable: `candidates` is non-empty and `band` is a subset of it, so
    // at least one survivor always remains. Thrown rather than returned so a
    // future edit to the dominance rule fails loudly instead of silently
    // reporting no fee.
    throw new Error(`Fee resolution found ${candidates.length} matching ${kind} rules and selected none`);
  }

  return { status: 'resolved', line: computeLine(winner, query) };
}

/**
 * What a kind with no rule means.
 *
 * Not a zero. A zero here would be the exact bug this module replaces: the
 * quote reports `amountUsd: 0` and the customer is told a fee is nothing,
 * when the truth is that nobody has configured one. Each kind gets its own
 * sentence, because the remedy differs — finance sets a rate, or we contract
 * a provider, or an estimator gets built.
 */
function absentLine(kind: FeeKind, query: FeeQuery): ResolvedFeeLine {
  const reasons: Record<FeeKind, string> = {
    correnthian:
      `No Correnthian fee rule is configured for ${query.operation}. ` +
      `Finance has not set one, so the amount is unknown rather than zero.`,
    provider:
      `No provider fee can be stated for ${query.operation}: Correnthian has not ` +
      `contracted a provider for it.`,
    network:
      `No network fee estimate is available for ${query.operation}. Nothing in ` +
      `this deployment estimates gas.`,
  };
  return {
    kind,
    // Not "Correnthian fee" — the label is the operator's words, and inventing
    // one here would read as a real line with a real name.
    label: absentLabel(kind),
    status: 'unknown',
    basis: null,
    rateBps: null,
    amountUsd: null,
    reason: reasons[kind],
    ruleId: null,
  };
}

function absentLabel(kind: FeeKind): string {
  return { network: 'Network fee', provider: 'Provider fee', correnthian: 'Correnthian fee' }[kind];
}

/**
 * Turn a rule into an amount.
 *
 * The only place a fee amount is produced, and therefore the only place that
 * can be wrong. `fixed` needs nothing; `percent` and `spread` need a notional,
 * and without one they are `unknown` — a percentage of a number nobody stated
 * is not a number.
 */
function computeLine(rule: FeeRule, query: FeeQuery): ResolvedFeeLine {
  const base = {
    kind: rule.kind,
    label: rule.label,
    basis: rule.basis,
    rateBps: rule.rateBps,
    ruleId: rule.id,
  } as const;

  if (rule.basis === 'fixed') {
    const fixedUsd = rule.fixedUsd;
    if (fixedUsd === null) {
      // A `fixed` rule with no amount is a malformed row, not a zero. Saying so
      // keeps it visible instead of quietly charging nothing.
      return {
        ...base, status: 'unknown', amountUsd: null,
        reason: `The "${rule.label}" rule is a fixed fee with no amount recorded. It is a configuration error, not a zero.`,
      };
    }
    return { ...base, status: 'computed', amountUsd: fixedUsd, reason: null };
  }

  if (query.notional === null) {
    // The distinction that matters most here: a notional nobody stated is not
    // a notional of zero.
    return {
      ...base, status: 'unknown', amountUsd: null,
      reason:
        `The "${rule.label}" rule is ${rule.basis === 'spread' ? 'a spread' : 'a percentage'} of the ` +
        `notional, and no notional was stated, so the amount is unknown.`,
    };
  }

  if (rule.rateBps === null) {
    return {
      ...base, status: 'unknown', amountUsd: null,
      reason: `The "${rule.label}" rule has no rate recorded. It is a configuration error, not a zero.`,
    };
  }

  return {
    ...base,
    status: 'computed',
    amountUsd: formatUsd(applyBps(query.notional, rule.rateBps)),
    reason: null,
  };
}
