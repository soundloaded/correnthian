import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { discoverRoutes } from './discover.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Every role-gated route, over HTTP, with a real session. BE-1703.
 *
 * `routes.spec.ts` proves an anonymous request gets 401. It cannot prove that
 * a *signed-in customer* gets 403 — the request never gets past `SessionGuard`
 * there, so `RolesGuard` is never exercised at all. That is the exact gap this
 * file closes: a controller that lost its `@Roles()` still answers 401 to a
 * stranger and still passes every suite that exists, while answering `200` to
 * any account holder who tries. `DEF-001` shipped as a dead endpoint because
 * every suite stopped at the wrong layer; this is that lesson applied to
 * authorisation rather than to handlers.
 *
 * THREE PROPERTIES
 * ----------------
 *  1. A route carrying `@Roles(...)` refuses a `user` session with **403** —
 *     not 401 (they are authenticated), not 200 (they are unauthorised), not
 *     500 (the guard chain did not crash), not 429 (the rate limiter is not
 *     what is being tested here).
 *  2. The set of role-gated routes is pinned below. Discovery alone cannot
 *     catch a route *becoming* ungated — it would simply drop out of the list
 *     and every other assertion still passes.
 *  3. An `admin` session is *admitted* where the hierarchy says it should be.
 *     Without this, a guard that denied everyone unconditionally would pass
 *     assertions 1 and 2. The hierarchy comparison is arithmetic on a table
 *     written in this file, not a call into `roleSatisfies` — a check that
 *     consults the same code it is testing agrees with that code even when
 *     both are wrong.
 *
 * DISCOVERY, NOT A LIST, EXCEPT THE PIN
 * -------------------------------------
 * Same approach as `routes.spec.ts` — read the controllers at run time, so a
 * controller added tomorrow is exercised tomorrow — and the same correction:
 * the decorator window ends at the method *name*, offset included. The class
 * window runs to `export class`, because `@Roles` above or below
 * `@Controller()` both apply; Nest's metadata carries no ordering.
 *
 * The user session is made the honest way: `POST /auth/register` creates an
 * account with `role: user` by default and opens a session, exactly as a real
 * customer would. No direct database writes, no minted tokens.
 */
/** Duplicated from `routes.spec.ts` deliberately — these files boot their own app. */
const urlFor = (path: string) => (/^\/health(\/|$)/.test(path) ? path : `/api/v1${path}`);
const placeholder = (path: string) => path.replace(/:[A-Za-z0-9_]+/g, 'missing');

/**
 * The hierarchy as this test understands it — literals, so the arithmetic and
 * `ROLE_RANK` cannot be wrong in the same way at the same time.
 */
const RANK: Record<string, number> = {
  user: 0, support: 1, compliance: 2, admin: 3, owner: 4,
};

const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);
/**
 * Every role-gated route as of 2026-10-09, with what each requires.
 *
 * Checked in on purpose. A route that loses its `@Roles()` disappears from
 * discovery, and both behavioural assertions then pass over a route that is
 * now open to any signed-in account.
 */
/**
 * Every role-gated route as of 2026-10-09, with what each requires. 40 of
 * them: 34 handler-level `@Roles` plus 6 routes covered by the two
 * class-level decorators (`audit` and `users`).
 *
 * Checked in on purpose. A route that loses its `@Roles()` disappears from
 * discovery, and both behavioural assertions below then pass over a route
 * that is now open to any signed-in account — discovery alone cannot catch a
 * gate being *removed*.
 */
const EXPECTED_GATED: string[] = [
  'GET /audit -> compliance',
  'GET /audit/:id -> compliance',
  'GET /audit/actor/:actorId -> compliance',
  'GET /blockchain/health -> support',
  'GET /devices/all -> support',
  'GET /devices/stats -> support',
  'GET /fees/rules -> admin',
  'GET /fees/rules/:id -> admin',
  'GET /fees/rules/diagnostics -> admin',
  'GET /issuers -> support',
  'GET /issuers/:slug -> support',
  'GET /issuers/stats -> support',
  'GET /jobs -> support',
  'GET /notifications/stats -> support',
  'GET /redemptions/stats -> support',
  'GET /swaps/quotes -> support',
  'GET /swaps/quotes/stats -> support',
  'GET /transactions -> support',
  'GET /transactions/stats -> support',
  'GET /users -> support',
  'GET /users/:id -> support',
  'GET /users/stats -> support',
  'PATCH /assets/:assetId/attestation -> compliance',
  'PATCH /assets/:assetId/enabled -> admin',
  'PATCH /chains/:id/enabled -> admin',
  'PATCH /fees/rules/:id -> owner',
  'PATCH /issuers/:slug/licences -> compliance',
  'PATCH /issuers/:slug/risk-flags -> compliance',
  'PATCH /issuers/:slug/verification -> compliance',
  'PATCH /providers/:slug/status -> admin',
  'PATCH /redemptions/:id/transition -> compliance',
  'PATCH /users/:id/role -> admin',
  'PATCH /users/:id/status -> admin',
  'POST /assets -> compliance',
  'POST /fees/rules -> owner',
  'POST /issuers -> compliance',
  'POST /jobs/:name/run -> admin',
  'POST /notifications -> support',
  'POST /pricing/record -> support',
  'POST /transactions/:id/observations -> support',
];

