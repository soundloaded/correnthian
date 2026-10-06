/**
 * Assembling an itemised breakdown.
 *
 * §37's requirement is a single sentence — "exactly what they are paying
 * before confirmation" — and it is the hardest thing in this module to get
 * right, because the tempting shape is a total. A total is one number, it fits
 * in a headline, and it is a lie the moment any of its parts is unknown.
 *
 * So a breakdown is a list of lines, and the total is `null` unless every line
 * is real. `knownSubtotalUsd` carries what we *do* know, labelled as such, so
 * a UI has something to render without being able to present it as the total.
 *
 * Two shapes exist for the same breakdown, and they are deliberately different:
 *
 *   - `ResolvedBreakdown` is internal. Its lines carry `ruleId`, which is how
 *     an operator correlates a quote to the row that priced it.
 *   - `PublicFeeBreakdown` is what a customer sees, and what is stored on the
 *     quote. Rule ids and operator identity are stripped. The lines are
 *     otherwise identical — a customer and an operator must be able to read
 *     the same fee, or the claim that it is itemised is uncheckable.
 */

import { formatUsd, sumUsd, parseUsd, type Usd } from './money.js';
import {
  FEE_KINDS, resolveKind,
  type FeeBasis, type FeeConflict, type FeeKind, type FeeOperation, type FeeQuery,
  type FeeRule, type ResolvedFeeLine,
} from './fee-rule.js';

/** One line, as a customer and an operator both read it. */
export interface PublicFeeLine {
  readonly kind: FeeKind;
  readonly label: string;
  readonly basis: FeeBasis | null;
  readonly rateBps: number | null;
  /** Exact decimal string when known; `null` when not. Never a number. */
  readonly amountUsd: string | null;
  readonly status: 'computed' | 'unknown';
  /** Present exactly when `status` is `unknown`. */
  readonly reason: string | null;
}

export interface PublicFeeBreakdown {
  readonly operation: FeeOperation;
  /**
   * The notional this breakdown was computed from, echoed unchanged.
   *
   * This field is the structural proof that no fee was folded into a price.
   * The engine receives a notional and returns it verbatim beside the fees;
   * there is nowhere for an adjusted notional to be written, so a hidden
   * spread has no way to express itself.
   */
  readonly notionalUsd: string | null;
  readonly lines: readonly PublicFeeLine[];
  /**
   * The sum of every line — or `null` when any line is unknown.
   *
   * Null rather than a partial sum, because a partial sum is the number a UI
   * puts in a headline and a customer reads as the price.
   */
  readonly totalUsd: string | null;
  /** What is known, so a page can render something honest. Never a total. */
  readonly knownSubtotalUsd: string;
  /** True only when every line is `computed`. */
  readonly complete: boolean;
  /** One entry per unknown line, so a caller can explain the gap. */
  readonly unknown: readonly { kind: FeeKind; reason: string }[];
  /**
   * A fingerprint of the rule rows that produced this breakdown.
   *
   * Stored on the quote so an operator can tell which revision of the fee
   * table priced it, after the table has moved on.
   */
  readonly rulesetVersion: string;
}

export interface ResolvedBreakdown extends Omit<PublicFeeBreakdown, 'lines'> {
  readonly lines: readonly ResolvedFeeLine[];
  /** The rule ids behind each line, for the audit trail. Never for the wire. */
  readonly ruleIds: readonly string[];
}

export type BreakdownResolution =
  | { readonly status: 'resolved'; readonly breakdown: ResolvedBreakdown }
  | { readonly status: 'conflict'; readonly conflicts: readonly FeeConflict[] };

/**
 * Every kind is resolved on every operation.
 *
 * Not only the kinds a rule exists for: the point of the breakdown is to say
 * what the customer is paying *and* what could not be determined. Iterating a
 * fixed list means a kind cannot be silently omitted from a quote because
 * nobody wrote a rule for it — which is exactly the failure the hardcoded zero
 * represented.
 */
