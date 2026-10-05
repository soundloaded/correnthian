import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IssuersService } from './issuers.service.js';

const actor = { id: 'a1', role: 'compliance' };

describe('IssuersService', () => {
  let issuer: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let asset: { updateMany: ReturnType<typeof vi.fn> };
  let svc: IssuersService;

  const existing = (over: Record<string, unknown> = {}) => ({
    id: 'i1', slug: 'paxos', name: 'Paxos', jurisdiction: 'US-NY',
    licenseTypes: ['trust-company'], licenseRefs: ['nydfs-1'],
    verifiedTier: 'unverified', riskFlags: [], ...over,
  });

  beforeEach(() => {
    issuer = { findUnique: vi.fn().mockResolvedValue(existing()), update: vi.fn().mockResolvedValue(existing()) };
    asset = { updateMany: vi.fn().mockResolvedValue({ count: 0 }) };
    svc = new IssuersService(
      { issuer, asset } as never,
      { record: vi.fn() } as never,
    );
  });

  it('refuses issuer-verified without a custodian', async () => {
    await expect(svc.setVerifiedTier('paxos', 'issuer_verified', { proofOfReserves: 'x' }, actor))
      .rejects.toThrow(/custodian/);
  });

  it('refuses issuer-verified without proof of reserves', async () => {
    await expect(svc.setVerifiedTier('paxos', 'issuer_verified', { custodian: 'Brink' }, actor))
      .rejects.toThrow(/proofOfReserves/);
  });

  it('refuses issuer-verified when the issuer has no licences recorded', async () => {
    issuer.findUnique.mockResolvedValue(existing({ licenseTypes: [], licenseRefs: [] }));
    await expect(
      svc.setVerifiedTier('paxos', 'issuer_verified', { custodian: 'B', proofOfReserves: 'u' }, actor),
    ).rejects.toThrow(/licenseTypes, licenseRefs/);
  });

  it('allows issuer-verified with complete evidence', async () => {
    await expect(
      svc.setVerifiedTier('paxos', 'issuer_verified', { custodian: 'Brink', proofOfReserves: 'u' }, actor),
    ).resolves.toBeDefined();
  });

  it('allows community-verified without full evidence — it claims less', async () => {
    await expect(svc.setVerifiedTier('paxos', 'community_verified', {}, actor)).resolves.toBeDefined();
  });

  it('propagates the tier to every asset the issuer stands behind', async () => {
    await svc.setVerifiedTier('paxos', 'issuer_verified', { custodian: 'B', proofOfReserves: 'u' }, actor);
    expect(asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ verifiedTier: 'issuer_verified' }) }),
    );
  });

  it('rejects a malformed slug', async () => {
    await expect(
      svc.create({ slug: 'Not A Slug!', name: 'x', jurisdiction: 'us', licenseTypes: [], licenseRefs: [] }, actor),
    ).rejects.toThrow(/lowercase alphanumeric/);
  });

  it('normalises jurisdiction to uppercase', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'i2' });
    // No existing issuer with this slug.
    const findUnique = vi.fn().mockResolvedValue(null);
    const s2 = new IssuersService(
      { issuer: { ...issuer, findUnique, create }, asset } as never,
      { record: vi.fn() } as never,
    );
    await s2.create({ slug: 'acme', name: 'Acme', jurisdiction: 'gb', licenseTypes: [], licenseRefs: [] }, actor);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ jurisdiction: 'GB', verifiedTier: 'unverified' }),
    }));
  });
});
