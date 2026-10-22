import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FakeVerificationFetch } from '../src/issuers/fake-verification-fetch.js';
import { VERIFICATION_FETCH } from '../src/issuers/verification-fetch.js';

/**
 * Issuers over HTTP — BE-1702 batch A.
 *
 * The whole read surface is support-and-up (a customer sees nothing — the
 * issuer registry is operator tooling), every write is compliance. New
 * issuers are born unverified with no promotion path except the tier route,
 * and issuer-verified without licence evidence plus custodian plus
 * proof-of-reserves is a 400, not a badge.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const SLUG = `i-spec-${process.pid}`;

/**
 * The proof URLs this suite scripts.
 *
 * The promotion workflow fetches the proof URL the operator cited, so the
 * suite says which ones answer. An unscripted URL does not answer — the
 * same fail-closed rule the production check follows, so a test cannot
 * pass by pointing at a URL nothing was told about.
 */
const LIVE_PROOF = 'https://example.test/por.pdf';
const DEAD_PROOF = 'https://dead.example.test/por.pdf';

describe.skipIf(!HAS_DB && !CI)('issuers enforce registry roles over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let supportToken = '';
  let complianceToken = '';

  const post = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);
  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);
  const patch = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).patch(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);
  const del = (path: string, auth: string) =>
    request(app.getHttpServer()).delete(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/5`;

    // The proof-URL fetch is replaced: a suite that reached the internet
    // would be asserting that the internet works, not that the workflow
    // refuses a dead link.
    const fetch = new FakeVerificationFetch();
    fetch.live(LIVE_PROOF);
    fetch.erroring(DEAD_PROOF, 404);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VERIFICATION_FETCH)
      .useValue(fetch.fetch)
      .compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const mkUser = async (tag: string, role?: 'support' | 'compliance') => {
      const email = `i-spec-${tag}-${process.pid}@example.test`;
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'correct-horse-battery-staple' });
      expect(reg.status).toBe(201);
      if (role) {
        const user = await prisma.user.findUniqueOrThrow({ where: { email } });
        await prisma.user.update({ where: { id: user.id }, data: { role } });
      }
      return reg.body.token as string;
    };
    customerToken = await mkUser('customer');
    supportToken = await mkUser('support', 'support');
    complianceToken = await mkUser('compliance', 'compliance');

    const created = await post(
      '/issuers',
      { slug: SLUG, name: 'Spec Mint', jurisdiction: 'US' },
      complianceToken,
    );
    expect(created.status, JSON.stringify(created.body)).toBe(201);
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      // The assets go first: they carry a foreign key to the issuer, so
      // deleting the issuer with assets still attached is refused.
      await prisma.asset.deleteMany({ where: { issuer: { slug: SLUG } } });
      await prisma.issuer.deleteMany({ where: { slug: SLUG } });
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'i-spec-' } },
        select: { id: true },
      });
      const ids = users.map((u) => u.id);
      if (ids.length > 0) {
        await prisma.session.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    }
    await app?.close();
    delete process.env['RATE_LIMIT_MAX_REQUESTS'];
    delete process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'];
    delete process.env['REDIS_URL'];
  });

  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) throw new Error('Issuer roles cannot skip in CI.');
    expect(complianceToken).not.toBe('');
  });

  it('support reads, a customer sees nothing', async () => {
    expect((await get('/issuers', supportToken)).status).toBe(200);
    expect((await get(`/issuers/${SLUG}`, supportToken)).status).toBe(200);
    expect((await get('/issuers', customerToken)).status).toBe(403);
    expect((await get(`/issuers/${SLUG}`, customerToken)).status).toBe(403);
  });

  it('unknown slugs are 404', async () => {
    expect((await get('/issuers/no-such-mint', supportToken)).status).toBe(404);
    expect(
      (await patch('/issuers/no-such-mint/risk-flags', { flag: 'audit-overdue' }, complianceToken)).status,
    ).toBe(404);
  });

  it('registration is compliance-only and born unverified', async () => {
    const denied = await post('/issuers', { slug: `i-denied-${process.pid}`, name: 'Nope', jurisdiction: 'US' }, customerToken);
    expect(denied.status).toBe(403);

    const duplicate = await post('/issuers', { slug: SLUG, name: 'Again', jurisdiction: 'US' }, complianceToken);
    expect(duplicate.status).toBe(409);

    const detail = await get(`/issuers/${SLUG}`, supportToken);
    expect(detail.body.verifiedTier).toBe('unverified');
  });

  it('issuer-verified without evidence is a 400, with evidence it lands', async () => {
    // No reason: the tier change owes the trail a why, and the edge
    // refuses before anything is written.
    const noReason = await patch(
      `/issuers/${SLUG}/verification`,
      { tier: 'community_verified' },
      complianceToken,
    );
    expect(noReason.status).toBe(400);

    const bare = await patch(
      `/issuers/${SLUG}/verification`,
      { tier: 'issuer_verified', reason: 'spec: bare tier must not land' },
      complianceToken,
    );
    expect(bare.status).toBe(400);

    const licences = await patch(
      `/issuers/${SLUG}/licences`,
      { licenseTypes: ['trust-charter'], licenseRefs: ['ref-1'] },
      complianceToken,
    );
    expect(licences.status).toBe(200);

    // The attestation half needs an asset to be fresh about. An issuer
    // with no assets has no attestation to be fresh, so plant one and
    // attest it — through the routes, because the suite tests the wire,
    // not the tables underneath it.
    const created = await post(
      '/assets',
      {
        chainId: '1',
        contractAddress: `0x${'d'.repeat(32)}${process.pid.toString(16).padStart(8, '0')}`,
        symbol: `VRFY${process.pid % 100000}`,
        name: 'Spec Verified Gold',
        decimals: 18,
        category: 'metal',
        issuerId: SLUG,
        custodyModel: 'allocated',
      },
      complianceToken,
    );
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const attested = await patch(
      `/assets/${encodeURIComponent(created.body.asset.assetId)}/attestation`,
      { attestedAt: new Date().toISOString(), proofUrl: LIVE_PROOF },
      complianceToken,
    );
    expect(attested.status, JSON.stringify(attested.body)).toBe(200);

    // Presence satisfied, but the cited page is dead. A tier that points
    // nowhere is a tier with no basis — the workflow says so rather than
    // waving it through.
    const dead = await patch(
      `/issuers/${SLUG}/verification`,
      {
        tier: 'issuer_verified',
        custodian: 'Spec Vault',
        proofOfReserves: DEAD_PROOF,
        reason: 'spec: dead proof URL must not verify',
      },
      complianceToken,
    );
    expect(dead.status, JSON.stringify(dead.body)).toBe(400);
    expect(JSON.stringify(dead.body)).toContain('proof-urls-reachable');

    const verified = await patch(
      `/issuers/${SLUG}/verification`,
      {
        tier: 'issuer_verified',
        custodian: 'Spec Vault',
        proofOfReserves: LIVE_PROOF,
        reason: 'spec: complete evidence lands the tier',
      },
      complianceToken,
    );
    expect(verified.status, JSON.stringify(verified.body)).toBe(200);
    expect(verified.body.verifiedTier).toBe('issuer_verified');
  });

  it('the checks preview reads before anyone decides, and a flag detaches cleanly', async () => {
    // The console renders this before the operator promotes, so "promote"
    // is never the first time anyone looked. Same evaluation the tier
    // change enforces, without enforcing it.
    const preview = await get(
      `/issuers/${SLUG}/verification-checks?custodian=${encodeURIComponent('Spec Vault')}&proofOfReserves=${encodeURIComponent(LIVE_PROOF)}`,
      supportToken,
    );
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body.passed).toBe(true);
    expect(preview.body.checks.map((c: { name: string }) => c.name).sort()).toEqual([
      'attestation-fresh',
      'licences-recorded',
      'proof-urls-reachable',
    ]);

    const flagged = await patch(`/issuers/${SLUG}/risk-flags`, { flag: 'audit-overdue' }, complianceToken);
    expect(flagged.status).toBe(200);
  });

  it('a risk flag attaches and reads back on the detail, and detaches cleanly', async () => {
    const flagged = await patch(`/issuers/${SLUG}/risk-flags`, { flag: 'audit-overdue' }, complianceToken);
    expect(flagged.status).toBe(200);

    const detail = await get(`/issuers/${SLUG}`, supportToken);
    expect(JSON.stringify(detail.body)).toContain('audit-overdue');

    // Detach: the flag leaves the issuer and stops propagating. A ratchet
    // that can only add is a registry that can only get scarier.
    const removed = await del(`/issuers/${SLUG}/risk-flags/audit-overdue`, complianceToken);
    expect(removed.status).toBe(200);

    const clean = await get(`/issuers/${SLUG}`, supportToken);
    expect(JSON.stringify(clean.body)).not.toContain('audit-overdue');

    // Removing what is not there is a no-op, not a 404: the end state —
    // flag absent — is already true.
    const again = await del(`/issuers/${SLUG}/risk-flags/audit-overdue`, complianceToken);
    expect(again.status).toBe(200);
  });
});