export function resolveBreakdown(
  query: FeeQuery,
  rules: readonly FeeRule[],
  now: Date,
): BreakdownResolution {
  const lines: ResolvedFeeLine[] = [];
  const conflicts: FeeConflict[] = [];

  for (const kind of FEE_KINDS) {
    const result = resolveKind(kind, query, rules, now);
    if (result.status === 'conflict') conflicts.push(result.conflict);
    else lines.push(result.line);
  }

  if (conflicts.length > 0) {
    // Every conflict is reported, not just the first. An operator fixing one
    // and discovering the next on the following attempt is a bad afternoon.
    return { status: 'conflict', conflicts };
  }

  const computed = lines.filter((l) => l.status === 'computed');
  const unknown = lines.filter((l) => l.status === 'unknown');
  const complete = unknown.length === 0;

  const knownSubtotal = sumUsd(
    computed.map((l) => (l.amountUsd === null ? (0n as Usd) : parseUsd(l.amountUsd))),
  );

  const ordered = sortLines(lines, rules);

  return {
    status: 'resolved',
    breakdown: {
      operation: query.operation,
      notionalUsd: query.notional === null ? null : formatUsd(query.notional),
      lines: ordered,
      totalUsd: complete ? formatUsd(knownSubtotal) : null,
      knownSubtotalUsd: formatUsd(knownSubtotal),
      complete,
      unknown: unknown.map((l) => ({ kind: l.kind, reason: l.reason ?? 'Reason not recorded' })),
      rulesetVersion: rulesetVersionOf(ordered, rules),
      ruleIds: ordered.map((l) => l.ruleId).filter((id): id is string => id !== null),
    },
  };
}

/**
 * A stable order for the lines.
 *
 * Fixed by kind rather than by amount or by rule id, so the same operation
 * always renders the same way and a customer comparing two quotes is comparing
 * like with like. §37's order: network, provider, Correnthian.
 */
function sortLines(lines: readonly ResolvedFeeLine[], rules: readonly FeeRule[]): ResolvedFeeLine[] {
  const kindRank = new Map<FeeKind, number>(FEE_KINDS.map((k, i) => [k, i]));
  const byId = new Map(rules.map((r) => [r.id, r]));
  return [...lines].sort((a, b) => {
    const byKind = (kindRank.get(a.kind) ?? 99) - (kindRank.get(b.kind) ?? 99);
    if (byKind !== 0) return byKind;
    // Same kind twice is not possible today — one rule per kind wins — but a
    // deterministic order costs nothing and an unstable one costs a flaky
    // snapshot.
    const pa = a.ruleId ? (byId.get(a.ruleId)?.priority ?? 0) : 0;
    const pb = b.ruleId ? (byId.get(b.ruleId)?.priority ?? 0) : 0;
    if (pa !== pb) return pb - pa;
    return (a.ruleId ?? '').localeCompare(b.ruleId ?? '');
  });
}

/**
 * A short fingerprint of the rules that produced these lines.
 *
 * Derived from what each line actually says rather than from the whole table,
 * so an unrelated rule being added does not change the version of a quote that
 * never consulted it. Deterministic: the same rules produce the same string,
 * which is what makes it usable as a comparison.
 */
function rulesetVersionOf(lines: readonly ResolvedFeeLine[], rules: readonly FeeRule[]): string {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const canonical = lines
    .map((l) => {
      const rule = l.ruleId ? byId.get(l.ruleId) : undefined;
      return [
        l.kind,
        l.basis ?? '-',
        l.rateBps ?? '-',
        rule?.priority ?? '-',
        rule?.effectiveFrom?.toISOString() ?? '-',
      ].join(':');
    })
    .sort()
    .join('|');

  // djb2, as a hex string. A checksum for humans comparing two quotes, not a
  // security control, and labelled as such so nobody reaches for it as one.
  let hash = 5381;
  for (let i = 0; i < canonical.length; i += 1) {
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) >>> 0;
  }
  return `r${hash.toString(16).padStart(8, '0')}`;
}

/** Strip the internal rule ids. This is what is stored and what is returned. */
export function toPublicBreakdown(breakdown: ResolvedBreakdown): PublicFeeBreakdown {
  return {
    operation: breakdown.operation,
    notionalUsd: breakdown.notionalUsd,
    lines: breakdown.lines.map((l) => ({
      kind: l.kind,
      label: l.label,
      basis: l.basis,
      rateBps: l.rateBps,
      amountUsd: l.amountUsd,
      status: l.status,
      reason: l.reason,
    })),
    totalUsd: breakdown.totalUsd,
    knownSubtotalUsd: breakdown.knownSubtotalUsd,
    complete: breakdown.complete,
    unknown: breakdown.unknown,
    rulesetVersion: breakdown.rulesetVersion,
  };
}

/**
 * True when a breakdown carries a spread line.
 *
 * A spread is legitimate and permitted — §37 names it. What is forbidden is a
 * spread that is not on the list. This predicate exists so a caller can assert
 * the second property without re-implementing the first.
 */
export function hasSpreadLine(breakdown: PublicFeeBreakdown): boolean {
  return breakdown.lines.some((l) => l.basis === 'spread');
}
