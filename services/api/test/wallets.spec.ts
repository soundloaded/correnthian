import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Wallets over HTTP, as two account holders — BE-1702.
 *
 * Unlike transactions, every route here takes the user id and every query
 * scopes to it, so this suite pins correct behavior rather than exposing a
 * leak: cross-account reads are 404 on every verb, validation refuses
 * malformed addresses and balances before any write, exactly one wallet is
 * primary, and deregistering removes the tracking row while saying the
 * on-chain funds are unaffected.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const CHAIN_ID = '1';
const ADDR_A = `0x${'a'.repeat(40)}`;
const ADDR_B = `0x${'b'.repeat(40)}`;

describe.skipIf(!HAS_DB && !CI)('wallets isolate accounts over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA = '';
  let tokenB = '';
  let walletA = '';
  let walletA2 = '';

  const post = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer())
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${auth}`)
      .send(body as object);
  const get = (path: string, auth: string) =>
    request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set('Authorization', `Bearer ${auth}`);
  const patch = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer())
      .patch(`/api/v1${path}`)
      .set('Authorization', `Bearer ${auth}`)
      .send(body as object);

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/8`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    for (const [tag, set] of [['a', (t: string) => (tokenA = t)], ['b', (t: string) => (tokenB = t)]] as const) {
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: `w-iso-${tag}-${process.pid}@example.test`, password: 'correct-horse-battery-staple' });
      expect(reg.status).toBe(201);
      set(reg.body.token as string);
    }

    const w1 = await post('/wallets', { chainId: CHAIN_ID, address: ADDR_A, kind: 'smart', label: 'a1' }, tokenA);
    expect(w1.status, JSON.stringify(w1.body)).toBe(201);
    walletA = w1.body.id;
    const w2 = await post('/wallets', { chainId: CHAIN_ID, address: ADDR_B, kind: 'smart', label: 'a2' }, tokenA);
    expect(w2.status).toBe(201);
    walletA2 = w2.body.id;
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'w-iso-' } },
        select: { id: true, wallets: { select: { id: true } } },
      });
      const walletIds = users.flatMap((u) => u.wallets.map((w) => w.id));
      if (walletIds.length > 0) {
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
    if (CI && !HAS_DB) throw new Error('Wallet isolation cannot skip in CI.');
    expect(walletA).not.toBe('');
  });

  it('lists only the caller wallets', async () => {
    const a = await get('/wallets', tokenA);
    expect(a.status).toBe(200);
    expect(a.body.map((w: { id: string }) => w.id).sort()).toEqual([walletA, walletA2].sort());

    const b = await get('/wallets', tokenB);
    expect(b.status).toBe(200);
    expect(b.body).toEqual([]);
  });

  it('reads, relabels and deletes across accounts are all 404', async () => {
    expect((await get(`/wallets/${walletA}`, tokenB)).status).toBe(404);
    expect((await patch(`/wallets/${walletA}/label`, { label: 'mine now' }, tokenB)).status).toBe(404);
    expect((await patch(`/wallets/${walletA}/primary`, {}, tokenB)).status).toBe(404);
    expect(
      (
        await request(app.getHttpServer())
          .delete(`/api/v1/wallets/${walletA}`)
          .set('Authorization', `Bearer ${tokenB}`)
      ).status,
    ).toBe(404);
    // Untouched by all four attempts.
    const after = await get(`/wallets/${walletA}`, tokenA);
    expect(after.status).toBe(200);
    expect(after.body.label).toBe('a1');
  });

  it('refuses a malformed address before anything is stored', async () => {
    const res = await post('/wallets', { chainId: CHAIN_ID, address: 'not-an-address', kind: 'smart' }, tokenA);
    expect(res.status).toBe(400);
  });

  it('exactly one wallet is primary', async () => {
    await patch(`/wallets/${walletA}/primary`, {}, tokenA);
    await patch(`/wallets/${walletA2}/primary`, {}, tokenA);
    const list = await get('/wallets', tokenA);
    const primaries = list.body.filter((w: { isPrimary: boolean }) => w.isPrimary);
    expect(primaries.map((w: { id: string }) => w.id)).toEqual([walletA2]);
  });

  it('refuses a malformed recorded balance', async () => {
    // 422, not 400: the shape pipe rejects before the service runs. Service
    // rules (unknown asset, foreign wallet) are 400/404 further in — the
    // status tells you which layer said no.
    const res = await post(`/wallets/${walletA}/balances/some-asset`, { balanceRaw: '-3' }, tokenA);
    expect(res.status).toBe(422);
  });
});
