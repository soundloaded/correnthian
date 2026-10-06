import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedemptionService } from './redemption.service.js';

const metal = (over: Record<string, unknown> = {}) => ({
  id: 'a1', assetId: '1:0xabc:issuer', symbol: 'PAXG', name: 'Paxos Gold',
  enabled: true, redeemSupported: true, ...over,
});

describe('RedemptionService.request', () => {
  let asset: { findUnique: ReturnType<typeof vi.fn> };
  let provider: { findUnique: ReturnType<typeof vi.fn> };
  let user: { findUnique: ReturnType<typeof vi.fn> };
  let create: ReturnType<typeof vi.fn>;
  let jurisdiction: { assertEligible: ReturnType<typeof vi.fn>; isProviderBlocked: ReturnType<typeof vi.fn> };
  let svc: RedemptionService;

  beforeEach(() => {
    asset = { findUnique: vi.fn().mockResolvedValue(metal()) };
    provider = { findUnique: vi.fn().mockResolvedValue({ id: 'p1', slug: 'p', status: 'active' }) };
    // The jurisdiction is read off the account record, not off the request.
    // See the tests below that turn that into a rule rather than a habit.
    user = { findUnique: vi.fn().mockResolvedValue({ country: 'US', region: 'US-CA' }) };
    create = vi.fn().mockResolvedValue({ id: 'r1' });
    jurisdiction = { assertEligible: vi.fn(), isProviderBlocked: vi.fn().mockResolvedValue(false) };
    svc = new RedemptionService(
      { asset, provider, user, redemptionRequest: { create } } as never,
      jurisdiction as never,
      { record: vi.fn() } as never,
    );
  });

  const input = {
    userId: 'u1', assetId: '1:0xabc:issuer', amountRaw: '10', providerSlug: 'p',
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
    expect(jurisdiction.assertEligible).toHaveBeenCalledWith('US', 'US-CA', 'redeem');
  });

  it('takes jurisdiction from the account record, never from the request', async () => {
    // `RedemptionRequestInput` has no country or region field at all, so the
    // account is the only place the value can come from. If a caller ever
    // reintroduces one, this fails on the resolved values rather than on a
    // type error nobody runs.
    await svc.request(input);
    expect(user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { country: true, region: true },
    });
    expect(jurisdiction.assertEligible).toHaveBeenCalledWith('US', 'US-CA', 'redeem');
  });

  it('refuses an account with no recorded jurisdiction rather than guessing', async () => {
    user.findUnique.mockResolvedValue({ country: null, region: null });
    await expect(svc.request(input)).rejects.toThrow(/Add a country to your account/);
    expect(jurisdiction.assertEligible).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses when the account row is missing, the same as when country is', async () => {
    user.findUnique.mockResolvedValue(null);
    await expect(svc.request(input)).rejects.toThrow(/Add a country to your account/);
    expect(create).not.toHaveBeenCalled();
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
  const build = (state: string) => {
    const update = vi.fn().mockResolvedValue({ id: 'r1' });
    const svc = new RedemptionService(
      {
        redemptionRequest: {
          findUnique: vi.fn().mockResolvedValue({ id: 'r1', state }),
          update,
        },
      } as never,
      {} as never,
      { record: vi.fn() } as never,
    );
    return { svc, update };
  };
  const svc = (state: string) => build(state).svc;

  it('allows requested -> approved', async () => {
    await expect(svc('requested').transition('r1', 'approved', { id: 'a', role: 'compliance' }))
      .resolves.toBeDefined();
  });

  it('records who approved, on the row and not only in the audit line', async () => {
    const { svc: one, update } = build('requested');
    await one.transition('r1', 'approved', { id: 'op-7', role: 'compliance' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { state: 'approved', reviewedBy: 'op-7' },
    });
  });

  it('does not attribute a reviewer to a transition that is not a review', async () => {
    const { svc: one, update } = build('approved');
    await one.transition('r1', 'in_production', { id: 'op-7', role: 'compliance' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { state: 'in_production' },
    });
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
