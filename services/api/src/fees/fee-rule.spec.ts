import { describe, expect, it } from 'vitest';
import { parseUsd } from './money.js';
import {
  dominates, matches, overlaps, resolveKind, specificityOf,
  type FeeKind, type FeeQuery, type FeeRule,
} from './fee-rule.js';

/** A rule with everything unrestricted, so each test states only what it varies. */
function rule(over: Partial<FeeRule> = {}): FeeRule {
  return {
    id: 'r1',
    operation: 'swap',
    kind: 'correnthian',
    basis: 'percent',
    rateBps: 100,
    fixedUsd: null,
    assetId: null,
    assetCategory: null,
    providerSlug: null,
    country: null,
    region: null,
    minNotionalUsd: null,
    maxNotionalUsd: null,
    priority: 0,
    effectiveFrom: null,
    effectiveUntil: null,
    active: true,
    label: 'Correnthian fee',
    ...over,
  };
}

function query(over: Partial<FeeQuery> = {}): FeeQuery {
  return {
    operation: 'swap',
    assetId: 'chain:gold',
    assetCategory: 'metal',
    providerSlug: null,
    country: 'US',
    region: 'NY',
    notional: parseUsd('1000'),
    ...over,
  };
}

const NOW = new Date('2026-10-06T12:00:00Z');

/** The resolved line, or a thrown error naming what went wrong. */
function line(kind: FeeKind, q: FeeQuery, rules: FeeRule[]) {
  const result = resolveKind(kind, q, rules, NOW);
  if (result.status !== 'resolved') throw new Error(`expected a line, got a ${result.status}`);
  return result.line;
}

describe('fee rules — matching', () => {
  it('applies an unrestricted rule to everything', () => {
    expect(matches(rule(), query(), NOW)).toBe(true);
  });

  it('does not apply a rule for another operation, however unrestricted', () => {
    expect(matches(rule({ operation: 'redeem' }), query(), NOW)).toBe(false);
  });

  it('treats an inactive rule as absent, not as a zero', () => {
    // The important half of the pair below: a disabled row must not quietly
    // become a free fee.
    expect(matches(rule({ active: false }), query(), NOW)).toBe(false);
    expect(resolveKind('correnthian', query(), [rule({ active: false })], NOW))
      .toMatchObject({ status: 'resolved', line: { status: 'unknown', amountUsd: null } });
  });

  it('scopes by asset, category, provider and jurisdiction', () => {
    expect(matches(rule({ assetId: 'chain:gold' }), query(), NOW)).toBe(true);
    expect(matches(rule({ assetId: 'chain:silver' }), query(), NOW)).toBe(false);
    expect(matches(rule({ assetCategory: 'metal' }), query(), NOW)).toBe(true);
    expect(matches(rule({ assetCategory: 'stablecoin' }), query(), NOW)).toBe(false);
    expect(matches(rule({ providerSlug: 'kinesis' }), query(), NOW)).toBe(false);
    expect(matches(rule({ providerSlug: 'kinesis' }), query({ providerSlug: 'kinesis' }), NOW)).toBe(true);
    expect(matches(rule({ country: 'GB' }), query(), NOW)).toBe(false);
    expect(matches(rule({ region: 'CA' }), query(), NOW)).toBe(false);
    expect(matches(rule({ country: 'us' }), query(), NOW)).toBe(true);
  });

  it('honours the notional window inclusively at both ends', () => {
    const r = rule({ minNotionalUsd: '100.00', maxNotionalUsd: '500.00' });
    expect(matches(r, query({ notional: parseUsd('100') }), NOW)).toBe(true);
    expect(matches(r, query({ notional: parseUsd('500') }), NOW)).toBe(true);
    expect(matches(r, query({ notional: parseUsd('99.99') }), NOW)).toBe(false);
    expect(matches(r, query({ notional: parseUsd('500.01') }), NOW)).toBe(false);
  });

  it('will not apply a bounded rule to a query with no notional', () => {
    // Assuming it falls inside the window would apply a tier nobody verified.
    const r = rule({ minNotionalUsd: '100.00' });
    expect(matches(r, query({ notional: null }), NOW)).toBe(false);
    // An unbounded rule still applies — it makes no claim the notional could
    // contradict.
    expect(matches(rule(), query({ notional: null }), NOW)).toBe(true);
  });

  it('honours the effective window, with an exclusive end', () => {
    const r = rule({
      effectiveFrom: new Date('2026-10-01T00:00:00Z'),
      effectiveUntil: new Date('2026-11-01T00:00:00Z'),
    });
    expect(matches(r, query(), NOW)).toBe(true);
    expect(matches(r, query(), new Date('2026-09-30T23:59:59Z'))).toBe(false);
    // Exclusive: at the instant it ends, it has ended.
    expect(matches(r, query(), new Date('2026-11-01T00:00:00Z'))).toBe(false);
  });
});

