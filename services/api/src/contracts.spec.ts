import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { CONTRACT_REGISTRY } from '@correnthian/contracts';

/**
 * The wire-format contract test.
 *
 * This is the test that closes the gap that cost three incidents: the admin
 * hand-wrote its response types, nothing compared them to what the API
 * actually returns, and each mismatch surfaced as a broken page rather than a
 * failed build.
 *
 * Here the API is booted for real against the development database, every
 * endpoint the console consumes is called, and the response is parsed through
 * the same schema the client infers its types from. A field added, renamed,
 * nested differently or dropped breaks this test rather than a page.
 *
 * Requires the Docker stack: `pnpm db:up`.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Locally this suite skips when no database is configured, so a contributor
 * without the Docker stack can still run the fast tests.
 *
 * In CI it must never skip. A green build that silently omitted the contract
 * check would be worse than having no check at all — it would assert that
 * drift is impossible while proving nothing. So CI runs it unconditionally and
 * fails if the database is unreachable.
 */
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('API wire-format contracts', () => {
  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) {
      throw new Error(
        'The contract suite cannot skip in CI. The wire-format guarantee is ' +
          'the whole point of this file — fix the database service or the job.',
      );
    }
    expect(HAS_DB).toBe(CI ? true : HAS_DB);
  });

  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    // Authenticate as the seeded admin so the endpoints behind auth are
    // covered. Configurable because CI seeds its own throwaway account —
    // hardcoding local credentials here would fail the moment the CI seed
    // differs, which is exactly the kind of drift this suite exists to catch.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.CONTRACT_TEST_EMAIL ?? 'admin@correnthian.local',
        password: process.env.CONTRACT_TEST_PASSWORD ?? 'correct-horse-battery-staple',
      });
    token = login.body?.token ?? '';
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const ENDPOINTS: Array<[keyof typeof CONTRACT_REGISTRY, string]> = [
    ['GET /assets', '/assets'],
    ['GET /assets/stats', '/assets/stats'],
    ['GET /users', '/users'],
    ['GET /users/stats', '/users/stats'],
    ['GET /devices/all', '/devices/all'],
    ['GET /devices/stats', '/devices/stats'],
    ['GET /issuers', '/issuers'],
    ['GET /chains', '/chains'],
    ['GET /providers', '/providers'],
    ['GET /swaps/quotes/stats', '/swaps/quotes/stats'],
    ['GET /audit', '/audit'],
  ];

  it('authenticates as the seeded admin', () => {
    expect(token).not.toBe('');
  });

  for (const [key, path] of ENDPOINTS) {
    it(`${key} matches its contract`, async () => {
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status, `${path} returned ${res.status}: ${JSON.stringify(res.body)}`).toBe(200);

      const parsed = CONTRACT_REGISTRY[key].safeParse(res.body);
      if (!parsed.success) {
        // Print the exact divergence — a bare "invalid" is useless here.
        const detail = parsed.error.issues
          .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('\n');
        throw new Error(`${path} does not match its contract:\n${detail}`);
      }
      expect(parsed.success).toBe(true);
    });
  }

  it('GET /users/:id matches its contract', async () => {
    const list = await request(app.getHttpServer())
      .get('/users').set('Authorization', `Bearer ${token}`);
    const id = list.body?.items?.[0]?.id;
    if (!id) return; // no seeded user to check

    const res = await request(app.getHttpServer())
      .get(`/users/${id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const parsed = CONTRACT_REGISTRY['GET /users/:id'].safeParse(res.body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [], null, 2)).toBe(true);
  });

  it('every failure uses the shared error envelope', async () => {
    const res = await request(app.getHttpServer()).get('/users/not-a-real-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error.code');
    expect(res.body).toHaveProperty('error.message');
    expect(res.body).toHaveProperty('timestamp');
  });
});
