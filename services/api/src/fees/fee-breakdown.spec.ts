import { describe, expect, it } from 'vitest';
import { hasSpreadLine, resolveBreakdown, toPublicBreakdown } from './fee-breakdown.js';
import { parseUsd } from './money.js';
import type { FeeQuery, FeeRule } from './fee-rule.js';

function rule(over: Partial<FeeRule> = {}): FeeRule {
  return {
    id: 'r1', operation: 'swap', kind: 'correnthian', basis: 'percent', rateBps: 100,
    fixedUsd: null, assetId: null, assetCategory: null, providerSlug: null,
    country: null, region: null, minNotionalUsd: null, maxNotionalUsd: null,
    priority: 0, effectiveFrom: null, effectiveUntil: null, active: true,
    label: 'Correnthian fee', ...over,
  };
}

const QUERY: FeeQuery = {
  operation: 'swap', assetId: 'chain:gold', assetCategory: 'metal', providerSlug: null,
  country: 'US', region: 'NY', notional: parseUsd('1000'),
};

const NOW = new Date('2026-10-06T12:00:00Z');

function resolve(rules: FeeRule[], query: FeeQuery = QUERY) {
  const result = resolveBreakdown(query, rules, NOW);
  if (result.status !== 'resolved') throw new Error(`expected a breakdown, got ${result.status}`);
  return toPublicBreakdown(result.breakdown);
}

