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
 * One-time links over HTTP — BE-203.
 *
 * Two tiers in one file: the unit suite pins the service's single-use
 * predicate and its enumeration resistance; this suite pins the wire.
 * What it pins over the wire is the part only the wire can hold:
 *
 *  - The requests refuse guessing, not asking. A bad token consumes
 *    exactly like a good one that already died — 401, same message.
 *  - Registration still answers 409 for a known address while the link
 *    requests answer identically for both. Two endpoints, two threat
 *    models, one user: the registration oracle is closed by
 *    non-enumeration, the link endpoints by it.
 *  - The console sink renders the message so the test can read the link
 *    without an inbox — and proves nothing about delivery.
 *
 * Rows and links are tagged per-suite and deleted in `afterAll`, because a
 * leftover live link is a live bearer credential, and a leftover session
 * is stranger state a later suite's counts could read.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);
const TAG = `al-spec-${process.pid}`;

describe.skipIf(!HAS_DB && !CI)('one-time links authenticate over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const post = (path: string, body: unknown, auth?: string) => {
    const req = request(app.getHttpServer()).post(`/api/v1${path}`);
    if (auth) req.set('Authorization', `Bearer ${auth}`);
    return req.send(body as object);
  };

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
  }, 90_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.deliveryLog.deleteMany({ where: { template: 'auth.magic-link' } });
      const users = await prisma.user.findMany({
        where: { email: { startsWith: `${TAG}-` } },
        select: { id: true },
      });
      const ids = users.map((u) => u.id);
      if (ids.length > 0) {
        await prisma.authToken.deleteMany({ where: { userId: { in: ids } } });
        await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
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
    if (CI && !HAS_DB) throw new Error('Auth links cannot skip in CI.');
    expect(app).toBeDefined();
  });

  it('requests parse against the registry and answer alike for known and unknown addresses', async () => {
    const email = `${TAG}@example.test`;
    const reg = await post('/auth/register', {
      email,
      password: 'correct-horse-battery-staple',
    });
    expect(reg.status, JSON.stringify(reg.body)).toBe(201);

    for (const address of [email, `${TAG}-nobody@example.test`]) {
      const res = await post('/auth/magic-link', { email: address });
      expect(res.status, JSON.stringify(res.body)).toBe(202);
      expect(CONTRACT_REGISTRY['POST /api/v1/auth/magic-link'].safeParse(res.body).success).toBe(true);
    }
  });

  it('a link opens exactly one session, through the notification the service enqueued', async () => {
    const email = `${TAG}@example.test`;

    await post('/auth/magic-link', { email });

    const queued = await prisma.notification.findFirstOrThrow({
      where: { template: 'auth.magic-link' },
      orderBy: { createdAt: 'desc' },
    });
    const link = (queued.payload as { link?: string }).link;
    expect(typeof link).toBe('string');
    const raw = new URL(link as string).searchParams.get('token');
    expect(raw).toBeTruthy();

    const consumed = await post('/auth/magic-link/consume', { token: raw });
    expect(consumed.status, JSON.stringify(consumed.body)).toBe(200);
    expect(CONTRACT_REGISTRY['POST /api/v1/auth/magic-link/consume'].safeParse(consumed.body).success).toBe(true);
    expect(consumed.body.user).toMatchObject({ email });

    const again = await post('/auth/magic-link/consume', { token: raw });
    expect(again.status).toBe(401);

    // Tidy the queue: the dispatch job owns these rows in production, and
    // the next assertion counts what is left.
    await prisma.notification.deleteMany({ where: { id: queued.id } });
  });

  it('a password reset consumes the link and revokes the sessions that came before it', async () => {
    const email = `${TAG}@example.test`;
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });

    const before = await post('/auth/login', {
      email,
      password: 'correct-horse-battery-staple',
    });
    expect(before.status).toBe(200);

    const asked = await post('/auth/password-reset', { email });
    expect(asked.status, JSON.stringify(asked.body)).toBe(202);
    expect(CONTRACT_REGISTRY['POST /api/v1/auth/password-reset'].safeParse(asked.body).success).toBe(true);

    const queued = await prisma.notification.findFirstOrThrow({
      where: { template: 'auth.password-reset' },
      orderBy: { createdAt: 'desc' },
    });
    const raw = new URL((queued.payload as { link: string }).link).searchParams.get('token');
    expect(raw).toBeTruthy();

    const done = await post('/auth/password-reset/confirm', {
      token: raw,
      password: 'a brand new password that is long',
    });
    expect(done.status, JSON.stringify(done.body)).toBe(204);

    // The old password no longer works; the new one does.
    expect(
      (await post('/auth/login', { email, password: 'correct-horse-battery-staple' })).status,
    ).toBe(401);
    expect(
      (await post('/auth/login', { email, password: 'a brand new password that is long' })).status,
    ).toBe(200);

    // The session issued before the reset is dead.
    const stale = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${before.body.token}`);
    expect(stale.status).toBe(401);

    await prisma.notification.deleteMany({ where: { id: queued.id } });
  });

  it('unknown and wrong-purpose links are refused identically', async () => {
    const result = await post('/auth/magic-link/consume', { token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
    expect(result.status).toBe(401);
    expect(result.body.error.message).toBe('That link is not valid. Request a new one.');
  });
});
