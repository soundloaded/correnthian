import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { RedisService } from '../../redis/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hashSessionToken } from '../../auth/token-hash.js';
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
const TEST_AUTH_CEILING = 2;

describe.skipIf(!HAS_DB && !CI)('rate limiting (live)', () => {
  let app: INestApplication;
  let redis: RedisService;
  let prisma: PrismaService;
  let token = '';
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

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();

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
    await sweep();
  }, 60_000);

  afterAll(async () => {
    await sweep();
    delete process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'];
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

    const key = note(`correnthian:rate:api:session:${hashSessionToken(token)}`);
    expect(await redis.raw.exists(key)).toBe(1);

    const ttl = await redis.raw.ttl(key);
    // `RATE_LIMIT_WINDOW_SECONDS` defaults to 60 and is not overridden here.
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it('counts a bearer request against the session the database knows', async () => {
    // DEF-005. The key must be `Session.tokenHash`, or the limiter is counting
    // sessions that cannot be resolved.
    await request(app.getHttpServer())
      .get('/api/v1/chains')
      .set('Authorization', `Bearer ${token}`);

    const key = note(`correnthian:rate:api:session:${hashSessionToken(token)}`);
    expect(await redis.raw.exists(key)).toBe(1);
    expect(Number(await redis.raw.get(key))).toBeGreaterThanOrEqual(1);
  });

  it('gives one token one budget across repeated requests', async () => {
    const key = `correnthian:rate:api:session:${hashSessionToken(token)}`;
    const before = Number((await redis.raw.get(key)) ?? '0');

    await request(app.getHttpServer())
      .get('/api/v1/chains')
      .set('Authorization', `Bearer ${token}`);

    const after = Number((await redis.raw.get(key)) ?? '0');
    expect(after).toBe(before + 1);
  });

  it('counts an anonymous sign-in against the client address', async () => {
    // The credential-stuffing path. There is no session to resolve — you
    // cannot require a session in order to obtain one — so the address is the
    // only identity available, and it is the right one for this route.
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@invalid.test', password: 'wrong-password-entirely' });

    expect([401, 429]).toContain(res.status);

    const keys = await redis.raw.keys('correnthian:rate:auth:ip:*');
    expect(keys.length).toBeGreaterThanOrEqual(1);
    for (const k of keys) note(k);
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
