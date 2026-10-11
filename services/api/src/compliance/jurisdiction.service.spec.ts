import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JurisdictionService } from './jurisdiction.service.js';

const rule = (over: Record<string, unknown> = {}) => ({
  country: 'US', region: null, canBuyCrypto: true, canSellCrypto: true,
  canUseMetals: false, canRedeem: false, kycRequired: true,
  blockedProviders: [], notes: null, active: true, ...over,
});

describe('JurisdictionService', () => {
  let findUnique: ReturnType<typeof vi.fn>;
  let svc: JurisdictionService;

  beforeEach(() => {
    findUnique = vi.fn();
    svc = new JurisdictionService(
      {
        jurisdictionRule: { findUnique },
      } as never,
      { recordChange: vi.fn() } as never,
    );
  });

  it('denies an unknown country rather than allowing by omission', async () => {
    findUnique.mockResolvedValue(null);
    const e = await svc.evaluate('ZZ', null);
    expect(e.allowed).toBe(false);
    expect(e.unmatched).toBe(true);
    expect(e.canBuyCrypto).toBe(false);
  });

  it('denies when no country is supplied at all', async () => {
    const e = await svc.evaluate(null, null);
    expect(e.allowed).toBe(false);
  });

  it('prefers a region rule over the country-wide rule', async () => {
    findUnique.mockResolvedValue(rule({ region: 'US-NY', canUseMetals: true }));
    const e = await svc.evaluate('US', 'US-NY');
    expect(e.canUseMetals).toBe(true);
    expect(e.matchedRule?.region).toBe('US-NY');
  });

  it('falls back to the country rule when no region rule exists', async () => {
    // First call: region lookup misses. Second: country-wide lookup hits.
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(rule({ region: '' }));
    const e = await svc.evaluate('US', 'US-TX');
    expect(e.allowed).toBe(true);
    expect(e.matchedRule?.region).toBe('');
  });

  it('treats an inactive rule as no rule', async () => {
    findUnique.mockResolvedValue(rule({ active: false }));
    const e = await svc.evaluate('US', null);
    expect(e.allowed).toBe(false);
  });

  it('throws a 451 when the action is not permitted there', async () => {
    findUnique.mockResolvedValue(rule({ canUseMetals: false }));
    await expect(svc.assertEligible('US', null, 'metals')).rejects.toThrow(/jurisdiction/i);
  });

  it('reports a blocked provider for the location', async () => {
    findUnique.mockResolvedValue(rule({ blockedProviders: ['some-kyc-vendor'] }));
    expect(await svc.isProviderBlocked('US', null, 'some-kyc-vendor')).toBe(true);
    expect(await svc.isProviderBlocked('US', null, 'other')).toBe(false);
  });
});
