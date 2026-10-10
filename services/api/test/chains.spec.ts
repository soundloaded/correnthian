import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Chains over HTTP — BE-1702 batch B.
 *
 * Reads are any-session and never expose RPC endpoints (the summary says
 * so; this suite asserts the field is absent, not just undocumented).
 * Enable/disable is admin-only, and the suite restores whatever it flips.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('chains hide endpoints and gate writes over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let adminToken = '';

  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);
  const patch = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).patch(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/4`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const email = `c-spec-${process.pid}@example.test`;
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct-horse-battery-staple' });
    expect(reg.status).toBe(201);
    customerToken = reg.body.token;

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: process.env.CONTRACT_TEST_EMAIL ?? 'admin@correnthian.local',
        password: process.env.CONTRACT_TEST_PASSWORD ?? 'correct-horse-battery-staple',
      });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    adminToken = login.body.token;
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.chain.updateMany({ where: { id: '11155111' }, data: { enabled: false } });
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'c-spec-' } },
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
    if (CI && !HAS_DB) throw new Error('Chain gates cannot skip in CI.');
    expect(adminToken).not.toBe('');
  });

  it('reads never expose RPC endpoints', async () => {
    const list = await get('/chains', customerToken);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain('rpcUrls');

    const one = await get('/chains/1', customerToken);
    expect(one.status).toBe(200);
    expect(one.body).not.toHaveProperty('rpcUrls');
  });

  it('unknown chains are 404', async () => {
    expect((await get('/chains/999', customerToken)).status).toBe(404);
    expect((await patch('/chains/999/enabled', { enabled: true }, adminToken)).status).toBe(404);
  });

  it('only admin enables: a customer is refused, and the flip is restored', async () => {
    expect((await patch('/chains/11155111/enabled', { enabled: true }, customerToken)).status).toBe(403);

    const enabled = await patch('/chains/11155111/enabled', { enabled: true }, adminToken);
    expect(enabled.status).toBe(200);

    const restored = await patch('/chains/11155111/enabled', { enabled: false }, adminToken);
    expect(restored.status).toBe(200);
  });
});
