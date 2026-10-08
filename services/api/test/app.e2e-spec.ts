import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { applyApiVersioning } from '../src/versioning/apply-versioning.js';

/**
 * Application smoke test.
 *
 * This file was the Nest scaffold's: `GET /` expecting `200` and the body
 * `Hello World!`. There is no root route — it answers 404 — so `pnpm test:e2e`
 * has never passed, which is why nobody noticed that it did not run in CI
 * either (DEF-013).
 *
 * Replaced with the four properties this application actually guarantees at
 * the outermost edge: it boots, liveness answers without touching a
 * dependency, readiness reports its dependencies under either status code
 * (the DEF-006 contract), and a protected route refuses an anonymous caller.
 * None of them depend on fixtures, so none of them can be green for the wrong
 * reason.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CI = Boolean(process.env.CI);

describe.skipIf(!HAS_DB && !CI)('application (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyApiVersioning(app);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it('is running rather than skipped', () => {
    if (CI && !HAS_DB) {
      throw new Error(
        'The e2e suite cannot skip in CI. An app-level smoke test that is not ' +
          'run is worse than none: it asserts the application boots while ' +
          'checking nothing. Fix the DATABASE_URL or the job.',
      );
    }
    expect(HAS_DB).toBe(CI ? true : HAS_DB);
  });

  it('liveness answers 200 without consulting a dependency', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('readiness reports its dependencies under either status code', async () => {
    // 200 when both are up, 503 when one is down (DEF-006). Asserting the body
    // under both is what makes the 503 useful: an orchestrator reads the status,
    // an operator reads `dependencies`.
    const res = await request(app.getHttpServer()).get('/health/ready');

    expect([200, 503]).toContain(res.status);
    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(res.body.dependencies).toBeDefined();
    expect(res.body.dependencies.database).toHaveProperty('status');
    expect(res.body.dependencies.redis).toHaveProperty('status');
    expect(typeof res.body.dependencies.database.latencyMs).toBe('number');
  });

  it('refuses a protected route to an anonymous caller', async () => {
    // Deny-by-default is the security property the whole API rests on. It is
    // cheap to assert here and would catch a route registered without @Public()
    // but also without SessionGuard.
    const res = await request(app.getHttpServer()).get('/api/v1/users');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
  });

  it('has no root route, because there is nothing to serve at it', async () => {
    const res = await request(app.getHttpServer()).get('/');

    expect(res.status).toBe(404);
  });
});
