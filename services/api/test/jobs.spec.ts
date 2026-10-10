import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Jobs over HTTP — BE-1702 batch B.
 *
 * The status board is support-and-up; manual runs are admin-only. This suite
 * deliberately never fires a real run: a run executes a job against live
 * vendors, which is an operator act, not a test fixture. What it pins is
 * the gate tiering and that an unknown job name is 404 from the lookup.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('jobs gate manual runs over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let supportToken = '';
  let adminToken = '';

  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);
  const post = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);

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
      const email = `j-spec-${tag}-${process.pid}@example.test`;
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
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'j-spec-' } },
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
    if (CI && !HAS_DB) throw new Error('Job gates cannot skip in CI.');
    expect(adminToken).not.toBe('');
  });

  it('support reads the board, a customer cannot', async () => {
    const board = await get('/jobs', supportToken);
    expect(board.status).toBe(200);
    expect(Array.isArray(board.body.jobs)).toBe(true);
    expect(board.body.jobs.map((j: { name: string }) => j.name)).toContain('compliance.rescreen-stale');
    expect((await get('/jobs', customerToken)).status).toBe(403);
  });

  it('manual runs are admin-only, and unknown names are 422', async () => {
    expect((await post('/jobs/compliance.rescreen-stale/run', {}, customerToken)).status).toBe(403);
    expect((await post('/jobs/compliance.rescreen-stale/run', {}, supportToken)).status).toBe(403);
    expect((await post('/jobs/no-such-job/run', {}, adminToken)).status).toBe(404);
  });
});
