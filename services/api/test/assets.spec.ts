import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Assets over HTTP — BE-1702 batch A.
 *
 * Reads are any-session (a customer sees the registry — disclosure is the
 * product), writes split by role: compliance registers and attests, only
 * admin enables/disables. Unknown assets are 404 on every verb; malformed
 * bodies are 422 from the shape pipe before any service rule runs.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const SLUG = `a-spec-${process.pid}`;
const ADDR = `0x${'c'.repeat(32)}${process.pid.toString(16).padStart(8, '0')}`;

describe.skipIf(!HAS_DB && !CI)('assets enforce registry roles over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let complianceToken = '';
  let adminToken = '';
  let assetId = '';

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
      const email = `a-spec-${tag}-${process.pid}@example.test`;
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
    complianceToken = await mkUser('compliance', 'compliance');

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: process.env.CONTRACT_TEST_EMAIL ?? 'admin@correnthian.local',
        password: process.env.CONTRACT_TEST_PASSWORD ?? 'correct-horse-battery-staple',
      });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    adminToken = login.body.token;

    const issuer = await post(
      '/issuers',
      { slug: SLUG, name: 'Spec Mint', jurisdiction: 'US' },
      complianceToken,
    );
    expect(issuer.status, JSON.stringify(issuer.body)).toBe(201);

    const created = await post(
      '/assets',
      {
        chainId: '1', contractAddress: ADDR, symbol: `TST${process.pid % 100000}`,
        name: 'Spec Gold', decimals: 18, category: 'metal', issuerId: SLUG,
        custodyModel: 'allocated',
      },
      complianceToken,
    );
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    assetId = created.body.asset.assetId as string;
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.assetPrice.deleteMany({ where: { asset: { assetId } } });
      await prisma.asset.deleteMany({ where: { assetId } });
      await prisma.issuer.deleteMany({ where: { slug: SLUG } });
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'a-spec-' } },
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
    if (CI && !HAS_DB) throw new Error('Asset roles cannot skip in CI.');
    expect(assetId).not.toBe('');
  });

  it('a customer reads the registry and the detail, including disclosure', async () => {
    const list = await get('/assets?limit=5', customerToken);
    expect(list.status).toBe(200);

    const one = await get(`/assets/${encodeURIComponent(assetId)}`, customerToken);
    expect(one.status).toBe(200);
    expect(typeof one.body.disclosure).toBe('string');
  });

  it('unknown assets are 404 on every verb', async () => {
    expect((await get('/assets/nope:0x0:nope', customerToken)).status).toBe(404);
    expect(
      (await patch('/assets/nope:0x0:nope/attestation', { attestedAt: new Date().toISOString() }, complianceToken)).status,
    ).toBe(404);
    expect((await patch('/assets/nope:0x0:nope/enabled', { enabled: false }, adminToken)).status).toBe(404);
  });

  it('only compliance attests: a customer is refused and nothing changes', async () => {
    const denied = await patch(
      `/assets/${encodeURIComponent(assetId)}/attestation`,
      { attestedAt: new Date().toISOString() },
      customerToken,
    );
    expect(denied.status).toBe(403);

    const ok = await patch(
      `/assets/${encodeURIComponent(assetId)}/attestation`,
      { attestedAt: '2026-10-01T00:00:00.000Z', proofUrl: 'https://example.test/attestation.pdf' },
      complianceToken,
    );
    expect(ok.status).toBe(200);
  });

  it('only admin enables/disables: compliance is refused', async () => {
    const denied = await patch(`/assets/${encodeURIComponent(assetId)}/enabled`, { enabled: false }, complianceToken);
    expect(denied.status).toBe(403);

    const disabled = await patch(`/assets/${encodeURIComponent(assetId)}/enabled`, { enabled: false }, adminToken);
    expect(disabled.status).toBe(200);
    expect(disabled.body.asset.enabled).toBe(false);

    const reenabled = await patch(`/assets/${encodeURIComponent(assetId)}/enabled`, { enabled: true }, adminToken);
    expect(reenabled.body.asset.enabled).toBe(true);
  });

  it('malformed bodies are 422 before any service rule runs', async () => {
    // Missing every required field: the shape pipe answers, not the service.
    expect((await post('/assets', { symbol: 'X' }, complianceToken)).status).toBe(422);
    // z.coerce.date() cannot parse this — 422, not a stored attestation.
    expect(
      (await patch(`/assets/${encodeURIComponent(assetId)}/attestation`, { attestedAt: 'not-a-date' }, complianceToken))
        .status,
    ).toBe(422);
  });
});
