import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONTRACT_REGISTRY } from '@correnthian/contracts';
import { AppModule } from '../../app.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { applyApiVersioning } from '../../versioning/apply-versioning.js';
import { keyHash, requestFingerprint } from './idempotency-key.js';

/**
 * Idempotency, proved against the real API and the real database.
 *
 * Two applications are booted from the same `AppModule` on purpose. A single
 * instance cannot demonstrate the property that matters, because an in-process
 * mutex would make every test below pass while guaranteeing nothing the moment
 * a second replica exists — which is the normal state of a deployed service.
 * Everything here that says "parallel" is fired at `replicaA` and `replicaB`
 * with the same key at the same moment.
 *
 * Requires the Docker stack: `pnpm db:up`.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Skips locally without a database; fails in CI without one.
 *
 * Same rule as the contract suite and for the same reason: a green build that
 * silently omitted this file would assert that a double tap on Buy produces one
 * purchase while proving nothing at all.
 */
const CI = Boolean(process.env.CI);

/** Every idempotent route, for the coverage assertions at the bottom. */
const FINANCIAL_POSTS = [
  'POST /api/v1/swaps/quotes',
  'POST /api/v1/redemptions',
  'POST /api/v1/onramp/quote',
] as const;

describe.skipIf(!HAS_DB && !CI)('Idempotency on financial operations', () => {
  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) {
      throw new Error(
        'The idempotency suite cannot skip in CI. If it is not running, nothing is ' +
          'checking that a user pressing Buy twice gets one purchase.',
      );
    }
    expect(HAS_DB).toBe(CI ? true : HAS_DB);
  });

  const QUOTES_PATH = '/api/v1/swaps/quotes';

  let replicaA: INestApplication;
  let replicaB: INestApplication;
  let prisma: PrismaService;
  let token = '';
  let tokenOther = '';
  let userId = '';
  let fromAssetId = '';
  let toAssetId = '';

  const emails = [
    `idem-${process.pid}@correnthian.test`,
    `idem-other-${process.pid}@correnthian.test`,
  ];

  /** Bounds teardown to what this run wrote, so a shared database survives it. */
  const suiteStartedAt = new Date();

  async function boot(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    return app;
  }

  beforeAll(async () => {
    replicaA = await boot();
    replicaB = await boot();
    prisma = replicaA.get(PrismaService);

    // Scoped to the seeded fixture issuer, the same fix `contracts.spec.ts`
    // already carries. Unscoped, this picked up whatever the table held, and
    // `redemption.controller.spec.ts` creates an asset with symbol `RSPG`
    // while its fixtures exist — which sorts before `tGOLD`. This suite then
    // quoted that asset, and redemption's teardown could not delete it:
    // `Foreign key constraint violated on SwapQuote_fromAssetId_fkey`, an
    // intermittent failure with no obvious connection to idempotency at all.
    //
    // Test suites sharing one database must adopt fixtures only from rows they
    // own, or they delete each other's.
    const assets = await prisma.asset.findMany({
      where: { enabled: true, issuer: { slug: 'dev-fixtures' } },
      take: 2,
      orderBy: { symbol: 'asc' },
    });
    if (assets.length < 2) {
      throw new Error(
        'The idempotency suite needs two enabled seeded assets to quote between. ' +
          'Run `pnpm seed`. A duplicate-suppression test asserting against an error ' +
          'response proves nothing.',
      );
    }
    fromAssetId = assets[0]?.assetId ?? '';
    toAssetId = assets[1]?.assetId ?? '';

    token = await register(replicaA, emails[0] as string);
    tokenOther = await register(replicaA, emails[1] as string);

    const user = await prisma.user.findUnique({ where: { email: emails[0] as string } });
    if (!user) throw new Error('the first test account was not created');
    userId = user.id;

    // Clear the rate limiter so this suite's result does not depend on how
    // recently it last ran. A contributor running it twice in a minute should
    // not see the second run fail for a reason that has nothing to do with it.
    const redis = replicaA.get(RedisService).raw;
    const used = await redis.keys('correnthian:rate:*');
    if (used.length > 0) await redis.del(used);
  }, 120_000);

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);

    await prisma.idempotencyRecord.deleteMany({
      where: { createdAt: { gte: suiteStartedAt } },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.swapQuote.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });

    await replicaA?.close();
    await replicaB?.close();
  });

  /** A fresh key per test, so one test's claim can never mask another's. */
  let keySeq = 0;
  const freshKey = (label: string) => `idem-spec-${label}-${process.pid}-${keySeq++}`;

  async function register(app: INestApplication, email: string): Promise<string> {
    // Argon2 is deliberately slow; two accounts is all this suite needs.
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct-horse-battery-staple' });
    if (res.status !== 201) {
      throw new Error(`could not create ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.token as string;
  }

  const quote = (app: INestApplication, key: string, amount = '1.5', auth = token) =>
    request(app.getHttpServer())
      .post(QUOTES_PATH)
      .set('Authorization', `Bearer ${auth}`)
      .set('Idempotency-Key', key)
      .send({ fromAssetId, toAssetId, fromAmountRaw: amount });

  const quotesForUser = () => prisma.swapQuote.count({ where: { userId } });

  // --- the actual guarantee -------------------------------------------------

  it('a duplicate submission creates exactly one quote and replays the response', async () => {
    const key = freshKey('replay');
    const before = await quotesForUser();

    const first = await quote(replicaA, key);
    expect(first.status, JSON.stringify(first.body)).toBe(201);

    const second = await quote(replicaA, key);
    expect(second.status, JSON.stringify(second.body)).toBe(201);

    // The same answer, not a second answer. A client cannot tell them apart
    // except by the header, which is the point.
    expect(second.body).toEqual(first.body);
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(first.headers['idempotency-replayed']).toBeUndefined();

    // The proof, not the header: one row, not two.
    expect(await quotesForUser()).toBe(before + 1);
  });

  it('replays the original status code, not just the body', async () => {
    const key = freshKey('status');
    const first = await quote(replicaA, key);
    expect(first.status).toBe(201);

    const second = await quote(replicaA, key);
    expect(second.status).toBe(first.status);
  });

  it('a conditional retry neither errors nor executes twice', async () => {
    const key = freshKey('conditional');
    const before = await quotesForUser();

    const first = await quote(replicaA, key, '12.5');
    expect(first.status).toBe(201);
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();

    // A replay is answered from a stored body rather than by the handler, so
    // it is the one path where the framework could end up replying to a
    // response that has already been written. A client that caches — which is
    // exactly the client that retries — sends this header.
    const conditional = await request(replicaA.getHttpServer())
      .post(QUOTES_PATH)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .set('If-None-Match', etag as string)
      .send({ fromAssetId, toAssetId, fromAmountRaw: '12.5' });

    expect(conditional.status).toBeLessThan(500);
    expect(await quotesForUser()).toBe(before + 1);
  });

  it('rejects the same key with a different body rather than replaying it', async () => {
    const key = freshKey('conflict');
    const before = await quotesForUser();

    const first = await quote(replicaA, key, '1.5');
    expect(first.status).toBe(201);

    // Same key, a different amount. Replaying here would answer a question
    // nobody asked: the caller wanted 9 units and would be handed a quote for
    // 1.5, then act on it.
    const second = await quote(replicaA, key, '9');
    expect(second.status).toBe(409);

    const parsed = CONTRACT_REGISTRY['ERROR POST /api/v1/swaps/quotes'].safeParse(second.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`the conflict does not match its contract:\n${detail}`);
    }
    expect(parsed.data.error.detail.reason).toBe('fingerprint_mismatch');
    expect(parsed.data.error.detail.recorded).toEqual({ method: 'POST', path: QUOTES_PATH });

    // Refused, so nothing was written.
    expect(await quotesForUser()).toBe(before + 1);
  });

  it('treats a reordered body as the same request, not a different one', async () => {
    const key = freshKey('ordering');
    const before = await quotesForUser();

    const first = await quote(replicaA, key, '2.25');
    expect(first.status).toBe(201);

    // Same fields, serialised in a different order. A client whose JSON
    // serialiser does not preserve insertion order has not made a different
    // request, and being told "conflict" here would teach users that retrying
    // is unsafe — the exact habit this feature exists to make safe.
    const reordered = await request(replicaA.getHttpServer())
      .post(QUOTES_PATH)
      .type('json')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(JSON.stringify({ toAssetId, fromAmountRaw: '2.25', fromAssetId }));
    expect(reordered.status, JSON.stringify(reordered.body)).toBe(201);
    expect(reordered.headers['idempotency-replayed']).toBe('true');
    expect(reordered.body).toEqual(first.body);
    expect(await quotesForUser()).toBe(before + 1);
  });

  it('honours a key sent through the transitional unversioned alias', async () => {
    // Moving a client from `/swaps/quotes` to `/api/v1/swaps/quotes` must not
    // invalidate a key it already holds, or the migration would silently
    // re-open the double-purchase window for every client in flight.
    const key = freshKey('alias');
    const before = await quotesForUser();

    const legacy = await request(replicaA.getHttpServer())
      .post('/swaps/quotes')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ fromAssetId, toAssetId, fromAmountRaw: '3.5' });
    expect(legacy.status, JSON.stringify(legacy.body)).toBe(201);

    const versioned = await quote(replicaA, key, '3.5');
    expect(versioned.status).toBe(201);
    expect(versioned.headers['idempotency-replayed']).toBe('true');
    expect(versioned.body).toEqual(legacy.body);
    expect(await quotesForUser()).toBe(before + 1);
  });

  // --- concurrency across instances ----------------------------------------

  it('two replicas, one key, fired at the same instant: one execution', async () => {
    const key = freshKey('parallel');
    const startedAt = new Date();
    const before = await quotesForUser();

    // Started without awaiting the first, so the two requests genuinely
    // overlap. Two different processes, so no in-process lock could help.
    const [fromA, fromB] = await Promise.all([
      quote(replicaA, key, '4.5'),
      quote(replicaB, key, '4.5'),
    ]);

    expect([fromA.status, fromB.status].sort((a, b) => a - b)).toEqual([201, 201]);
    expect(fromA.body.id).toBe(fromB.body.id);
    expect(await quotesForUser()).toBe(before + 1);

    const records = await prisma.idempotencyRecord.findMany({
      where: { path: QUOTES_PATH, createdAt: { gte: startedAt } },
    });
    expect(records).toHaveLength(1);
    expect(records[0]?.state).toBe('completed');
    expect(records[0]?.method).toBe('POST');
  });

  it('six simultaneous duplicates across two replicas still execute once', async () => {
    const key = freshKey('stampede');
    const startedAt = new Date();
    const before = await quotesForUser();

    const attempts = await Promise.all([
      quote(replicaA, key, '5.5'),
      quote(replicaB, key, '5.5'),
      quote(replicaA, key, '5.5'),
      quote(replicaB, key, '5.5'),
      quote(replicaA, key, '5.5'),
      quote(replicaB, key, '5.5'),
    ]);

    for (const attempt of attempts) {
      expect(attempt.status, JSON.stringify(attempt.body)).toBe(201);
      expect(attempt.body.id).toBe(attempts[0]?.body.id);
    }

    // One row from six requests, and one claim record. This is the assertion
    // the whole mechanism exists for; anything weaker would also pass with a
    // per-process lock.
    expect(await quotesForUser()).toBe(before + 1);
    const claims = await prisma.idempotencyRecord.findMany({
      where: { path: QUOTES_PATH, createdAt: { gte: startedAt } },
    });
    expect(claims).toHaveLength(1);
  });

  it('refuses rather than re-executing when the instance holding the claim died', async () => {
    const key = freshKey('abandoned');
    const before = await quotesForUser();

    // The shape a rolled pod leaves behind: claimed, lease expired, no outcome.
    // The fingerprint matches, so this is unambiguously the same request.
    await prisma.idempotencyRecord.create({
      data: {
        keyHash: keyHash(userId, key),
        requestHash: requestFingerprint('POST', QUOTES_PATH, {
          fromAssetId,
          toAssetId,
          fromAmountRaw: '6.5',
        }),
        method: 'POST',
        path: QUOTES_PATH,
        state: 'in_progress',
        lockedUntil: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const res = await quote(replicaA, key, '6.5');
    expect(res.status).toBe(409);

    const parsed = CONTRACT_REGISTRY['ERROR POST /api/v1/swaps/quotes'].safeParse(res.body);
    if (!parsed.success) {
      throw new Error(`the refusal does not match its contract:\n${JSON.stringify(parsed.error.issues, null, 2)}`);
    }
    expect(parsed.data.error.detail.reason).toBe('outcome_unknown');

    // The decision under test: refusing costs the user one error message;
    // re-running could cost them a second purchase.
    expect(await quotesForUser()).toBe(before);
  });

  // --- expiry ---------------------------------------------------------------

  it('a key past its window stops suppressing the request', async () => {
    const key = freshKey('expiry');
    const hash = keyHash(userId, key);
    const before = await quotesForUser();

    const first = await quote(replicaA, key, '7.5');
    expect(first.status).toBe(201);
    expect(await quotesForUser()).toBe(before + 1);

    // Still inside the window.
    const withinWindow = await quote(replicaA, key, '7.5');
    expect(withinWindow.status).toBe(201);
    expect(withinWindow.headers['idempotency-replayed']).toBe('true');
    expect(await quotesForUser()).toBe(before + 1);

    // Age the record past its 24 hours. Long enough to cover a user's dinner
    // and a payment provider's worst day; short enough that the table does not
    // become an archive.
    await prisma.idempotencyRecord.update({
      where: { keyHash: hash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const afterWindow = await quote(replicaA, key, '7.5');
    expect(afterWindow.status).toBe(201);
    expect(afterWindow.headers['idempotency-replayed']).toBeUndefined();
    // A fresh execution producing a new quote: the key is free again.
    expect(afterWindow.body.id).not.toBe(first.body.id);
    expect(await quotesForUser()).toBe(before + 2);
  });

  // --- key hygiene ----------------------------------------------------------

  it('never persists the key and never echoes it', async () => {
    // Shaped like a secret, because the guarantee has to hold for a client
    // that sends one.
    const key = `sk_live_${'A'.repeat(48)}`;
    const startedAt = new Date();

    const res = await quote(replicaA, key, '8.5');
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain(key);

    const stored = (await prisma.idempotencyRecord.findMany({
      where: { path: QUOTES_PATH, createdAt: { gte: startedAt } },
    }))[0];
    if (!stored) throw new Error('no idempotency record was written');

    expect(JSON.stringify(stored)).not.toContain(key);
    expect(stored.keyHash).not.toContain(key);
    expect(stored.keyHash).toMatch(/^[0-9a-f]{64}$/);

    // Nor in a refusal.
    const rejected = await quote(replicaA, key, '999');
    expect(rejected.status).toBe(409);
    expect(JSON.stringify(rejected.body)).not.toContain(key);
  });

  it('rejects a malformed key without echoing it back', async () => {
    const res = await request(replicaA.getHttpServer())
      .post(QUOTES_PATH)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'has spaces')
      .send({ fromAssetId, toAssetId, fromAmountRaw: '1' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error.code', 'bad_request');
    expect(JSON.stringify(res.body)).not.toContain('has spaces');
    expect(res.body.error.message).toMatch(/idempotency-key/i);
  });

  it('scopes a key to its caller, so two accounts never collide', async () => {
    const key = freshKey('scoped');

    const mine = await quote(replicaA, key, '1.25');
    expect(mine.status).toBe(201);

    // A different account, the same key, and a deliberately different body. If
    // keys were global this would be a conflict at best — and, worse, one
    // account reading back another account's purchase response.
    const theirs = await quote(replicaB, key, '42', tokenOther);
    expect(theirs.status, JSON.stringify(theirs.body)).toBe(201);
    expect(theirs.headers['idempotency-replayed']).toBeUndefined();
    expect(theirs.body.id).not.toBe(mine.body.id);

    expect(await prisma.swapQuote.count({ where: { userId: { in: [] } } })).toBe(0);
    const other = await prisma.user.findUnique({ where: { email: emails[1] as string } });
    expect(
      await prisma.swapQuote.count({ where: { userId: other?.id ?? '' } }),
    ).toBe(1);
  });

  it('a request with no key still executes — the header is supported, not required', async () => {
    const before = await quotesForUser();
    const res = await request(replicaA.getHttpServer())
      .post(QUOTES_PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({ fromAssetId, toAssetId, fromAmountRaw: '10' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(await quotesForUser()).toBe(before + 1);
  });

  it('releases the claim when the handler fails, so a retry is a real retry', async () => {
    const key = freshKey('release');
    const before = await quotesForUser();

    // An asset that is not in the registry: the handler throws.
    const failed = await request(replicaA.getHttpServer())
      .post(QUOTES_PATH)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ fromAssetId: 'not-a-real-asset', toAssetId, fromAmountRaw: '11' });
    expect(failed.status).toBe(404);
    expect(await quotesForUser()).toBe(before);

    // Same key, now a request that succeeds. Had the failure left its claim
    // behind, this would replay a 404 for the rest of the day and the user's
    // order would silently never exist.
    const retried = await quote(replicaA, key, '11');
    expect(retried.status, JSON.stringify(retried.body)).toBe(201);
    expect(await quotesForUser()).toBe(before + 1);
  });

  // --- every financial route, not just the first one ------------------------

  for (const entry of FINANCIAL_POSTS) {
    const [method, path] = entry.split(' ');

    /**
     * A malformed key is rejected by the interceptor before the handler runs,
     * so a 400 naming the header proves the route carries `@Idempotent()`.
     * That is a real assertion about the wiring without having to construct a
     * redemption that would actually be accepted, or assert against responses
     * these services cannot produce until a metals provider is contracted.
     */
    it(`${entry} carries the idempotency contract`, async () => {
      const res = await request(replicaA.getHttpServer())
        .post(path as string)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'not a valid key')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error.code', 'bad_request');
      expect(res.body.error.message).toMatch(/idempotency-key/i);
      // Every one of those routes also declares what a refusal looks like, so
      // a client can parse a conflict on the endpoint it actually called.
      expect(
        CONTRACT_REGISTRY[`ERROR ${method} ${path}` as 'ERROR POST /api/v1/swaps/quotes'],
      ).toBeDefined();
    });
  }

  it('a route that is not financial ignores the header entirely', async () => {
    // The control. Without it the three assertions above could pass for the
    // wrong reason — a filter rejecting the header on every route, rather than
    // the interceptor rejecting it on the decorated ones.
    const res = await request(replicaA.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Idempotency-Key', 'not a valid key')
      .send({ email: 'nobody@correnthian.test', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(String(res.body?.error?.message ?? '')).not.toMatch(/idempotency-key/i);
  });
});