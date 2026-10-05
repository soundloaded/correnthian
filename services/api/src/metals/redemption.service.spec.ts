import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedemptionService } from './redemption.service.js';

const metal = (over: Record<string, unknown> = {}) => ({
  id: 'a1', assetId: '1:0xabc:issuer', symbol: 'PAXG', name: 'Paxos Gold',
  enabled: true, redeemSupported: true, ...over,
});

describe('RedemptionService.request', () => {
  let asset: { findUnique: ReturnType<typeof vi.fn> };
  let provider: { findUnique: ReturnType<typeof vi.fn> };
  let create: ReturnType<typeof vi.fn>;
  let jurisdiction: { assertEligible: ReturnType<typeof vi.fn>; isProviderBlocked: ReturnType<typeof vi.fn> };
  let svc: RedemptionService;

  beforeEach(() => {
    asset = { findUnique: vi.fn().mockResolvedValue(metal()) };
    provider = { findUnique: vi.fn().mockResolvedValue({ id: 'p1', slug: 'p', status: 'active' }) };
    create = vi.fn().mockResolvedValue({ id: 'r1' });
    jurisdiction = { assertEligible: vi.fn(), isProviderBlocked: vi.fn().mockResolvedValue(false) };
    svc = new RedemptionService(
      { asset, provider, redemptionRequest: { create } } as never,
      jurisdiction as never,
      { record: vi.fn() } as never,
    );
  });

  const input = {
    userId: 'u1', assetId: '1:0xabc:issuer', amountRaw: '10',
    country: 'US', region: null, providerSlug: 'p',
  };

  it('refuses a token that cannot be redeemed, whatever the request says', async () => {
    asset.findUnique.mockResolvedValue(metal({ redeemSupported: false }));
    await expect(svc.request(input)).rejects.toThrow(/cannot be redeemed/);
  });

  it('refuses a disabled asset', async () => {
    asset.findUnique.mockResolvedValue(metal({ enabled: false }));
    await expect(svc.request(input)).rejects.toThrow(/not currently enabled/);
  });

  it('checks redemption eligibility, not just buy/sell', async () => {
    await svc.request(input);
    expect(jurisdiction.assertEligible).toHaveBeenCalledWith('US', null, 'redeem');
  });

  it('refuses when the jurisdiction blocks redemption', async () => {
    jurisdiction.assertEligible.mockRejectedValue(new Error('Not permitted in your jurisdiction.'));
    await expect(svc.request(input)).rejects.toThrow(/jurisdiction/);
  });

  it('refuses a provider blocked in that jurisdiction', async () => {
    jurisdiction.isProviderBlocked.mockResolvedValue(true);
    await expect(svc.request(input)).rejects.toThrow(/not available in your jurisdiction/);
  });

  it('rejects a non-positive amount', async () => {
    await expect(svc.request({ ...input, amountRaw: '-5' })).rejects.toThrow(/positive decimal/);
  });

  it('never auto-approves: a new request starts at "requested"', async () => {
    await svc.request(input);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'requested' }) }),
    );
  });
});

describe('RedemptionService.transition', () => {
  const svc = (state: string) =>
    new RedemptionService(
      {
        redemptionRequest: {
          findUnique: vi.fn().mockResolvedValue({ id: 'r1', state }),
          update: vi.fn().mockResolvedValue({ id: 'r1' }),
        },
      } as never,
      {} as never,
      { record: vi.fn() } as never,
    );

  it('allows requested -> approved', async () => {
    await expect(svc('requested').transition('r1', 'approved', { id: 'a', role: 'compliance' }))
      .resolves.toBeDefined();
  });

  it('refuses to skip straight from requested to delivered', async () => {
    await expect(svc('requested').transition('r1', 'delivered', { id: 'a', role: 'admin' }))
      .rejects.toThrow(/Cannot move a redemption/);
  });

  it('treats a delivered request as terminal', async () => {
    await expect(svc('delivered').transition('r1', 'in_production', { id: 'a', role: 'admin' }))
      .rejects.toThrow(/Cannot move a redemption/);
  });
});