describe.skipIf(!HAS_DB && !CI)('every role-gated route refuses a customer', () => {
  let app: INestApplication;
  let userToken = '';
  let adminToken = '';
  const discovered = discoverRoutes().routes.filter((r) => r.roles.length > 0);
  const seen: string[] = [];

  const gated = () =>
    discovered.map((r) => `${r.method.toUpperCase()} ${r.path} -> ${r.roles.join('|')}`).sort();

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';
    // Own keyspace — see the note in `routes.spec.ts`. This suite spends from
    // the same `rate:auth:ip:127.0.0.1` budget otherwise.
    //
    // Index 13 because 0 is the app, 14 is `routes.spec` and 15 is the
    // rate-limit live spec — and because a Redis default config serves 16
    // databases, 0..15. Index 16 does not exist: the SELECT fails, ioredis
    // retries it, and `app.init()` hangs forever with nothing in the log.
    // That is how this file first failed, and it is worth remembering that a
    // out-of-range index costs a hang rather than an error.
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/13`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();

    // A customer, made the way a customer is made.
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `roles-spec-${Date.now()}@example.test`,
        password: 'correct-horse-battery-staple',
      });
    expect(register.status, `register: ${JSON.stringify(register.body)}`).toBe(201);
    expect(register.body.user.role).toBe('user');
    userToken = register.body.token;

    // The seeded operator, for the admission control below.
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: process.env.CONTRACT_TEST_EMAIL ?? 'admin@correnthian.local',
        password: process.env.CONTRACT_TEST_PASSWORD ?? 'correct-horse-battery-staple',
      });
    expect(login.status, `admin login: ${JSON.stringify(login.body)}`).toBe(200);
    expect(login.body.user.role).toBe('admin');
    adminToken = login.body.token;
  }, 60_000);

  afterAll(async () => {
    // The registered account is the only row this suite creates; user rows
    // cascade their sessions. The seeded admin must outlive this file.
    try {
      if (app) await app.get(PrismaService).user.deleteMany({
        where: { email: { startsWith: 'roles-spec-' } },
      });
    } catch {
      // A failed boot may have left no prisma to clean; the rows are inert
      // either way and the email prefix keeps them identifiable.
    }
    await app?.close();
    delete process.env['RATE_LIMIT_MAX_REQUESTS'];
    delete process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'];
    delete process.env['REDIS_URL'];
  });

  /** One gated request, method taken case-insensitively from discovery. */
  const hit = (route: { method: string; path: string }, token: string) => {
    const req = request(app.getHttpServer())[
      route.method.toLowerCase() as 'get'
    ](urlFor(placeholder(route.path)));
    return route.method.toUpperCase() === 'GET'
      ? req.set('Authorization', `Bearer ${token}`)
      : req.set('Authorization', `Bearer ${token}`).send({});
  };

  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) {
      throw new Error('Role coverage cannot skip in CI. A guard that does not run is not a guard.');
    }
    expect(discovered.length).toBeGreaterThan(10);
  });

  it('the customer session works at all', async () => {
    // Otherwise every 403 below could be a 401 from a broken session wearing
    // the right number, and the test would pass while proving nothing.
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('user');
  });

  it('gates exactly the routes that are meant to be gated', () => {
    expect(gated()).toEqual(EXPECTED_GATED);
  });

  it('every gated route answers 403 to a customer session', async () => {
    const failures: string[] = [];

    for (const route of discovered) {
      const res = await hit(route, userToken);

      seen.push(`${route.method} ${route.path}`);
      if (res.status !== 403) {
        failures.push(
          `${route.method} ${route.path} (needs ${route.roles.join('|')}) -> ${res.status}`,
        );
      }
    }

    expect(failures, `these routes did not refuse a customer with 403:\n${failures.join('\n')}`).toEqual([]);
  }, 120_000);

  it('an admin session is admitted where the hierarchy admits it', async () => {
    // GET routes only: reads have no side effects when the handler runs, and
    // this control exists to prove the guard is not a blanket deny — the unit
    // spec covers who satisfies what across every tier.
    const failures: string[] = [];

    // `.toUpperCase()`: discovery emits `Get`, and a filter comparing `'GET'`
    // matched nothing — this control ran zero iterations and passed for as
    // long as it existed, which a mutation run caught. The count assertion
    // below is what keeps that from coming back.
    const getRoutes = discovered.filter((r) => r.method.toUpperCase() === 'GET');
    expect(getRoutes.length, 'the admission control must iterate routes').toBeGreaterThan(5);
    for (const route of getRoutes) {
      const adminAdmits = route.roles.some((r) => (RANK[r] ?? Infinity) <= RANK['admin']!);
      const res = await request(app.getHttpServer())
        .get(urlFor(placeholder(route.path)))
        .set('Authorization', `Bearer ${adminToken}`);

      seen.push(`${route.method} ${route.path}`);
      if (adminAdmits && res.status === 403) {
        failures.push(`${route.method} ${route.path} (needs ${route.roles.join('|')}) -> 403 for admin`);
      }
      if (!adminAdmits && res.status !== 403) {
        failures.push(
          `${route.method} ${route.path} (needs ${route.roles.join('|')}) -> ${res.status}, expected 403 for admin`,
        );
      }
    }

    expect(failures, `hierarchy disagreement:\n${failures.join('\n')}`).toEqual([]);
  }, 60_000);

  it('nothing gated crashes either session', async () => {
    const crashes: string[] = [];
    for (const token of [userToken, adminToken]) {
      for (const route of discovered) {
        const res = await hit(route, token);
        if (res.status >= 500) {
          crashes.push(`${route.method} ${route.path} -> ${res.status}`);
        }
      }
    }
    expect(crashes, `these routes crashed:\n${crashes.join('\n')}`).toEqual([]);
  }, 180_000);
});
