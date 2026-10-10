import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Transactions over HTTP, as two account holders — BE-1702.
 *
 * `routes.spec.ts` proves a stranger gets 401 and `roles.spec.ts` proves a
 * customer gets 403 on operator routes. Neither proves that customer A
 * cannot read customer B's rows: `GET /transactions/:id` carries no
 * `@Roles`, so both suites pass over it while any session reads any
 * transaction — amounts, destinations, wallet addresses and the owner's
 * email included. That is the exact layer DEF-001 lived in: the service
 * was tested, the controller was not, and nothing in between exercised
 * the route with the wrong user.
 *
 * Fixtures ride the dev seed (chain `1`, `tUSDT`) rather than building
 * their own chain: this file is about who may see what, not about
 * registry setup, and a second chain fixture would only add cleanup.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const CHAIN_ID = '1';
const ASSET_REF = '1:0x0000000000000000000000000000000000000001:dev-fixtures';
const DEST = '0x00000000000000000000000000000000000000bf';

describe.skipIf(!HAS_DB && !CI)('transactions isolate accounts over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA = '';
  let tokenB = '';
  let walletA = '';
  const intentIds: string[] = [];

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
    process.env['REDIS_URL'] = `${redisBase}/9`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const mkUser = async (tag: string) => {
      const email = `tx-iso-${tag}-${process.pid}@example.test`;
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'correct-horse-battery-staple' });
      expect(reg.status).toBe(201);
      return reg.body.token as string;
    };
    tokenA = await mkUser('a');
    tokenB = await mkUser('b');

    const wallet = await post(
      '/wallets',
      {
        chainId: CHAIN_ID,
        address: `0x${'a'.repeat(40)}`,
        kind: 'smart',
        label: 'tx-iso',
      },
      tokenA,
    );
    expect(wallet.status, JSON.stringify(wallet.body)).toBe(201);
    walletA = wallet.body.id;
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      if (intentIds.length > 0) {
        await prisma.transaction.deleteMany({ where: { id: { in: intentIds } } });
      }
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'tx-iso-' } },
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

  async function intent(auth = tokenA): Promise<string> {
    const res = await post(
      '/transactions',
      { walletId: walletA, assetId: ASSET_REF, direction: 'out', amountRaw: '1000000', destination: DEST },
      auth,
    );
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    intentIds.push(res.body.id);
    return res.body.id as string;
  }

  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) throw new Error('Transaction isolation cannot skip in CI.');
    expect(walletA).not.toBe('');
  });

  it('the owner reads their own transaction', async () => {
    const id = await intent();
    const res = await get(`/transactions/${id}`, tokenA);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it("another account gets 404 on someone else's transaction, not their data", async () => {
    const id = await intent();
    const res = await get(`/transactions/${id}`, tokenB);
    // Not 403: a caller probing ids must not learn the id exists. Not 200
    // with a body: amounts, destinations and the owner's email are not
    // theirs to read.
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(DEST.slice(2, 10));
  });

  it('an unknown id is 404 either way', async () => {
    const res = await get('/transactions/tx_missing', tokenA);
    expect(res.status).toBe(404);
  });

  it("mine shows only the caller's own rows", async () => {
    await intent(tokenA);
    const mineB = await get('/transactions/mine?limit=100', tokenB);
    expect(mineB.status).toBe(200);
    const items = mineB.body.items ?? mineB.body;
    expect(items).toEqual([]);

    const mineA = await get('/transactions/mine?limit=100', tokenA);
    expect(mineA.status).toBe(200);
    const itemsA = mineA.body.items ?? mineA.body;
    expect(itemsA.length).toBeGreaterThan(0);
  });

  it("a customer cannot file against someone else's wallet", async () => {
    const res = await post(
      '/transactions',
      { walletId: walletA, assetId: ASSET_REF, direction: 'out', amountRaw: '100', destination: DEST },
      tokenB,
    );
    expect(res.status).toBe(404);
  });

  it("a customer cannot advance someone else's transaction", async () => {
    const id = await intent(tokenA);
    const res = await post(`/transactions/${id}/transitions`, { to: 'signed' }, tokenB);
    expect(res.status).toBe(404);
    const after = await get(`/transactions/${id}`, tokenA);
    expect(after.body.state).toBe('created');
  });

  it('a transition that skips a control is refused, not applied', async () => {
    const id = await intent(tokenA);
    // created → broadcast with no signature authorising it: the takeover
    // edge the lifecycle table exists to refuse.
    const res = await post(
      `/transactions/${id}/transitions`,
      { to: 'broadcast', txHash: `0x${'a'.repeat(64)}` },
      tokenA,
    );
    expect(res.status).toBe(400);
    const after = await get(`/transactions/${id}`, tokenA);
    expect(after.body.state).toBe('created');
    expect(after.body.txHash).toBeNull();
  });

  it('a customer cannot record chain observations', async () => {
    const id = await intent(tokenA);
    // Depth is a fact read off a chain, and the account holder is not in a
    // position to know it — pending/confirmed are operator-only.
    const res = await post(
      `/transactions/${id}/observations`,
      { txHash: `0x${'b'.repeat(64)}`, confirmations: 12, outcome: 'seen' },
      tokenA,
    );
    expect(res.status).toBe(403);
  });

  it('an outbound intent without a destination is refused before it exists', async () => {
    const res = await post(
      '/transactions',
      { walletId: walletA, assetId: ASSET_REF, direction: 'out', amountRaw: '100' },
      tokenA,
    );
    expect(res.status).toBe(400);
  });
});
