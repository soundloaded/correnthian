import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Onramp over HTTP — BE-1702 batch B.
 *
 * No provider is contracted, so every refusal here is the honest one: the
 * public availability check answers unavailable with a reason, and a quote
 * is 503 rather than a fabricated rate. A malformed quote is 422 from the
 * shape pipe before any provider logic runs.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const SLUG = `n-spec-${process.pid}`;

describe.skipIf(!HAS_DB && !CI)('onramp refuses without a provider over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let assetId = '';

  const post = (path: string, body: unknown, auth?: string) => {
    const req = request(app.getHttpServer()).post(`/api/v1${path}`).send(body as object);
    return auth ? req.set('Authorization', `Bearer ${auth}`) : req;
  };

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/3`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const email = `n-spec-${process.pid}@example.test`;
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct-horse-battery-staple' });
    expect(reg.status).toBe(201);
    customerToken = reg.body.token;

    const compEmail = `n-spec-c-${process.pid}@example.test`;
    const compReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: compEmail, password: 'correct-horse-battery-staple' });
    expect(compReg.status).toBe(201);
    const compUser = await prisma.user.findUniqueOrThrow({ where: { email: compEmail } });
    await prisma.user.update({ where: { id: compUser.id }, data: { role: 'compliance' } });
    const complianceToken = compReg.body.token as string;

    const authed = (path: string, body: unknown) =>
      request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', `Bearer ${complianceToken}`).send(body as object);
    const issuer = await authed('/issuers', { slug: SLUG, name: 'Ramp Mint', jurisdiction: 'US' });
    expect(issuer.status, JSON.stringify(issuer.body)).toBe(201);
    const asset = await authed('/assets', {
      chainId: '1', contractAddress: `0x${'7'.repeat(32)}${process.pid.toString(16).padStart(8, '0')}`,
      symbol: `NP${process.pid % 100000}`, name: 'Ramp Token', decimals: 18,
      category: 'metal', issuerId: SLUG, custodyModel: 'allocated',
    });
    expect(asset.status, JSON.stringify(asset.body)).toBe(201);
    assetId = asset.body.asset.assetId as string;
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.assetPrice.deleteMany({ where: { asset: { assetId } } });
      await prisma.asset.deleteMany({ where: { assetId } });
      await prisma.issuer.deleteMany({ where: { slug: SLUG } });
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'n-spec-' } },
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
    if (CI && !HAS_DB) throw new Error('Onramp refusal cannot skip in CI.');
    expect(assetId).not.toBe('');
  });

  it('availability is public and answers unavailable with a reason', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/onramp/availability?direction=buy&country=US');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(typeof res.body.reason).toBe('string');
  });

  it('a quote without a provider is 503, never a rate', async () => {
    const res = await post('/onramp/quote', { assetId, amountUsd: 100, country: 'US' }, customerToken);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('rate');
  });

  it('a quote requires a session and a well-formed body', async () => {
    expect((await post('/onramp/quote', { assetId, amountUsd: 100 })).status).toBe(401);
    expect((await post('/onramp/quote', { assetId, amountUsd: -5 }, customerToken)).status).toBe(422);
  });
});
