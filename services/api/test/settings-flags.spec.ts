import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Feature flags over HTTP — BE-1505.
 *
 * Two tiers with nothing shared between them: any operator reads the whole
 * table (the console renders every settings page against it), only `admin`
 * writes — and every write carries a reason the audit trail keeps. Flags are
 * global, so the suite prefixes its keys with `spec-flags-` and deletes what
 * it created: a leftover flag is a behavioural switch another suite could
 * read, unlike an inert fixture row.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);
const TAG = `spec-flags-${process.pid}`;

describe.skipIf(!HAS_DB && !CI)('settings flags enforce two tiers over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let supportToken = '';
  let adminToken = '';
  const keys: string[] = [];

  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);
  const post = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);
  const patch = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).patch(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);
  const del = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).delete(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/0`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const mkUser = async (tag: string, role?: 'support' | 'admin') => {
      const email = `flags-${tag}-${process.pid}@example.test`;
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
    supportToken = await mkUser('support', 'support');
    adminToken = await mkUser('admin', 'admin');
  }, 90_000);

  afterAll(async () => {
    if (prisma && keys.length > 0) {
      await prisma.featureFlag.deleteMany({ where: { key: { in: keys } } });
    }
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'flags-' } },
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
    if (CI && !HAS_DB) throw new Error('Flag tiers cannot skip in CI.');
    expect(adminToken).not.toBe('');
  });

  it('any operator reads the table; customers do not', async () => {
    expect((await get('/settings/flags', supportToken)).status).toBe(200);
    expect((await get('/settings/flags', adminToken)).status).toBe(200);
  });

  it('writes are admin-only and need a reason', async () => {
    const key = `${TAG}-export`;
    keys.push(key);
    const body = {
      key, enabled: false, rollout: 10, description: 'gated export',
      reason: 'suite proves admin writes need a recorded reason',
    };
    // Support answers "what is switched on" but cannot flip anything.
    expect((await post('/settings/flags', body, supportToken)).status).toBe(403);
    // A reason shorter than the 8-character floor is a 400, not a write.
    expect((await post('/settings/flags', { ...body, reason: 'short' }, adminToken)).status).toBe(400);

    const created = await post('/settings/flags', body, adminToken);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ key, enabled: false, rollout: 10 });

    // The duplicate names the key as a conflict, not a crash.
    const dup = await post('/settings/flags', body, adminToken);
    expect(dup.status).toBe(409);

    const flipped = await patch(`/settings/flags/${key}`, {
      enabled: true, reason: 'ramping the export switch to everyone slowly',
    }, adminToken);
    expect(flipped.status, JSON.stringify(flipped.body)).toBe(200);
    expect(flipped.body.enabled).toBe(true);

    const gone = await del(`/settings/flags/${key}`, {
      reason: 'the export switch retired with the page that read it',
    }, adminToken);
    expect(gone.status).toBe(204);
    keys.splice(keys.indexOf(key), 1);
  });

  it('malformed keys and rollouts are refused at the edge', async () => {
    // Zod failures cross as 422 (validation_failed), not 400: the guard's
    // short-reason 400 above fires before the pipe, but a bad key or rollout
    // reaches the pipe first. Same convention as every other zod-validated
    // route.
    const reason = 'suite proves malformed flags never reach the store';
    expect((await post('/settings/flags', {
      key: 'UPPERCASE FLAG', enabled: true, rollout: 100, description: null, reason,
    }, adminToken)).status).toBe(422);
    expect((await post('/settings/flags', {
      key: `${TAG}-bad`, enabled: true, rollout: 101, description: null, reason,
    }, adminToken)).status).toBe(422);
  });
});
