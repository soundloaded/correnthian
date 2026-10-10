import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Portfolio over HTTP — BE-1702 batch B.
 *
 * Every route is caller-scoped: another user's wallet id reads as 404, and
 * the aggregate routes only ever see the caller's wallets. Snapshots are
 * explicit (POST) and history reads them back; nothing here touches a chain.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const ADDR = `0x${'9'.repeat(32)}${process.pid.toString(16).padStart(8, '0')}`;

describe.skipIf(!HAS_DB && !CI)('portfolio isolates callers over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA = '';
  let tokenB = '';
  let walletA = '';

  const post = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);
  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);

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

    for (const [tag, set] of [['a', (t: string) => (tokenA = t)], ['b', (t: string) => (tokenB = t)]] as const) {
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: `h-spec-${tag}-${process.pid}@example.test`, password: 'correct-horse-battery-staple' });
      expect(reg.status).toBe(201);
      set(reg.body.token as string);
    }

    const w = await post('/wallets', { chainId: '1', address: ADDR, kind: 'smart', label: 'valued' }, tokenA);
    expect(w.status, JSON.stringify(w.body)).toBe(201);
    walletA = w.body.id;
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'h-spec-' } },
        select: { id: true, wallets: { select: { id: true } } },
      });
      const walletIds = users.flatMap((u) => u.wallets.map((w) => w.id));
      if (walletIds.length > 0) {
        await prisma.portfolioSnapshot.deleteMany({ where: { walletId: { in: walletIds } } });
        await prisma.transaction.deleteMany({ where: { walletId: { in: walletIds } } });
        await prisma.wallet.deleteMany({ where: { id: { in: walletIds } } });
      }
      await prisma.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
      await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    }
    await app?.close();
    delete process.env['RATE_LIMIT_MAX_REQUESTS'];
    delete process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'];
    delete process.env['REDIS_URL'];
  });

  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) throw new Error('Portfolio isolation cannot skip in CI.');
    expect(walletA).not.toBe('');
  });

  it('aggregates see only the caller wallets', async () => {
    const mine = await get('/portfolio', tokenA);
    expect(mine.status).toBe(200);
    expect(mine.body.wallets).toHaveLength(1);

    const theirs = await get('/portfolio', tokenB);
    expect(theirs.status).toBe(200);
    expect(theirs.body.wallets).toEqual([]);

    const alloc = await get('/portfolio/allocation', tokenB);
    expect(alloc.status).toBe(200);
    expect(alloc.body.byCategory).toEqual([]);
  });

  it('a foreign wallet is 404 for single reads and empty for scoped reads', async () => {
    expect((await get(`/portfolio/wallets/${walletA}`, tokenB)).status).toBe(404);
    expect((await post(`/portfolio/wallets/${walletA}/snapshot`, {}, tokenB)).status).toBe(404);
    // Scoped reads filter rather than fetch: a foreign wallet and a missing
    // wallet both answer empty, so neither is an oracle for who owns what.
    const history = await get(`/portfolio/wallets/${walletA}/history`, tokenB);
    expect(history.status).toBe(200);
    expect(history.body).toEqual([]);
    const series = await get(`/portfolio/wallets/${walletA}/history-series`, tokenB);
    expect(series.status).toBe(200);
    expect(series.body).toEqual([]);
  });

  it('a snapshot persists and history reads it back', async () => {
    const snap = await post(`/portfolio/wallets/${walletA}/snapshot`, {}, tokenA);
    expect(snap.status).toBe(201);

    const history = await get(`/portfolio/wallets/${walletA}/history`, tokenA);
    expect(history.status).toBe(200);
    expect(history.body.length).toBeGreaterThan(0);

    const series = await get(`/portfolio/wallets/${walletA}/history-series?bucket=day`, tokenA);
    expect(series.status).toBe(200);
    expect(series.body.length).toBeGreaterThan(0);
  });

  it('an unknown bucket is 422', async () => {
    expect((await get(`/portfolio/wallets/${walletA}/history-series?bucket=fortnight`, tokenA)).status).toBe(422);
  });
});
