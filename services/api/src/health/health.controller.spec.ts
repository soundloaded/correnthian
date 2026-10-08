import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

/**
 * DEF-006: the readiness probe never returned 503.
 *
 * The docstring promised "fails with 503 when a required dependency is down so
 * traffic is diverted, not dropped" and the handler always answered 200 with a
 * `degraded` flag — so an orchestrator that reads only the status code kept
 * routing to a process that could not serve.
 *
 * These are controller-level tests against `supertest`, with the two
 * dependencies stubbed, because the failure paths cannot be produced against a
 * healthy stack: forcing a real Redis outage to observe one 503 would mean
 * taking the environment down for the duration of the test, and would still be
 * testing the test environment rather than the handler.
 *
 * What is *not* covered here and is stated rather than implied: this does not
 * exercise the 200 path against live infrastructure. That is verified separately
 * against the running API.
 */

const prisma = { isHealthy: vi.fn() };
const redis = { isHealthy: vi.fn() };

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      { provide: PrismaService, useValue: prisma },
      { provide: RedisService, useValue: redis },
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  prisma.isHealthy.mockReset().mockResolvedValue(true);
  redis.isHealthy.mockReset().mockResolvedValue(true);
});

const bothUp = () => Promise.all([prisma.isHealthy(), redis.isHealthy()]);

describe('GET /health/ready', () => {
  it('returns 200 when both dependencies are up', async () => {
    await bothUp();
    const res = await request(app.getHttpServer()).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dependencies.database.status).toBe('up');
    expect(res.body.dependencies.redis.status).toBe('up');
  });

  it('returns 503 when the database is down — the defect', async () => {
    prisma.isHealthy.mockResolvedValue(false);

    const res = await request(app.getHttpServer()).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.database.status).toBe('down');
    // Redis is still fine, and the response still says so: diverting traffic
    // must not cost the operator the reason.
    expect(res.body.dependencies.redis.status).toBe('up');
  });

  it('returns 503 when redis is down', async () => {
    redis.isHealthy.mockResolvedValue(false);

    const res = await request(app.getHttpServer()).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.redis.status).toBe('down');
    expect(res.body.dependencies.database.status).toBe('up');
  });

  it('returns 503 when both are down', async () => {
    prisma.isHealthy.mockResolvedValue(false);
    redis.isHealthy.mockResolvedValue(false);

    const res = await request(app.getHttpServer()).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
  });

  it('treats a check that throws as down, not as an unhandled error', async () => {
    // `time()` catches: a dependency whose probe blows up must not become a 500
    // that an orchestrator reads as "the process is broken" rather than "the
    // dependency is".
    prisma.isHealthy.mockRejectedValue(new Error('connection reset'));

    const res = await request(app.getHttpServer()).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.database.status).toBe('down');
  });

  it('keeps the body shape identical across both status codes', async () => {
    const up = await request(app.getHttpServer()).get('/health/ready');
    prisma.isHealthy.mockResolvedValue(false);
    const down = await request(app.getHttpServer()).get('/health/ready');

    expect(Object.keys(up.body).sort()).toEqual(['dependencies', 'status']);
    expect(Object.keys(down.body).sort()).toEqual(['dependencies', 'status']);
    // The shared error envelope must not have swallowed the body: that was the
    // reason for setting the status through `passthrough` instead of throwing.
    expect(down.body).not.toHaveProperty('error');
    expect(down.body.dependencies).toHaveProperty('database');
    expect(down.body.dependencies).toHaveProperty('redis');
  });

  it('reports latency for each dependency', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');

    expect(typeof res.body.dependencies.database.latencyMs).toBe('number');
    expect(typeof res.body.dependencies.redis.latencyMs).toBe('number');
    expect(res.body.dependencies.database.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /health/live', () => {
  it('stays 200 even when a dependency is down', async () => {
    // Liveness and readiness are different questions. A database outage must
    // pull the process out of rotation; it must not make an orchestrator kill
    // and restart an otherwise healthy process — that turns a dependency
    // failure into an outage.
    prisma.isHealthy.mockResolvedValue(false);
    redis.isHealthy.mockResolvedValue(false);

    const res = await request(app.getHttpServer()).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('does not touch dependencies at all', async () => {
    await request(app.getHttpServer()).get('/health/live');

    expect(prisma.isHealthy).not.toHaveBeenCalled();
    expect(redis.isHealthy).not.toHaveBeenCalled();
  });
});