describe('fee rules — specificity is a partial order, not a score', () => {
  it('scores each dimension independently', () => {
    expect(specificityOf(rule())).toEqual({ asset: 0, provider: 0, jurisdiction: 0, notional: 0 });
    expect(specificityOf(rule({ assetCategory: 'metal' }))).toEqual({ asset: 1, provider: 0, jurisdiction: 0, notional: 0 });
    expect(specificityOf(rule({ assetId: 'a' }))).toEqual({ asset: 2, provider: 0, jurisdiction: 0, notional: 0 });
    expect(specificityOf(rule({ country: 'US' }))).toEqual({ asset: 0, provider: 0, jurisdiction: 1, notional: 0 });
    expect(specificityOf(rule({ region: 'NY' }))).toEqual({ asset: 0, provider: 0, jurisdiction: 2, notional: 0 });
    expect(specificityOf(rule({ providerSlug: 'p' }))).toEqual({ asset: 0, provider: 1, jurisdiction: 0, notional: 0 });
    expect(specificityOf(rule({ minNotionalUsd: '1' }))).toEqual({ asset: 0, provider: 0, jurisdiction: 0, notional: 1 });
  });

  it('ranks a named asset above a category above nothing', () => {
    expect(dominates(rule({ assetId: 'a' }), rule({ assetCategory: 'metal' }))).toBe(true);
    expect(dominates(rule({ assetCategory: 'metal' }), rule())).toBe(true);
    expect(dominates(rule(), rule({ assetId: 'a' }))).toBe(false);
  });

  it('is not a total order: specific in different directions is not ranked', () => {
    // This is the pair that makes the whole design necessary. Any
    // implementation that sums the dimensions has to decide, silently, whether
    // asset beats jurisdiction.
    const byAsset = rule({ id: 'by-asset', assetId: 'chain:gold' });
    const byJurisdiction = rule({ id: 'by-jurisdiction', country: 'US' });
    expect(dominates(byAsset, byJurisdiction)).toBe(false);
    expect(dominates(byJurisdiction, byAsset)).toBe(false);
  });

  it('does not rank two rules that are equally specific', () => {
    expect(dominates(rule({ id: 'a' }), rule({ id: 'b' }))).toBe(false);
    expect(dominates(rule({ id: 'b' }), rule({ id: 'a' }))).toBe(false);
  });

  it('requires strictness somewhere, not merely no worse anywhere', () => {
    expect(dominates(rule({ assetId: 'a' }), rule({ assetId: 'a' }))).toBe(false);
  });
});