describe('fee breakdown', () => {
  it('lists every kind, in §37 order, including the ones with no rule', () => {
    const b = resolve([rule()]);
    expect(b.lines.map((l) => l.kind)).toEqual(['network', 'provider', 'correnthian']);
  });

  it('itemises rather than blending: one line per kind, never a single number', () => {
    const b = resolve([
      rule({ id: 'c', kind: 'correnthian', rateBps: 100 }),
      rule({ id: 'p', kind: 'provider', basis: 'fixed', rateBps: null, fixedUsd: '1.25000000' }),
    ]);
    const computed = b.lines.filter((l) => l.status === 'computed');
    expect(computed).toHaveLength(2);
    expect(computed.map((l) => l.amountUsd)).toEqual(['1.25000000', '10.00000000']);
  });

  describe('the total', () => {
    it('is null when any line is unknown, however small the gap', () => {
      // Only the Correnthian fee is configured. Network and provider are
      // unknown, so there is no total — and crucially not a total of the one
      // part we happen to know.
      const b = resolve([rule({ rateBps: 100 })]);
      expect(b.complete).toBe(false);
      expect(b.totalUsd).toBeNull();
      // What is known is still offered, labelled as a subtotal so no caller
      // can present it as the price.
      expect(b.knownSubtotalUsd).toBe('10.00000000');
      expect(b.unknown.map((u) => u.kind)).toEqual(['network', 'provider']);
    });

    it('is a real number when every line is known, including a zero line', () => {
      const b = resolve([
        rule({ id: 'c', kind: 'correnthian', rateBps: 100 }),
        rule({ id: 'p', kind: 'provider', basis: 'fixed', rateBps: null, fixedUsd: '1.50000000' }),
        rule({ id: 'n', kind: 'network', basis: 'fixed', rateBps: null, fixedUsd: '0.25000000' }),
      ]);
      expect(b.complete).toBe(true);
      expect(b.totalUsd).toBe('11.75000000');
      expect(b.knownSubtotalUsd).toBe(b.totalUsd);
    });

    it('is exactly zero, not null, when every kind is explicitly free', () => {
      // The distinction the engine exists for. Three rules that each say zero
      // produce a confident `0.00000000`; three absent rules produce `null`.
      const b = resolve([
        rule({ id: 'c', kind: 'correnthian', rateBps: 0 }),
        rule({ id: 'p', kind: 'provider', rateBps: 0 }),
        rule({ id: 'n', kind: 'network', rateBps: 0 }),
      ]);
      expect(b.complete).toBe(true);
      expect(b.totalUsd).toBe('0.00000000');
      expect(b.unknown).toEqual([]);
    });

    it('sums the lines exactly, with no drift', () => {
      const b = resolve([
        rule({ id: 'c', kind: 'correnthian', rateBps: 1 }),
        rule({ id: 'p', kind: 'provider', rateBps: 1 }),
        rule({ id: 'n', kind: 'network', rateBps: 1 }),
      ]);
      expect(b.lines.map((l) => l.amountUsd)).toEqual(['0.10000000', '0.10000000', '0.10000000']);
      expect(b.totalUsd).toBe('0.30000000');
    });
  });

  describe('a spread is a visible line, never a price', () => {
    it('echoes the notional unchanged, so nothing can be folded into it', () => {
      const b = resolve([
        rule({ id: 's', kind: 'provider', basis: 'spread', rateBps: 25, label: 'Provider spread' }),
      ]);
      // In 1000, out 1000. There is no field an adjusted notional could be
      // written into, and this asserts the one that exists is verbatim.
      expect(b.notionalUsd).toBe('1000.00000000');
      const spread = b.lines.find((l) => l.kind === 'provider');
      expect(spread).toMatchObject({ basis: 'spread', label: 'Provider spread', amountUsd: '2.50000000' });
      expect(hasSpreadLine(b)).toBe(true);
    });

    it('keeps the spread as its own line even when a fee applies beside it', () => {
      const b = resolve([
        rule({ id: 's', kind: 'provider', basis: 'spread', rateBps: 25, label: 'Provider spread' }),
        rule({ id: 'c', kind: 'correnthian', rateBps: 100, label: 'Correnthian fee' }),
      ]);
      const computed = b.lines.filter((l) => l.status === 'computed');
      // Two lines, separately labelled. A blended number here would be the
      // hidden spread the design spec forbids.
      expect(computed.map((l) => [l.label, l.amountUsd])).toEqual([
        ['Provider spread', '2.50000000'],
        ['Correnthian fee', '10.00000000'],
      ]);
    });

    it('states the spread rate, so a customer can check the arithmetic', () => {
      const b = resolve([rule({ id: 's', kind: 'provider', basis: 'spread', rateBps: 25 })]);
      expect(b.lines.find((l) => l.kind === 'provider')?.rateBps).toBe(25);
    });
  });

  describe('refusal on an ambiguous rule table', () => {
    it('returns conflicts rather than a breakdown', () => {
      const result = resolveBreakdown(QUERY, [
        rule({ id: 'by-asset', assetId: 'chain:gold' }),
        rule({ id: 'by-country', country: 'US' }),
      ], NOW);
      expect(result.status).toBe('conflict');
      if (result.status !== 'conflict') throw new Error('unreachable');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]?.kind).toBe('correnthian');
    });

    it('reports every conflicting kind, not only the first', () => {
      const result = resolveBreakdown(QUERY, [
        rule({ id: 'c1', kind: 'correnthian', assetId: 'chain:gold' }),
        rule({ id: 'c2', kind: 'correnthian', country: 'US' }),
        rule({ id: 'p1', kind: 'provider', assetId: 'chain:gold' }),
        rule({ id: 'p2', kind: 'provider', country: 'US' }),
      ], NOW);
      if (result.status !== 'conflict') throw new Error('expected conflicts');
      expect(result.conflicts.map((c) => c.kind).sort()).toEqual(['correnthian', 'provider']);
    });
  });

  describe('the public projection', () => {
    it('strips rule ids, so no internal identifier reaches a customer', () => {
      const internal = resolveBreakdown(QUERY, [rule({ id: 'secret-rule-id' })], NOW);
      if (internal.status !== 'resolved') throw new Error('unreachable');
      expect(internal.breakdown.ruleIds).toContain('secret-rule-id');

      const publicShape = toPublicBreakdown(internal.breakdown);
      expect(JSON.stringify(publicShape)).not.toContain('secret-rule-id');
      for (const l of publicShape.lines) expect(l).not.toHaveProperty('ruleId');
    });

    it('carries no operator identity and no price', () => {
      const b = resolve([rule()]);
      for (const key of Object.keys(b)) {
        expect(key).not.toMatch(/price|createdBy|actor|rate$/i);
      }
    });

    it('versions the ruleset so a quote can be traced to a revision', () => {
      const first = resolve([rule({ rateBps: 100 })]);
      const same = resolve([rule({ rateBps: 100 })]);
      const changed = resolve([rule({ rateBps: 200 })]);
      expect(first.rulesetVersion).toBe(same.rulesetVersion);
      expect(first.rulesetVersion).not.toBe(changed.rulesetVersion);
    });
  });

  it('orders lines deterministically regardless of row order', () => {
    const rules = [
      rule({ id: 'c', kind: 'correnthian' }),
      rule({ id: 'p', kind: 'provider' }),
      rule({ id: 'n', kind: 'network' }),
    ];
    const forward = resolve(rules).lines.map((l) => l.kind);
    const reversed = resolve([...rules].reverse()).lines.map((l) => l.kind);
    expect(forward).toEqual(['network', 'provider', 'correnthian']);
    expect(reversed).toEqual(forward);
  });

  it('scopes the notional correctly: absent in, absent out', () => {
    const b = resolve([rule({ basis: 'fixed', rateBps: null, fixedUsd: '1.00000000' })], {
      ...QUERY, notional: null,
    });
    // No notional was stated, and the breakdown says so rather than implying
    // a notional of zero.
    expect(b.notionalUsd).toBeNull();
    expect(b.lines.find((l) => l.kind === 'correnthian')?.amountUsd).toBe('1.00000000');
  });
});
