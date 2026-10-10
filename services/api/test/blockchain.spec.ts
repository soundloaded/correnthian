import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Blockchain over HTTP — BE-1702 batch B.
 *
 * Health is support-and-up and never carries RPC endpoints. Sync is
 * owner-scoped: an unknown wallet and another user's wallet are both 404,
 * with no network touched either way. A live sync (real RPC) belongs to
 * Task 1.3's acceptance runs, not to this suite.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const ADDR = `0x${'f'.repeat(32)}${process.pid.toString(16).padStart(8, '0')}`;

describe.skipIf(!HAS_DB && !CI)('blockchain scopes syncs over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA = '';
  let tokenB = '';
  let supportToken = '';
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

    const mkUser = async (tag: string, role?: 'support' | 'compliance') => {
      const email = `b-spec-${tag}-${process.pid}@example.test`;
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
    tokenA = await mkUser('a');
    tokenB = await mkUser('b');
    supportToken = await mkUser('support', 'support');

    const w = await post('/wallets', { chainId: '1', address: ADDR, kind: 'smart', label: 'sync-me' }, tokenA);
    expect(w.status, JSON.stringify(w.body)).toBe(201);
    walletA = w.body.id;
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'b-spec-' } },
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
    if (CI && !HAS_DB) throw new Error('Blockchain scoping cannot skip in CI.');
    expect(walletA).not.toBe('');
  });

  it('health is support-and-up and carries no endpoints', async () => {
    const health = await get('/blockchain/health', supportToken);
    expect(health.status).toBe(200);
    expect(JSON.stringify(health.body)).not.toContain('rpcUrls');
    expect((await get('/blockchain/health', tokenA)).status).toBe(403);
  });

  it('syncing an unknown wallet or another user wallet is 404', async () => {
    expect((await post('/blockchain/wallets/no-such-wallet/sync', {}, tokenA)).status).toBe(404);
    expect((await post(`/blockchain/wallets/${walletA}/sync`, {}, tokenB)).status).toBe(404);
  });
});