describe('fee rules — precedence', () => {
  it('picks the most specific rule', () => {
    const specific = rule({ id: 'specific', assetCategory: 'metal', rateBps: 149 });
    const general = rule({ id: 'general', rateBps: 200 });
    expect(line('correnthian', query(), [general, specific])).toMatchObject({
      ruleId: 'specific', rateBps: 149, amountUsd: '14.90000000',
    });
  });

  it('picks the same winner regardless of the order the rows arrive in', () => {
    const specific = rule({ id: 'specific', assetId: 'chain:gold', assetCategory: 'metal' });
    const general = rule({ id: 'general' });
    expect(line('correnthian', query(), [general, specific]).ruleId).toBe('specific');
    expect(line('correnthian', query(), [specific, general]).ruleId).toBe('specific');
  });

  it('refuses rather than picks when two rules are incomparable', () => {
    const byAsset = rule({ id: 'by-asset', assetId: 'chain:gold' });
    const byJurisdiction = rule({ id: 'shorter-id', country: 'US' });
    const result = resolveKind('correnthian', query(), [byAsset, byJurisdiction], NOW);

    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') throw new Error('unreachable');
    // The ids are sorted, so the message is stable across runs.
    expect(result.conflict.ruleIds).toEqual(['by-asset', 'shorter-id']);
    expect(result.conflict.detail).toMatch(/priority/);
  });

  it('refuses on a genuine tie: two rules with identical selectors', () => {
    const a = rule({ id: 'a', rateBps: 100 });
    const b = rule({ id: 'b', rateBps: 200 });
    const result = resolveKind('correnthian', query(), [a, b], NOW);
    expect(result.status).toBe('conflict');
  });

  it('lets priority break a tie deliberately', () => {
    const a = rule({ id: 'a', rateBps: 100, priority: 0 });
    const b = rule({ id: 'b', rateBps: 200, priority: 1 });
    expect(line('correnthian', query(), [a, b])).toMatchObject({ ruleId: 'b', rateBps: 200 });
    // And the other way, so the winner follows the operator and not the order.
    expect(line('correnthian', query(), [b, a])).toMatchObject({ ruleId: 'b' });
  });

  it('lets priority separate rules that are incomparable', () => {
    const byAsset = rule({ id: 'by-asset', assetId: 'chain:gold', priority: 0 });
    const byJurisdiction = rule({ id: 'by-jurisdiction', country: 'US', priority: 5 });
    expect(line('correnthian', query(), [byAsset, byJurisdiction]).ruleId).toBe('by-jurisdiction');
  });

  it('ignores a lower priority band entirely, even a more specific rule in it', () => {
    // Priority is an override, not a tie-break, and this pins that: the
    // specific rule is in a lower band and does not win on specificity.
    const specificButLower = rule({ id: 'specific', assetId: 'chain:gold', priority: 0 });
    const generalButHigher = rule({ id: 'general', priority: 1 });
    expect(line('correnthian', query(), [specificButLower, generalButHigher]).ruleId).toBe('general');
  });

  it('considers only rules of the requested kind', () => {
    const providerRule = rule({ id: 'p', kind: 'provider', rateBps: 300 });
    const networkRule = rule({ id: 'n', kind: 'network', rateBps: 400 });
    const result = line('correnthian', query(), [providerRule, networkRule]);
    expect(result.ruleId).toBeNull();
    expect(result.status).toBe('unknown');
  });

  it('resolves each kind independently, so a conflict in one does not mask another', () => {
    const rules = [
      rule({ id: 'c1', kind: 'correnthian' }),
      rule({ id: 'p', kind: 'provider', basis: 'fixed', fixedUsd: '2.50000000' }),
    ];
    expect(line('correnthian', query(), rules).ruleId).toBe('c1');
    expect(line('provider', query(), rules)).toMatchObject({ amountUsd: '2.50000000', status: 'computed' });
  });
});

describe('fee rules — zero is not unknown', () => {
  it('reports a configured zero as a computed zero', () => {
    const free = rule({ id: 'promo', rateBps: 0 });
    expect(line('correnthian', query(), [free])).toMatchObject({
      status: 'computed', amountUsd: '0.00000000', reason: null,
    });
  });

  it('reports no rule as unknown, with a reason and a null amount', () => {
    const l = line('correnthian', query(), []);
    expect(l.status).toBe('unknown');
    // Null, not '0.00000000'. This is the whole distinction, and it is
    // structural rather than a convention a client can forget.
    expect(l.amountUsd).toBeNull();
    expect(l.reason).toMatch(/Finance has not set one/);
  });

  it('gives each absent kind its own reason, because the remedies differ', () => {
    expect(line('provider', query(), []).reason).toMatch(/not contracted a provider/);
    expect(line('network', query(), []).reason).toMatch(/estimates gas/);
  });

  it('reports a percentage with no notional as unknown, not as a zero', () => {
    const l = line('correnthian', query({ notional: null }), [rule()]);
    expect(l.status).toBe('unknown');
    expect(l.amountUsd).toBeNull();
    expect(l.reason).toMatch(/no notional was stated/);
  });

  it('still computes a fixed fee with no notional — it does not need one', () => {
    const l = line('correnthian', query({ notional: null }), [
      rule({ basis: 'fixed', rateBps: null, fixedUsd: '3.00000000' }),
    ]);
    expect(l).toMatchObject({ status: 'computed', amountUsd: '3.00000000' });
  });

  it('calls a malformed rule a configuration error rather than a zero', () => {
    expect(line('correnthian', query(), [rule({ basis: 'fixed', rateBps: null, fixedUsd: null })]))
      .toMatchObject({ status: 'unknown', amountUsd: null });
    expect(line('correnthian', query(), [rule({ rateBps: null })]).reason)
      .toMatch(/configuration error/);
  });
});

