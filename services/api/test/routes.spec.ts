import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { countRouteDecorators, discoverRoutes } from './discover.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';

/**
 * Every route, over HTTP, without a session.
 *
 * BE-1702. 21 of 22 controllers had no test outside the contract suite, and
 * `DEF-001` shipped as a fully unit-tested *dead endpoint* because the service
 * was tested, the controller was not, and nothing in between exercised the
 * route. Reading code found every defect this sprint; this is the layer that
 * would have caught them.
 *
 * THE THREE PROPERTIES
 * --------------------
 *  1. A route that is not `@Public` refuses an anonymous caller with 401.
 *     This is the deny-by-default guarantee the whole API rests on, checked
 *     across all of it rather than on the routes someone remembered.
 *  2. A route that *is* `@Public` does not answer 401 — an accidental guard on
 *     `/auth/login` would lock every operator out, and it would look like an
 *     authentication bug rather than a missing decorator.
 *  3. Nothing answers 500 to a trivial unauthenticated request. A 500 here is
 *     a handler running before authorisation, or a crash in the guard chain.
 *
 * WHY DISCOVERY, NOT A LIST
 * -------------------------
 * The routes are read from the controller files at run time, so a controller
 * added tomorrow is exercised tomorrow — a checked-in list would be updated
 * *after* it broke. The companion assertion is that every controller file
 * contributed at least one route: discovery that silently stops parsing a new
 * decorator shape would otherwise shrink coverage while looking green.
 *
 * ANONYMOUS ONLY, ON PURPOSE
 * --------------------------
 * Every request here has no session, so a protected route is rejected by
 * `SessionGuard` before its handler runs — no handler executes, no row is
 * written, and DELETE/PATCH routes are safe to include. The one `@Public`
 * mutating route (`POST /auth/register`) is sent an empty body, which the
 * zod pipe rejects before the service.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

/**
 * The routes this API exposes without a session.
 *
 * Checked in on purpose. Without it, discovery alone cannot catch a route
 * *becoming* public — the route simply moves to the other list and both
 * assertions still pass, which is how a stray `@Public()` on `GET /users` would
 * reach production looking green. Changing this list is the review.
 *
 * Fourteen today: three health/meta probes that an orchestrator or a status
 * page must reach unauthenticated, two identity endpoints that have to work
 * before a session exists, one idempotent sign-out a stale token must still
 * reach, two availability checks a visitor sees before signing up, the client
 * configuration a client reads before it offers anything, the four one-time
 * link endpoints (a sign-in link and a password reset, requested and
 * consumed) which have to work before a session exists, and the signed vendor
 * webhook.
 */
const EXPECTED_PUBLIC = [
  'GET /compliance/eligibility',
  'GET /config',
  'GET /health/live',
  'GET /health/ready',
  'GET /meta/versions',
  'GET /onramp/availability',
  'POST /auth/login',
  'POST /auth/logout',
  'POST /auth/magic-link',
  'POST /auth/magic-link/consume',
  'POST /auth/password-reset',
  'POST /auth/password-reset/confirm',
  'POST /auth/register',
  'POST /compliance/webhooks/persona',
].sort();

/** `/health` is unversioned on purpose; everything else is behind `/api/v1`. */
const urlFor = (path: string) => (/^\/health(\/|$)/.test(path) ? path : `/api/v1${path}`);

const placeholder = (path: string) => path.replace(/:[A-Za-z0-9_]+/g, 'missing');

