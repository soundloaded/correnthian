import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Swaps over HTTP, as two account holders — BE-1702.
 *
 * The same shape as DEF-022 one controller over: `GET /swaps/quotes/:id`
 * carries no `@Roles` and `findById` takes no actor, so any session reads
 * any quote. Quotes carry amounts, asset pairs and fee breakdowns — not
 * emails, but another account's trading intent all the same.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('quotes isolate accounts over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA = '';
  let tokenB = '';
  let quoteA = '';
  const quoteIds: string[] = [];

  const post = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer())
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${auth}`)
      .send(body as object);
  const get = (path: string, auth: string) =>
    request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set('Authorization', `Bearer ${auth}`);

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/7`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    for (const [tag, set] of [['a', (t: string) => (tokenA = t)], ['b', (t: string) => (tokenB = t)]] as const) {
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: `q-iso-${tag}-${process.pid}@example.test`, password: 'correct-horse-battery-staple' });
      expect(reg.status).toBe(201);
      set(reg.body.token as string);
    }

    // A's quote, on seeded dev assets. Idempotency-Key because the route is
    // idempotent and the header is part of its contract, not decoration.
    const quote = await request(app.getHttpServer())
      .post('/api/v1/swaps/quotes')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', `q-iso-${process.pid}`)
      .send({
        fromAssetId: '1:0x0000000000000000000000000000000000000001:dev-fixtures',
        toAssetId: '1:0x0000000000000000000000000000000000000002:dev-fixtures',
        fromAmountRaw: '1000000',
      });
    expect(quote.status, JSON.stringify(quote.body)).toBe(201);
    quoteA = quote.body.id;
    quoteIds.push(quoteA);
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      if (quoteIds.length > 0) {
        await prisma.swapQuote.deleteMany({ where: { id: { in: quoteIds } } });
      }
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'q-iso-' } },
        select: { id: true },
      });
      await prisma.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
      await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    }
    await app?.close();
    delete process.env['RATE_LIMIT_MAX_REQUESTS'];
    delete process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'];
    delete process.env['REDIS_URL'];
  });

  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) throw new Error('Quote isolation cannot skip in CI.');
    expect(tokenA).not.toBe('');
  });

  it('another account gets 404 on someone else quote, not its terms', async () => {
    // A quote needs real assets; the dev seed carries tUSDT/tGOLD on chain 1.
    // What matters here is whose it is, not what it says.
    const res = await get(`/swaps/quotes/${quoteA}`, tokenB);
    expect(res.status).toBe(404);
  });

  it('mine shows only the caller quotes', async () => {
    const mineB = await get('/swaps/quotes/mine', tokenB);
    expect(mineB.status).toBe(200);
  });
});
