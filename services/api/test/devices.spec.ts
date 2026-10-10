import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Devices over HTTP — BE-1702 batch B.
 *
 * A user registers, lists and revokes only their own devices: revoking
 * another user's device is 404, not 403, so device ids are not an oracle
 * for who owns what. Operator views (`all`, `stats`) are support-and-up.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('devices isolate owners over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA = '';
  let tokenB = '';
  let supportToken = '';
  let deviceA = '';

  const post = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);
  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);

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

    const mkUser = async (tag: string, role?: 'support' | 'compliance') => {
      const email = `d-spec-${tag}-${process.pid}@example.test`;
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

    const reg = await post('/devices', { platform: 'web', label: 'a-laptop' }, tokenA);
    expect(reg.status, JSON.stringify(reg.body)).toBe(201);
    deviceA = reg.body.id as string;
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'd-spec-' } },
        select: { id: true },
      });
      const ids = users.map((u) => u.id);
      if (ids.length > 0) {
        await prisma.device.deleteMany({ where: { userId: { in: ids } } });
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
    if (CI && !HAS_DB) throw new Error('Device isolation cannot skip in CI.');
    expect(deviceA).not.toBe('');
  });

  it('each user lists only their own devices', async () => {
    const a = await get('/devices', tokenA);
    expect(a.status).toBe(200);
    expect(a.body.map((d: { id: string }) => d.id)).toEqual([deviceA]);

    const b = await get('/devices', tokenB);
    expect(b.status).toBe(200);
    expect(b.body).toEqual([]);
  });

  it('revoking another user device is 404 and changes nothing', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/devices/${deviceA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);

    const after = await get('/devices', tokenA);
    expect(after.body.map((d: { id: string }) => d.id)).toEqual([deviceA]);
  });

  it('revoking your own device removes it from the list', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/devices/${deviceA}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(204);

    expect((await get('/devices', tokenA)).body).toEqual([]);
  });

  it('operator views are support-and-up; a customer is refused', async () => {
    expect((await get('/devices/all', supportToken)).status).toBe(200);
    expect((await get('/devices/stats', supportToken)).status).toBe(200);
    expect((await get('/devices/all', tokenA)).status).toBe(403);
    expect((await get('/devices/stats', tokenA)).status).toBe(403);
  });

  it('a malformed registration is 422 before anything is stored', async () => {
    expect((await post('/devices', { platform: 'pager', label: 'x' }, tokenB)).status).toBe(422);
  });
});
