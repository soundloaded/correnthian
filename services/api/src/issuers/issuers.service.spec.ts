import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IssuersService } from './issuers.service.js';
import { diffState } from '../audit/audit-diff.js';
import { assertReason } from '../audit/audit.service.js';

/**
 * What the service's audit fake does, in its own words rather than the
 * audit module's: diff before against after, and only `record` when
 * something moved. The words differ because the behaviour being pinned
 * differs — the point here is that a no-op tier write leaves no line,
 * and that pin needs the diff to actually run.
 */
const recordChangeFake = (record: { (entry: unknown): Promise<void> }) =>
  vi.fn(async (entry: { before?: unknown; after?: unknown }) => {
    const change = diffState(entry.before, entry.after);
    if (change.changed.length === 0) return change;
    await record({ ...entry, before: change.before, after: change.after });
    return change;
  });

type AnyMock = ReturnType<typeof vi.fn>;

const auditFake = (record: AnyMock) => ({
  record,
  recordChange: recordChangeFake(record as unknown as { (entry: unknown): Promise<void> }),
  assertReason,
});

// The tier change owes the trail a reason, so the actor carries one.
const actor = { id: 'a1', role: 'compliance', reason: 'spec: tier change' };

describe('IssuersService', () => {
  let issuer: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let asset: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  let svc: IssuersService;
  let record: ReturnType<typeof vi.fn>;

  const existing = (over: Record<string, unknown> = {}) => ({
    id: 'i1', slug: 'paxos', name: 'Paxos', jurisdiction: 'US-NY',
    licenseTypes: ['trust-company'], licenseRefs: ['nydfs-1'],
    verifiedTier: 'unverified', riskFlags: [], ...over,
  });

  // The workflow fetches every asset from the issuer and every cited proof
  // URL before it promotes. The fakes answer from fixtures: no network, and
  // the URLs are never fetched for real.
  const okFetch = async () => ({ ok: true, status: 200 });
  const deadFetch = async () => ({ ok: false, status: 404 });

  beforeEach(() => {
    issuer = { findUnique: vi.fn().mockResolvedValue(existing()), update: vi.fn().mockResolvedValue(existing()) };
    asset = {
      findMany: vi.fn().mockResolvedValue([
        {
          assetId: '1:0xgold:paxos',
          symbol: 'PAXG',
          lastAttestedAt: new Date(),
          attestationCadence: 'monthly',
          proofOfReserveUrl: 'https://example.com/proof',
        },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
    };
    record = vi.fn().mockResolvedValue(undefined);
    svc = new IssuersService(
      { issuer, asset } as never,
      // The real reason rule and the real diff, not stubs that accept
      // anything: a fake here would let a tier change pass the test and
      // fail in production — or write an audit line the real code would
      // have skipped.
      auditFake(record) as never,
      okFetch,
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
      svc.setVerifiedTier(
        'paxos',
        'issuer_verified',
        { custodian: 'Brink', proofOfReserves: 'https://example.com/proof' },
        actor,
      ),
    ).resolves.toBeDefined();
  });

  it('refuses issuer-verified when the proof URL does not answer', async () => {
    // Presence is satisfied — licences, custodian, URL all cited — but the
    // cited page is dead. A tier that points nowhere is a tier with no
    // basis, and the workflow says so rather than waving it through.
    const dead = new IssuersService(
      { issuer, asset } as never,
      auditFake(record) as never,
      deadFetch,
    );
    await expect(
      dead.setVerifiedTier(
        'paxos',
        'issuer_verified',
        { custodian: 'Brink', proofOfReserves: 'https://dead.example/proof' },
        actor,
      ),
    ).rejects.toThrow(/proof-urls-reachable/);
  });

  it('refuses issuer-verified when every attestation is stale', async () => {
    asset.findMany.mockResolvedValue([
      {
        assetId: '1:0xgold:paxos',
        symbol: 'PAXG',
        lastAttestedAt: new Date(Date.now() - 400 * 24 * 60 * 60_000),
        attestationCadence: 'monthly',
        proofOfReserveUrl: 'https://example.com/proof',
      },
    ]);
    await expect(
      svc.setVerifiedTier(
        'paxos',
        'issuer_verified',
        { custodian: 'Brink', proofOfReserves: 'https://example.com/proof' },
        actor,
      ),
    ).rejects.toThrow(/attestation-fresh/);
  });

  it('records the checks behind a promotion, not just the tier', async () => {
    const checking = new IssuersService(
      { issuer, asset } as never,
      auditFake(record) as never,
      okFetch,
    );
    await checking.setVerifiedTier(
      'paxos',
      'issuer_verified',
      { custodian: 'Brink', proofOfReserves: 'https://example.com/proof' },
      actor,
    );
    expect(record).toHaveBeenCalledOnce();
    const entry = record.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
    expect(entry.metadata?.slug).toBe('paxos');
    const checks = entry.metadata?.checks as Array<{ name: string; passed: boolean }>;
    expect(checks.map((c) => c.name).sort()).toEqual([
      'attestation-fresh',
      'licences-recorded',
      'proof-urls-reachable',
    ]);
    expect(checks.every((c) => c.passed)).toBe(true);
  });

  it('allows community-verified without full evidence — it claims less', async () => {
    await expect(svc.setVerifiedTier('paxos', 'community_verified', {}, actor)).resolves.toBeDefined();
  });

  it('refuses a tier change with no reason, before anything is written', async () => {
    // The trail is the point of the tier: an operator who changed it
    // without saying why has left a record that reads "promoted" and
    // nothing else. The refusal comes before the write, so the tier does
    // not move and the refusal is not a half-completed change.
    await expect(
      svc.setVerifiedTier('paxos', 'community_verified', {}, { id: 'a1', role: 'compliance' }),
    ).rejects.toThrow(/reason/i);
    expect(issuer.update).not.toHaveBeenCalled();
  });

  it('propagates the tier to every asset the issuer stands behind', async () => {
    await svc.setVerifiedTier('paxos', 'issuer_verified', { custodian: 'B', proofOfReserves: 'https://example.com/proof' }, actor);
    expect(asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ verifiedTier: 'issuer_verified' }) }),
    );
  });

  describe('risk flags', () => {
    const flagged = (over: Record<string, unknown> = {}) =>
      existing({ riskFlags: ['sanctions-watch'], ...over });

    it('attaching a flag that is already there changes nothing', async () => {
      issuer.findUnique.mockResolvedValue(flagged());
      const out = await svc.addRiskFlag('paxos', 'sanctions-watch', actor);
      expect(out).toMatchObject({ slug: 'paxos' });
      expect(issuer.update).not.toHaveBeenCalled();
    });

    it('removing a flag the issuer does not carry changes nothing', async () => {
      issuer.findUnique.mockResolvedValue(existing());
      const out = await svc.removeRiskFlag('paxos', 'sanctions-watch', actor);
      expect(out).toMatchObject({ slug: 'paxos' });
      expect(issuer.update).not.toHaveBeenCalled();
    });

    it('removes the flag from the issuer and every asset that carries it', async () => {
      issuer.findUnique.mockResolvedValue(flagged());
      asset.findMany = vi.fn().mockResolvedValue([
        { id: 'a1', riskFlags: ['sanctions-watch', 'other'] },
        { id: 'a2', riskFlags: ['other'] },
      ]);
      asset.update = vi.fn().mockResolvedValue({});
      await svc.removeRiskFlag('paxos', 'sanctions-watch', actor);
      expect(issuer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ riskFlags: [] }) }),
      );
      expect(asset.update).toHaveBeenCalledTimes(1);
      expect(asset.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ riskFlags: ['other'] }) }),
      );
    });
  });

  describe('recordLicences', () => {
    it('clears evidence when given an explicit empty array', async () => {
      await svc.recordLicences('paxos', { licenseTypes: [], licenseRefs: [] }, actor);
      expect(issuer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ licenseTypes: [], licenseRefs: [] }),
        }),
      );
    });

    it('downgrades the tier when its evidence is removed', async () => {
      // A verified issuer that loses its licence evidence must not keep the
      // badge — otherwise "verified" outlives its basis.
      issuer.findUnique.mockResolvedValue(existing({ verifiedTier: 'issuer_verified' }));
      await svc.recordLicences('paxos', { licenseTypes: [], licenseRefs: [] }, actor);
      expect(issuer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ verifiedTier: 'unverified' }),
        }),
      );
    });

    it('leaves licences alone when the fields are omitted', async () => {
      issuer.findUnique.mockResolvedValue(existing());
      await svc.recordLicences('paxos', { notes: 'updated only' }, actor);
      const call = issuer.update.mock.calls[0];
      expect(call).toBeDefined();
      const data = call?.[0]?.data ?? {};
      expect(data.licenseTypes).toEqual(existing().licenseTypes);
      expect(data.licenseRefs).toEqual(existing().licenseRefs);
    });

    it('propagates the downgrade to every asset from that issuer', async () => {
      issuer.findUnique.mockResolvedValue(existing({ verifiedTier: 'issuer_verified' }));
      await svc.recordLicences('paxos', { licenseTypes: [], licenseRefs: [] }, actor);
      expect(asset.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { verifiedTier: 'unverified' } }),
      );
    });
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
      auditFake(record) as never,
      okFetch,
    );
    await s2.create({ slug: 'acme', name: 'Acme', jurisdiction: 'gb', licenseTypes: [], licenseRefs: [] }, actor);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ jurisdiction: 'GB', verifiedTier: 'unverified' }),
    }));
  });
});
