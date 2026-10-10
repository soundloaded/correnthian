import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Pricing over HTTP — BE-1702 batch A.
 *
 * Reads are any-session (prices are reference data), recording is
 * support-and-up. Recording against an unknown asset is 404, a
 * non-positive price is 422 from the shape pipe, and history is scoped to
 * the asset in the path — a price recorded for one asset never appears in
 * another's history.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const SLUG = `r-spec-${process.pid}`;

describe.skipIf(!HAS_DB && !CI)('pricing enforces record roles over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let supportToken = '';
  let assetA = '';
  let assetB = '';

  const post = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);
  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);

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
      const email = `r-spec-${tag}-${process.pid}@example.test`;
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

    // Pricing specs own their fixtures: recording needs registry assets, and
    // sharing another suite's rows would couple the batches.
    const issuer = await post('/issuers', { slug: SLUG, name: 'Price Mint', jurisdiction: 'US' }, supportToken);
    // Issuer registration is compliance-only — support is refused here, which
    // is itself the role edge. Escalate one session to compliance for setup.
    expect(issuer.status).toBe(403);
    const complianceEmail = `r-spec-compliance-${process.pid}@example.test`;
    const compReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: complianceEmail, password: 'correct-horse-battery-staple' });
    expect(compReg.status).toBe(201);
    const compUser = await prisma.user.findUniqueOrThrow({ where: { email: complianceEmail } });
    await prisma.user.update({ where: { id: compUser.id }, data: { role: 'compliance' } });
    const complianceToken = compReg.body.token as string;

    const mkAsset = async (addrChar: string, sym: string) => {
      const res = await post(
        '/assets',
        {
          chainId: '1', contractAddress: `0x${addrChar.repeat(32)}${process.pid.toString(16).padStart(8, '0')}`,
          symbol: sym, name: 'Price Token', decimals: 18, category: 'metal',
          issuerId: SLUG, custodyModel: 'allocated',
        },
        complianceToken,
      );
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      return res.body.asset.assetId as string;
    };

    const issuerOk = await post('/issuers', { slug: SLUG, name: 'Price Mint', jurisdiction: 'US' }, complianceToken);
    expect(issuerOk.status, JSON.stringify(issuerOk.body)).toBe(201);
    assetA = await mkAsset('d', `PA${process.pid % 100000}`);
    assetB = await mkAsset('e', `PB${process.pid % 100000}`);
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.assetPrice.deleteMany({ where: { asset: { assetId: { in: [assetA, assetB] } } } });
      await prisma.asset.deleteMany({ where: { assetId: { in: [assetA, assetB] } } });
      await prisma.issuer.deleteMany({ where: { slug: SLUG } });
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'r-spec-' } },
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
    if (CI && !HAS_DB) throw new Error('Pricing roles cannot skip in CI.');
    expect(assetA).not.toBe('');
  });

  it('only support records: a customer is refused', async () => {
    const denied = await post(
      '/pricing/record',
      { assetId: assetA, priceUsd: 100, source: 'spec' },
      customerToken,
    );
    expect(denied.status).toBe(403);

    const ok = await post('/pricing/record', { assetId: assetA, priceUsd: 3125.5, source: 'spec-feed' }, supportToken);
    expect(ok.status).toBe(201);
  });

  it('recording against an unknown asset is 404', async () => {
    const res = await post('/pricing/record', { assetId: 'nope:0x0:nope', priceUsd: 100, source: 'spec' }, supportToken);
    expect(res.status).toBe(404);
  });

  it('a non-positive price is 422 before any write', async () => {
    expect((await post('/pricing/record', { assetId: assetA, priceUsd: -5, source: 'spec' }, supportToken)).status).toBe(422);
    expect((await post('/pricing/record', { assetId: assetA, priceUsd: 0, source: 'spec' }, supportToken)).status).toBe(422);
  });

  it('reads are any-session; unknown assets are 404 on reads too', async () => {
    const quote = await get(`/pricing/assets/${encodeURIComponent(assetA)}`, customerToken);
    expect(quote.status).toBe(200);
    expect(quote.body.found).toBe(true);

    // Asset B has no price: an honest miss, not a zero.
    const miss = await get(`/pricing/assets/${encodeURIComponent(assetB)}`, customerToken);
    expect(miss.status).toBe(200);
    expect(miss.body.found).toBe(false);

    expect((await get('/pricing/assets/nope:0x0:nope', customerToken)).status).toBe(404);
    expect((await get('/pricing/assets/nope:0x0:nope/history', customerToken)).status).toBe(404);
  });

  it('history is scoped to the asset in the path', async () => {
    const a = await get(`/pricing/assets/${encodeURIComponent(assetA)}/history?limit=10`, customerToken);
    expect(a.status).toBe(200);
    expect(a.body.length).toBeGreaterThan(0);

    const b = await get(`/pricing/assets/${encodeURIComponent(assetB)}/history?limit=10`, customerToken);
    expect(b.status).toBe(200);
    expect(b.body).toEqual([]);
  });
});