describe.skipIf(!HAS_DB && !CI)('every route refuses an anonymous caller', () => {
  let app: INestApplication;
  const discovered = discoverRoutes();
  const seen: string[] = [];

  beforeAll(async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '100000';
    process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'] = '100000';

    // Own keyspace. Every suite in this run spends from
    // `rate:auth:ip:127.0.0.1` — one shared counter with a budget of 10 — so
    // this file's four sign-in requests could push another suite's register
    // call into 429 and fail a test that has nothing to do with routes. The
    // counters only need to exist for this app to make a decision; they do not
    // need to be anybody else's. `PING` still answers, so health is unaffected.
    const redisBase = (process.env['REDIS_URL'] ?? 'redis://localhost:6380').replace(/\/\d+$/, '');
    process.env['REDIS_URL'] = `${redisBase}/14`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    delete process.env['RATE_LIMIT_MAX_REQUESTS'];
    delete process.env['RATE_LIMIT_AUTH_MAX_REQUESTS'];
    delete process.env['REDIS_URL'];
  });

  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) {
      throw new Error(
        'Route coverage cannot skip in CI. A guard over the whole route table ' +
          'that does not run is not a guard.',
      );
    }
    expect(discovered.routes.length).toBeGreaterThan(50);
  });

  it('reads every route decorator, not a parseable subset', () => {
    // The failure this catches: discovery *skips* what it cannot parse, and
    // every other test then passes over the remaining routes. `GET /jobs` sat
    // outside a fixed look-ahead window for as long as the window existed —
    // invisible to the 401 guard, the public pin and the 500 check alike —
    // while the per-file "at least one" check stayed green because the file's
    // other route was found.
    const decorators = countRouteDecorators();
    expect(discovered.routes.length).toBe(decorators);
  });

  it('reads at least one route out of every controller file', () => {
    // If discovery stops understanding a decorator, coverage shrinks silently
    // while every assertion below still passes. A controller with zero routes
    // found is how that shows up.
    const silent = [...discovered.byFile.entries()].filter(([, n]) => n === 0);
    expect(silent, `no routes discovered in: ${silent.map(([f]) => f).join(', ')}`).toEqual([]);
  });

  it('every protected route answers 401 without a session', async () => {
    const failures: string[] = [];

    for (const route of discovered.routes.filter((r) => !r.isPublic)) {
      const res = await (route.method === 'GET' ? request(app.getHttpServer()).get(urlFor(placeholder(route.path))) : request(app.getHttpServer())[route.method.toLowerCase() as 'post'](urlFor(placeholder(route.path))).send({}));

      seen.push(`${route.method} ${route.path}`);
      if (res.status !== 401) failures.push(`${route.method} ${route.path} -> ${res.status}`);
    }

    expect(failures, `these routes did not refuse an anonymous caller:\n${failures.join('\n')}`).toEqual([]);
  }, 120_000);

  it('exposes exactly the routes that are meant to be public', () => {
    // The one assertion discovery alone cannot make: a route that becomes
    // public is discovered as public, and every other check still passes.
    const actual = discovered.routes
      .filter((r) => r.isPublic)
      .map((r) => `${r.method.toUpperCase()} ${r.path}`)
      .sort();

    expect(actual).toEqual(EXPECTED_PUBLIC);
  });

  it('every public route does not answer 401', async () => {
    const failures: string[] = [];

    for (const route of discovered.routes.filter((r) => r.isPublic)) {
      const res = await (route.method === 'GET' ? request(app.getHttpServer()).get(urlFor(placeholder(route.path))) : request(app.getHttpServer())[route.method.toLowerCase() as 'post'](urlFor(placeholder(route.path))).send({}));

      seen.push(`${route.method} ${route.path}`);
      // Except the signed webhook: it is @Public because no session exists
      // for a vendor callback, but its authentication is the HMAC signature,
      // not the absence of auth — an unsigned call is a forgery probe, and
      // 401 is the correct answer. Without the carve-out this test would
      // force the webhook to accept unsigned bytes.
      if (route.path === '/compliance/webhooks/persona') {
        expect(res.status, 'unsigned webhook must be refused').toBe(401);
        continue;
      }
      if (res.status === 401) failures.push(`${route.method} ${route.path} -> 401`);
    }

    expect(failures, `these @Public routes answered 401, which would lock out a real caller:\n${failures.join('\n')}`).toEqual([]);
  }, 60_000);

  it('no route answers 500 to a trivial unauthenticated request', async () => {
    const crashes: string[] = [];

    for (const route of discovered.routes) {
      const res = await (route.method === 'GET' ? request(app.getHttpServer()).get(urlFor(placeholder(route.path))) : request(app.getHttpServer())[route.method.toLowerCase() as 'post'](urlFor(placeholder(route.path))).send({}));
      if (res.status >= 500) crashes.push(`${route.method} ${route.path} -> ${res.status}`);
    }

    expect(crashes, `these routes crashed:\n${crashes.join('\n')}`).toEqual([]);
  }, 180_000);

  it('exercised every discovered route', () => {
    const covered = new Set(seen);
    const missed = discovered.routes
      .map((r) => `${r.method} ${r.path}`)
      .filter((k) => !covered.has(k));
    expect(missed, `not exercised: ${missed.join(', ')}`).toEqual([]);
  });
});
