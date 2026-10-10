import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Audit over HTTP — BE-1702 batch B.
 *
 * The controller is class-level `@Roles('compliance')`: support and
 * customers are refused on every verb. The suite performs one audited act
 * (an issuer registration) so the list and actor views have a row that
 * belongs to this run, then reads it back through all three routes.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

const SLUG = `t-spec-${process.pid}`;

describe.skipIf(!HAS_DB && !CI)('audit confines reads to compliance over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let supportToken = '';
  let complianceToken = '';
  let complianceId = '';

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
      const email = `t-spec-${tag}-${process.pid}@example.test`;
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'correct-horse-battery-staple' });
      expect(reg.status).toBe(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      if (role) await prisma.user.update({ where: { id: user.id }, data: { role } });
      return { token: reg.body.token as string, id: user.id };
    };
    customerToken = (await mkUser('customer')).token;
    supportToken = (await mkUser('support', 'support')).token;
    const comp = await mkUser('compliance', 'compliance');
    complianceToken = comp.token;
    complianceId = comp.id;

    const issuer = await request(app.getHttpServer())
      .post('/api/v1/issuers')
      .set('Authorization', `Bearer ${complianceToken}`)
      .send({ slug: SLUG, name: 'Audit Mint', jurisdiction: 'US' });
    expect(issuer.status, JSON.stringify(issuer.body)).toBe(201);
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.issuer.deleteMany({ where: { slug: SLUG } });
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 't-spec-' } },
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
    if (CI && !HAS_DB) throw new Error('Audit confinement cannot skip in CI.');
    expect(complianceId).not.toBe('');
  });

  it('support and customers are refused on every verb', async () => {
    for (const token of [customerToken, supportToken]) {
      expect((await get('/audit?limit=5', token)).status).toBe(403);
      expect((await get(`/audit/actor/${complianceId}`, token)).status).toBe(403);
    }
  });

  it('compliance reads the trail through all three routes', async () => {
    const list = await get('/audit?limit=50', complianceToken);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    // Our issuer registration is one audited act among the run's rows.
    const mine = (list.body as Array<{ action: string; metadata?: unknown }>).find((e) => e.action === 'issuer.created');
    expect(mine).toBeDefined();

    const actor = await get(`/audit/actor/${complianceId}`, complianceToken);
    expect(actor.status).toBe(200);

    expect((await get('/audit/no-such-entry', complianceToken)).status).toBe(404);
  });
});