describe('fee rules — a spread is a line, never a price', () => {
  it('computes a spread by the same arithmetic as a percentage', () => {
    const fee = rule({ id: 'fee', basis: 'percent', rateBps: 25 });
    const spread = rule({ id: 'spread', basis: 'spread', kind: 'provider', rateBps: 25 });
    expect(line('correnthian', query(), [fee]).amountUsd).toBe(line('provider', query(), [spread]).amountUsd);
  });

  it('marks the spread line, so it is visibly a spread and not a fee', () => {
    const spread = rule({ basis: 'spread', kind: 'provider', rateBps: 25, label: 'Provider spread' });
    const l = line('provider', query(), [spread]);
    expect(l.basis).toBe('spread');
    expect(l.label).toBe('Provider spread');
    // The rate travels with the amount: a customer can check the arithmetic.
    expect(l).toMatchObject({ rateBps: 25, amountUsd: '2.50000000' });
  });

  it('carries no field that could hold an adjusted price', () => {
    const l = line('provider', query(), [rule({ basis: 'spread', kind: 'provider' })]);
    expect(Object.keys(l).sort()).toEqual(
      ['amountUsd', 'basis', 'kind', 'label', 'rateBps', 'reason', 'ruleId', 'status'],
    );
  });
});

describe('fee rules — overlap detection for the operator diagnostic', () => {
  it('finds two rules that could both apply', () => {
    expect(overlaps(rule({ id: 'a' }), rule({ id: 'b' }))).toBe(true);
    expect(overlaps(rule({ id: 'a', assetId: 'x' }), rule({ id: 'b', assetId: 'x' }))).toBe(true);
    expect(overlaps(rule({ id: 'a', assetCategory: 'metal' }), rule({ id: 'b', assetId: 'x' }))).toBe(true);
  });

  it('separates rules that can never both apply', () => {
    expect(overlaps(rule({ id: 'a', operation: 'swap' }), rule({ id: 'b', operation: 'redeem' }))).toBe(false);
    expect(overlaps(rule({ id: 'a', kind: 'provider' }), rule({ id: 'b', kind: 'network' }))).toBe(false);
    expect(overlaps(rule({ id: 'a', assetId: 'x' }), rule({ id: 'b', assetId: 'y' }))).toBe(false);
    expect(overlaps(rule({ id: 'a', country: 'US' }), rule({ id: 'b', country: 'GB' }))).toBe(false);
    expect(overlaps(rule({ id: 'a', providerSlug: 'p1' }), rule({ id: 'b', providerSlug: 'p2' }))).toBe(false);
    expect(overlaps(rule({ id: 'a', assetCategory: 'metal' }), rule({ id: 'b', assetCategory: 'crypto' }))).toBe(false);
    expect(overlaps(rule({ id: 'a', active: false }), rule({ id: 'b' }))).toBe(false);
  });

  it('separates rules whose notional windows or effective windows do not meet', () => {
    expect(overlaps(
      rule({ id: 'a', maxNotionalUsd: '100' }),
      rule({ id: 'b', minNotionalUsd: '200' }),
    )).toBe(false);
    expect(overlaps(
      rule({ id: 'a', maxNotionalUsd: '200' }),
      rule({ id: 'b', minNotionalUsd: '100' }),
    )).toBe(true);
    expect(overlaps(
      rule({ id: 'a', effectiveUntil: new Date('2026-01-01') }),
      rule({ id: 'b', effectiveFrom: new Date('2026-02-01') }),
    )).toBe(false);
  });
});
