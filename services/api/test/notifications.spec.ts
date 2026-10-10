import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONTRACT_REGISTRY } from '@correnthian/contracts';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * The operator's notification table over HTTP — Task 3.6's missing endpoint.
 *
 * `GET /notifications` is support-and-up; the response parses against the
 * registry entry. The suite enqueues one row through the API so the table
 * is non-empty and the state filter has something to classify — then
 * removes it, because shared tables are not fixtures.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('operator notification list serves support over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let supportToken = '';

  const post = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);
  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/1`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const mkUser = async (tag: string, role?: 'support' | 'compliance') => {
      const email = `n-spec-${tag}-${process.pid}@example.test`;
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

    const enqueued = await post(
      '/notifications',
      { channel: 'email', template: `probe-${process.pid}`, payload: {} },
      supportToken,
    );
    expect(enqueued.status, JSON.stringify(enqueued.body)).toBe(201);
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.notification.deleteMany({ where: { template: `probe-${process.pid}` } });
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'n-spec-' } },
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
    if (CI && !HAS_DB) throw new Error('Notification list cannot skip in CI.');
    expect(supportToken).not.toBe('');
  });

  it('support reads the table and it parses against the registry', async () => {
    const res = await get('/notifications?limit=5', supportToken);
    expect(res.status).toBe(200);
    expect(CONTRACT_REGISTRY['GET /api/v1/notifications'].safeParse(res.body).success).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('a customer is refused, and the state filter classifies', async () => {
    expect((await get('/notifications?limit=5', customerToken)).status).toBe(403);
    const pending = await get('/notifications?state=pending&limit=50', supportToken);
    expect(pending.status).toBe(200);
    for (const item of pending.body.items as Array<{ state: string }>) {
      expect(item.state).toBe('pending');
    }
    const mine = (pending.body.items as Array<{ template: string }>).find((i) => i.template === `probe-${process.pid}`);
    expect(mine).toBeDefined();
  });
});
