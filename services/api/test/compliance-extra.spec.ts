import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FakeScreeningProvider } from '../src/compliance/screening/fake-screening.provider.js';
import { SCREENING_PROVIDER } from '../src/compliance/screening/screening-provider.js';

/**
 * Compliance decisions over HTTP — BE-1702 batch B.
 *
 * Extends `compliance.spec.ts` (webhook HMAC, gate, review queue) with the
 * human side: starting verification is idempotent while pending (re-entry
 * returns the live inquiry, not a second one), and deciding is
 * compliance-only, reason-required, and the only path that writes `rejected`
 * or clears a latched sanctions hit.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('compliance decisions hold their shape over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken = '';
  let customerId = '';
  let complianceToken = '';

  const post = (path: string, body: unknown, auth: string) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`).send(body as object);
  const get = (path: string, auth: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${auth}`);

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
      const email = `e-spec-${tag}-${process.pid}@example.test`;
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'correct-horse-battery-staple' });
      expect(reg.status).toBe(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      if (role) await prisma.user.update({ where: { id: user.id }, data: { role } });
      return { token: reg.body.token as string, id: user.id };
    };
    const c = await mkUser('customer');
    customerToken = c.token;
    customerId = c.id;
    // The fake is fail-closed when unscripted; script this run's inquiry so
    // the suite exercises creation and re-entry, not the vendor-down path.
    const screening = app.get<FakeScreeningProvider>(SCREENING_PROVIDER);
    if (screening instanceof FakeScreeningProvider) {
      screening.scriptCreate(customerId, { inquiryId: `inq-e-${process.pid}`, sessionToken: 'sess-test' });
    }
    complianceToken = (await mkUser('compliance', 'compliance')).token;
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'e-spec-' } },
        select: { id: true },
      });
      const ids = users.map((u) => u.id);
      if (ids.length > 0) {
        await prisma.kycProfile.deleteMany({ where: { userId: { in: ids } } });
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
    if (CI && !HAS_DB) throw new Error('Compliance decisions cannot skip in CI.');
    expect(customerId).not.toBe('');
  });

  it('eligibility is public and unmatched locations are denied', async () => {
    const us = await request(app.getHttpServer()).get('/api/v1/compliance/eligibility?country=US');
    expect(us.status).toBe(200);
    // 'AQ' is unmatched by every suite: contracts.spec upserts a 'ZZ' rule
    // on the shared table, so asserting on ZZ would couple this suite to
    // another file's fixtures and flake under parallel workers.
    const aq = await request(app.getHttpServer()).get('/api/v1/compliance/eligibility?country=AQ');
    expect(aq.body.allowed).toBe(false);
  });

  it('starting verification twice returns the live inquiry, not a second one', async () => {
    const first = await post('/compliance/verification/start', {}, customerToken);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    const second = await post('/compliance/verification/start', {}, customerToken);
    expect(second.status).toBe(201);
    expect(second.body.inquiryId).toBe(first.body.inquiryId);
    // Re-entry resumes the live inquiry: the vendor was asked exactly once.
    const screening = app.get<FakeScreeningProvider>(SCREENING_PROVIDER);
    if (screening instanceof FakeScreeningProvider) {
      expect(screening.calls.createInquiry.filter((id) => id === customerId)).toHaveLength(1);
    }
  });

  it('deciding is compliance-only and reason-required', async () => {
    const reason = 'batch-B suite parks and decides one profile per decision';
    expect((await post(`/compliance/reviews/${customerId}/decide`, { decision: 'approve', reason }, customerToken)).status).toBe(403);
    expect((await post(`/compliance/reviews/${customerId}/decide`, { decision: 'approve', reason: '' }, complianceToken)).status).toBe(422);
  });

  it('an approval clears a latched hit; a rejection leaves the latch', async () => {
    const reason = 'batch-B suite decides one parked profile per decision';
    await prisma.kycProfile.update({
      where: { userId: customerId },
      data: { status: 'pending', needsReview: true, sanctionsResult: 'hit' },
    });

    const approved = await post(`/compliance/reviews/${customerId}/decide`, { decision: 'approve', reason }, complianceToken);
    expect(approved.status).toBe(201);
    const afterApprove = await prisma.kycProfile.findUniqueOrThrow({ where: { userId: customerId } });
    expect(afterApprove.sanctionsResult).toBe('clean');

    await prisma.kycProfile.update({
      where: { userId: customerId },
      data: { status: 'pending', needsReview: true, sanctionsResult: 'hit' },
    });
    const rejected = await post(`/compliance/reviews/${customerId}/decide`, { decision: 'reject', reason }, complianceToken);
    expect(rejected.status).toBe(201);
    const afterReject = await prisma.kycProfile.findUniqueOrThrow({ where: { userId: customerId } });
    expect(afterReject.sanctionsResult).toBe('hit');
    expect(afterReject.status).toBe('rejected');
  });
});
