import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

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

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/5`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
    const bare = await patch(`/issuers/${SLUG}/verification`, { tier: 'issuer_verified' }, complianceToken);
    expect(bare.status).toBe(400);

    const licences = await patch(
      `/issuers/${SLUG}/licences`,
      { licenseTypes: ['trust-charter'], licenseRefs: ['ref-1'] },
      complianceToken,
    );
    expect(licences.status).toBe(200);

    const verified = await patch(
      `/issuers/${SLUG}/verification`,
      { tier: 'issuer_verified', custodian: 'Spec Vault', proofOfReserves: 'https://example.test/por.pdf' },
      complianceToken,
    );
    expect(verified.status).toBe(200);
    expect(verified.body.verifiedTier).toBe('issuer_verified');
  });

  it('a risk flag attaches and reads back on the detail', async () => {
    const flagged = await patch(`/issuers/${SLUG}/risk-flags`, { flag: 'audit-overdue' }, complianceToken);
    expect(flagged.status).toBe(200);

    const detail = await get(`/issuers/${SLUG}`, supportToken);
    expect(JSON.stringify(detail.body)).toContain('audit-overdue');
  });
});
