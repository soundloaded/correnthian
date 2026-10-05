import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnRampService } from './onramp.service.js';

describe('OnRampService', () => {
  let prisma: { provider: { findMany: ReturnType<typeof vi.fn> }; asset: { findUnique: ReturnType<typeof vi.fn> } };
  let jurisdiction: {
    evaluate: ReturnType<typeof vi.fn>;
    isProviderBlocked: ReturnType<typeof vi.fn>;
  };
  let svc: OnRampService;

  beforeEach(() => {
    prisma = {
      provider: { findMany: vi.fn().mockResolvedValue([]) },
      asset: { findUnique: vi.fn() },
    };
    jurisdiction = {
      evaluate: vi.fn().mockResolvedValue({
        allowed: true, canBuyCrypto: true, canSellCrypto: false, canUseMetals: true, canRedeem: false,
      }),
      isProviderBlocked: vi.fn().mockResolvedValue(false),
    };
    svc = new OnRampService(prisma as never, jurisdiction as never);
  });

  it('refuses rather than inventing a rate when no provider is contracted', async () => {
    const reason = await svc.unavailability('buy', 'US', null);
    expect(reason).toMatch(/has not contracted one yet/);
  });

  it('rejects a non-positive amount before touching the provider', async () => {
    await expect(svc.quote('buy', { assetId: 'a', amountUsd: 0, country: 'US', region: null }))
      .rejects.toThrow(/positive number/);
  });

  it('distinguishes buying from selling permission', async () => {
    prisma.provider.findMany.mockResolvedValue([{ slug: 'p', name: 'P', status: 'active' }]);
    const reason = await svc.unavailability('sell', 'US', null);
    expect(reason).toMatch(/not permitted in your jurisdiction/);
  });

  it('reports unavailable in an unmatched jurisdiction', async () => {
    jurisdiction.evaluate.mockResolvedValue({ allowed: false, canBuyCrypto: false, canSellCrypto: false });
    prisma.provider.findMany.mockResolvedValue([{ slug: 'p', name: 'P', status: 'active' }]);
    const reason = await svc.unavailability('buy', 'ZZ', null);
    expect(reason).toMatch(/not available in your jurisdiction/);
  });

  it('skips a provider blocked in the user jurisdiction', async () => {
    prisma.provider.findMany.mockResolvedValue([
      { slug: 'blocked', name: 'B', status: 'active' },
      { slug: 'ok', name: 'O', status: 'active' },
    ]);
    jurisdiction.isProviderBlocked.mockImplementation(async (_c, _r, slug) => slug === 'blocked');
    await expect(svc.unavailability('buy', 'US', null)).resolves.toBeNull();
  });

  it('returns null when a provider can serve the request', async () => {
    prisma.provider.findMany.mockResolvedValue([{ slug: 'p', name: 'P', status: 'active' }]);
    await expect(svc.unavailability('buy', 'US', null)).resolves.toBeNull();
  });
});
