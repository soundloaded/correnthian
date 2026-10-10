import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Providers over HTTP — BE-1702 batch A.
 *
 * The registry and health summary are any-session (they never contain
 * credentials — that is a property this suite leans on, not one it proves).
 * Status changes are admin-only; the suite flips the seeded
 * `placeholder-metals` row and restores it, so no other suite can observe
 * the mutation.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('providers enforce status roles over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let supportToken = '';
  let adminToken = '';

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
      const email = `p-spec-${tag}-${process.pid}@example.test`;
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
      await prisma.provider.updateMany({ where: { slug: 'placeholder-metals' }, data: { status: 'disabled' } });
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'p-spec-' } },
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
    if (CI && !HAS_DB) throw new Error('Provider roles cannot skip in CI.');
    expect(adminToken).not.toBe('');
  });

  it('any session reads the registry and health', async () => {
    const list = await get('/providers', customerToken);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const health = await get('/providers/health', customerToken);
    expect(health.status).toBe(200);

    const one = await get('/providers/placeholder-metals', supportToken);
    expect(one.status).toBe(200);
  });

  it('unknown providers are 404', async () => {
    expect((await get('/providers/no-such-provider', customerToken)).status).toBe(404);
    expect((await patch('/providers/no-such-provider/status', { status: 'disabled' }, adminToken)).status).toBe(404);
  });

  it('only admin changes status: customer and support are refused', async () => {
    expect((await patch('/providers/placeholder-metals/status', { status: 'degraded' }, customerToken)).status).toBe(403);
    expect((await patch('/providers/placeholder-metals/status', { status: 'degraded' }, supportToken)).status).toBe(403);

    const changed = await patch('/providers/placeholder-metals/status', { status: 'degraded' }, adminToken);
    expect(changed.status).toBe(200);
    expect(changed.body.status).toBe('degraded');

    const restored = await patch('/providers/placeholder-metals/status', { status: 'disabled' }, adminToken);
    expect(restored.body.status).toBe('disabled');
  });

  it('an unknown status is 422 before any write', async () => {
    expect((await patch('/providers/placeholder-metals/status', { status: 'bogus' }, adminToken)).status).toBe(422);
  });
});
