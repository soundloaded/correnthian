import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { RedisService } from '../../redis/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { applyApiVersioning } from '../../versioning/apply-versioning.js';

/**
 * The rate limiter against a real Redis, real config loading and the real
 * guard chain.
 *
 * The unit spec owns the arithmetic. What only a live run can show is that the
 * configuration actually reaches the guard through dependency injection — the
 * whole of DEF-004 was a value that was validated at boot and then ignored —
 * and that the bucket written to Redis is the one the database recognises.
 *
 * Same skip rule as the contract suite: locally it needs the Docker stack, and
 * it must never skip in CI, because a green build that omitted this would be
 * asserting a property it did not check.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

/** Low enough that reaching it takes milliseconds, not a rate-limit window. */
// Tight enough that `10` (the guard's old constant) would be visibly wrong,
// loose enough that the tests below which sign in cannot exhaust it. At 2 the
// second sign-in of the suite rode the limit and this spec failed intermittently.
const TEST_AUTH_CEILING = 8;

describe.skipIf(!HAS_DB && !CI)('rate limiting (live)', () => {
  let app: INestApplication;
  let redis: RedisService;
  let prisma: PrismaService;
  let token = '';
  let other = '';
  const keysTouched = new Set<string>();

  const note = (key: string) => {
    keysTouched.add(key);
    return key;
  };

  /** Every rate key this suite may have written, for a clean teardown. */
  const sweep = async () => {
    const used = await redis.raw.keys('correnthian:rate:*');
    for (const k of used) note(k);
    if (used.length > 0) await redis.raw.del(used);
    keysTouched.clear();
  };

  beforeAll(async () => {
    // Set before the app is built: `ConfigService` validates `process.env` once,
    // when DI constructs it. This worker has its own copy of `process.env`.
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = String(TEST_AUTH_CEILING);
    // Also required for the address tests below: without it Express ignores
    // X-Forwarded-For and every request is the socket address, which would let
    // a key-on-IP guard pass a test written to catch keying on IP.
    process.env['TRUST_PROXY'] = 'true';
    // Own keyspace. Three other suites flush `correnthian:rate:*` against the
    // same Redis in their own `beforeAll`, and a flush landing inside this
    // suite's counter loop means the ceiling is never reached — so the test
    // that proves enforcement fails for a reason that has nothing to do with
    // enforcement. A separate database index makes the keyspace ours alone;
    // `PING` still works, so the health check is unaffected.
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/15`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
    // `main.ts` sets Express's trust proxy; this suite never runs `main.ts`, so
    // the header is ignored unless it is set here too — for the same reason the
    // version prefix has to be wired here.
    app.getHttpAdapter().getInstance().set('trust proxy', 1);

    redis = app.get(RedisService);
    prisma = app.get(PrismaService);
    await sweep();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: process.env.CONTRACT_TEST_EMAIL ?? 'admin@correnthian.local',
        password: process.env.CONTRACT_TEST_PASSWORD ?? 'correct-horse-battery-staple',
      });
    // `@Post('login')` is `@HttpCode(HttpStatus.OK)` — a sign-in is an
    // exchange, not a resource creation.
    expect(login.status).toBe(200);
    token = login.body.token as string;
    expect(token).toBeTruthy();

    // A second, independent session, minted here rather than inside a test:
    // signing in from a test spends from the same sign-in budget the first test
    // asserts on, and a suite that needs a fresh token to have a budget it has
    // already used is testing its own fixture.
    const second = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: process.env.CONTRACT_TEST_EMAIL ?? 'admin@correnthian.local',
        password: process.env.CONTRACT_TEST_PASSWORD ?? 'correct-horse-battery-staple',
      });
    expect(second.status, `second sign-in failed with ${second.status}`).toBe(200);
    other = second.body.token as string;
    expect(other).toBeTruthy();

    // Both sign-ins are over: start the assertions with an empty counter, so
    // the first test measures itself rather than the fixture.
    await sweep();
  }, 60_000);

  afterAll(async () => {
    await sweep();
    delete process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'];
    delete process.env['TRUST_PROXY'];
    delete process.env['REDIS_URL'];
    await app?.close();
    await prisma?.$disconnect();
  });

  it('advertises the configured sign-in ceiling, not a constant', async () => {
    // DEF-004. The guard hardcoded 10; the value below comes from
    // RATE_LIMIT_AUTH_MAX_REQUESTS through ConfigService.
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@invalid.test', password: 'wrong-password-entirely' });

    expect(res.headers['ratelimit-limit']).toBe(String(TEST_AUTH_CEILING));
    expect([401, 429]).toContain(res.status);
  });

  it('advertises the configured general ceiling', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/chains')
      .set('Authorization', `Bearer ${token}`);

    expect(res.headers['ratelimit-limit']).toBe('120');
  });

  it('applies the configured window to the counter', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/chains')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // Read from the response, not from Redis afterwards. Three other suites
    // clear `correnthian:rate:*` in their own `beforeAll`, so a key read on a
    // later round trip can be gone for reasons that have nothing to do with
    // this assertion — and a test that fails only when someone else's fixture
    // runs is not a test.
    //
    // The unit spec proves `expire` is called with the configured value; this
    // proves the counter actually carries a window that reaches the client.
    const reset = Number(res.headers['ratelimit-reset']);
    expect(Number.isFinite(reset)).toBe(true);
    expect(reset).toBeGreaterThan(0);
    expect(reset).toBeLessThanOrEqual(60);
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  /**
   * DEF-005, end to end: one bearer, two addresses, one budget.
   *
   * The key format itself is asserted exactly in the unit spec, where it can
   * be. What only a live run can show is that the guard is actually in the
   * chain and that `X-Forwarded-For` reaches it — which needs trust proxy, set
   * in `beforeAll` for exactly this test.
   *
   * Retried rather than assumed: a single sweep from another suite landing
   * between the two calls resets the counter, and the observation then looks
   * identical to a guard that keys on the address. Bounded retries keep the
   * test deterministic against the defect while tolerating the shared fixture.
   */
  it('gives one session one budget across two addresses', async () => {
    const call = (xff: string) =>
      request(app.getHttpServer())
        .get('/api/v1/chains')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', xff);

    let observed = false;
    for (let attempt = 0; attempt < 4 && !observed; attempt++) {
      const first = await call('203.0.113.9');
      const second = await call('198.51.100.4');
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const a = Number(first.headers['ratelimit-remaining']);
      const b = Number(second.headers['ratelimit-remaining']);
      // A shared session bucket falls across the pair. An address-keyed bucket
      // gives the second call a fresh one, so `b` restarts at the ceiling.
      observed = b < a;
    }
    expect(observed, 'session budget never fell across two addresses').toBe(true);
  });

  it('gives two sessions separate budgets behind one address', async () => {
    const call = (bearer: string) =>
      request(app.getHttpServer())
        .get('/api/v1/chains')
        .set('Authorization', `Bearer ${bearer}`)
        .set('X-Forwarded-For', '198.51.100.4');

    // Each session spends its own allowance: neither call may show the other's
    // usage, so both sit below the ceiling but neither has been halved by the
    // other. An address-keyed guard would make the second read continue the
    // first's count.
    const first = await call(token);
    const second = await call(other);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const ceiling = Number(first.headers['ratelimit-limit']);
    expect(Number(first.headers['ratelimit-remaining'])).toBeLessThan(ceiling);
    expect(Number(second.headers['ratelimit-remaining'])).toBe(ceiling - 1);
  });

  it('counts an anonymous sign-in against the tight budget', async () => {
    // The credential-stuffing path. There is no session to resolve — you
    // cannot require a session in order to obtain one — so an unauthenticated
    // sign-in must still spend a budget, and it must be the sign-in budget
    // rather than the general one.
    //
    // Asserted from the response headers: the Redis key scan this used to do
    // is subject to the same concurrent sweep as the tests above.
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@invalid.test', password: 'wrong-password-entirely' });

    expect([401, 429]).toContain(res.status);
    expect(res.headers['ratelimit-limit']).toBe(String(TEST_AUTH_CEILING));
    expect(Number(res.headers['ratelimit-remaining'])).toBeLessThan(TEST_AUTH_CEILING);
  });

  it('reaches the configured ceiling and refuses', async () => {
    // Bounded rather than `ceiling + 1`: the other suites in this run clear
    // `correnthian:rate:*` from their own `beforeAll`. A clear mid-loop resets
    // the counter, so this fires enough times to survive one, without asserting
    // an exact count that a concurrent clear would make a lie.
    const budget = TEST_AUTH_CEILING + 6;
    const statuses: number[] = [];

    for (let i = 0; i < budget; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@invalid.test', password: 'wrong-password-entirely' });
      statuses.push(res.status);
      if (res.status === 429) {
        expect(res.headers['retry-after']).toBeDefined();
        expect(res.headers['ratelimit-limit']).toBe(String(TEST_AUTH_CEILING));
        break;
      }
    }

    expect(statuses).toContain(429);
    expect(statuses).not.toContain(201);
  }, 30_000);
});
