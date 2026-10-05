import { describe, expect, it } from 'vitest';
import { selectRail, type SwapRail, RAIL_PREFERENCE } from '../index.js';
import type { AssetRef, RailKind } from '@correnthian/types';

const gold: AssetRef = { chainId: 1, contractAddress: '0xg0ld', issuerId: 'paxos' };
const usdt: AssetRef = { chainId: 1, contractAddress: '0xu5dt', issuerId: 'tether' };

const rail = (id: string, kind: RailKind, supports = true): SwapRail => ({
  id, kind,
  supports: () => supports,
  quote: async () => { throw new Error('not used'); },
  status: async () => { throw new Error('not used'); },
});

describe('selectRail', () => {
  it('prefers the provider rail over the dex regardless of registration order', () => {
    const chosen = selectRail([rail('dex', 'dex'), rail('provider', 'provider')], usdt, gold);
    expect(chosen?.id).toBe('provider');
  });

  it('falls back to the dex when no provider supports the pair', () => {
    const chosen = selectRail([rail('dex', 'dex'), rail('provider', 'provider', false)], usdt, gold);
    expect(chosen?.id).toBe('dex');
  });

  it('prefers the dex over the cex, which weakens the key boundary', () => {
    const chosen = selectRail([rail('cex', 'cex'), rail('dex', 'dex')], usdt, gold);
    expect(chosen?.id).toBe('dex');
  });

  it('returns undefined when nothing supports the pair', () => {
    expect(selectRail([rail('dex', 'dex', false)], usdt, gold)).toBeUndefined();
  });

  it('does not mutate the caller-supplied array', () => {
    const rails = [rail('dex', 'dex'), rail('provider', 'provider')];
    const before = rails.map((r) => r.id);
    selectRail(rails, usdt, gold);
    expect(rails.map((r) => r.id)).toEqual(before);
  });

  it('ranks every declared rail kind', () => {
    expect([...RAIL_PREFERENCE].sort()).toHaveLength(4);
  });
});
