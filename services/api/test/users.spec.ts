import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Users over HTTP across three roles — BE-1702.
 *
 * The whole controller is class-level `@Roles('support')`, with role and
 * status changes further restricted to `admin`. What this pins beyond the
 * roles suite (which proves gates exist): the tiering *between* operators
 * (support reads, only admin writes roles), self-service boundaries (a
 * customer cannot promote themselves), and that role changes land on the
 * row.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('users enforce operator tiers over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken = '';
  let supportToken = '';
  let adminToken = '';
  let userId = '';

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
    process.env['REDIS_URL'] = `${redisBase}/6`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const mkUser = async (tag: string) => {
      const email = `u-tier-${tag}-${process.pid}@example.test`;
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'correct-horse-battery-staple' });
      expect(reg.status).toBe(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      return { token: reg.body.token as string, id: user.id };
    };
    const u = await mkUser('user');
    userToken = u.token;
    userId = u.id;
    const s = await mkUser('support');
    await prisma.user.update({ where: { id: s.id }, data: { role: 'support' } });
    // Role is read per request, so the existing session gains support now.
    supportToken = s.token;

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
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'u-tier-' } },
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
    if (CI && !HAS_DB) throw new Error('User tiers cannot skip in CI.');
    expect(adminToken).not.toBe('');
  });

  it('support reads the list, a customer cannot', async () => {
    const asSupport = await get('/users?limit=5', supportToken);
    expect(asSupport.status).toBe(200);

    const asCustomer = await get('/users?limit=5', userToken);
    expect(asCustomer.status).toBe(403);
  });

  it('support reads an account, a customer cannot', async () => {
    expect((await get(`/users/${userId}`, supportToken)).status).toBe(200);
    expect((await get(`/users/${userId}`, userToken)).status).toBe(403);
  });

  it('only admin changes roles: support is refused, self-promotion is refused', async () => {
    const bySupport = await patch(`/users/${userId}/role`, { role: 'admin' }, supportToken);
    expect(bySupport.status).toBe(403);

    const selfServe = await patch(`/users/${userId}/role`, { role: 'support' }, userToken);
    // 403, not 404: the roles guard fires before the handler. A customer
    // cannot reach the handler at all, so there is nothing to probe.
    expect(selfServe.status).toBe(403);

    const byAdmin = await patch(`/users/${userId}/role`, { role: 'support' }, adminToken);
    expect(byAdmin.status, JSON.stringify(byAdmin.body)).toBe(200);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.role).toBe('support');
    // Restore: other suites must not inherit a promoted fixture account.
    await prisma.user.update({ where: { id: userId }, data: { role: 'user' } });
  });

  it('an unknown role is refused, not stored', async () => {
    const res = await patch(`/users/${userId}/role`, { role: 'superuser' }, adminToken);
    expect(res.status).toBe(422);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.role).toBe('user');
  });
});
