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
 * The operator's redemption table over HTTP — Task 3.1's missing endpoint.
 *
 * `GET /redemptions` is support-and-up: a customer is refused, and the
 * response parses against the registry entry. Row-level filtering is pinned
 * in `redemption-list.spec.ts` against a fake that evaluates the predicate;
 * this suite owns gates and shape, not fixtures.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('operator redemption list serves support over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let supportToken = '';

  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/2`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    prisma = app.get(PrismaService);

    const mkUser = async (tag: string, role?: 'support' | 'compliance') => {
      const email = `o-spec-${tag}-${process.pid}@example.test`;
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
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'o-spec-' } },
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
    if (CI && !HAS_DB) throw new Error('Redemption list cannot skip in CI.');
    expect(supportToken).not.toBe('');
  });

  it('support reads the table and it parses against the registry', async () => {
    const res = await get('/redemptions?limit=5', supportToken);
    expect(res.status).toBe(200);
    expect(CONTRACT_REGISTRY['GET /api/v1/redemptions'].safeParse(res.body).success).toBe(true);
  });

  it('a customer is refused, and the state filter is accepted', async () => {
    expect((await get('/redemptions?limit=5', customerToken)).status).toBe(403);
    const filtered = await get('/redemptions?state=requested&limit=5', supportToken);
    expect(filtered.status).toBe(200);
    for (const item of filtered.body.items as Array<{ state: string }>) {
      expect(item.state).toBe('requested');
    }
  });
});
