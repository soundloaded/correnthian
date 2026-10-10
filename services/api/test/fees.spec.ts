import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Fees over HTTP — BE-1702 batch B.
 *
 * Three privilege tiers with nothing shared between them: any session gets
 * an itemised preview (no rule ids, no rate table), admin reads the table,
 * and only owner writes — every write with a reason the audit trail keeps.
 * The suite creates one rule and deactivates it afterwards so the table is
 * unchanged for every other suite.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('fees enforce three tiers over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let adminToken = '';
  let ownerToken = '';
  let ruleId = '';

  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);
  const post = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);
  const patch = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).patch(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);

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

    const mkUser = async (tag: string, role?: 'support' | 'compliance' | 'admin' | 'owner') => {
      const email = `f-spec-${tag}-${process.pid}@example.test`;
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
    adminToken = await mkUser('admin', 'admin');
    ownerToken = await mkUser('owner', 'owner');
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      if (ruleId) await prisma.feeRule.updateMany({ where: { id: ruleId }, data: { active: false } });
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'f-spec-' } },
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
    if (CI && !HAS_DB) throw new Error('Fee tiers cannot skip in CI.');
    expect(ownerToken).not.toBe('');
  });

  it('any session previews; the preview carries no rule internals', async () => {
    const res = await post('/fees/preview', { operation: 'buy', assetId: 'spec-asset', notionalUsd: '100.00' }, customerToken);
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain('ruleId');
  });

  it('the table is admin-only: customers are refused', async () => {
    expect((await get('/fees/rules', adminToken)).status).toBe(200);
    expect((await get('/fees/rules/diagnostics', adminToken)).status).toBe(200);
    expect((await get('/fees/rules', customerToken)).status).toBe(403);
  });

  it('writes are owner-only and need a reason', async () => {
    const rule = {
      operation: 'buy', kind: 'correnthian', basis: 'fixed', fixedUsd: '2.50',
      label: `spec rule ${process.pid}`, reason: 'batch-B suite proves owner writes need a reason',
    };
    expect((await post('/fees/rules', rule, adminToken)).status).toBe(403);
    expect((await post('/fees/rules', { ...rule, reason: 'short' }, ownerToken)).status).toBe(400);

    const created = await post('/fees/rules', rule, ownerToken);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    ruleId = created.body.id as string;

    const one = await get(`/fees/rules/${ruleId}`, adminToken);
    expect(one.status).toBe(200);
    expect((await get('/fees/rules/no-such-rule', adminToken)).status).toBe(404);
  });
});
