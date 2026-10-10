import { describe, expect, it, vi } from 'vitest';
import { RedisService } from './redis.service.js';

/**
 * RedisService health — batch B gap.
 *
 * `isHealthy` is the only logic in this file (lifecycle delegates to the
 * driver), and its contract is boolean-only: a ping failure, a missing
 * client, any rejection — all answer false, never throw. A health check
 * that throws is a health check that takes the readiness probe down with
 * the dependency it was measuring.
 */
const config = { redis: { url: 'redis://localhost:6380/0' } };
const svc = () => new RedisService(config as never);

describe('redis health never throws', () => {
  it('answers true on PONG', async () => {
    const s = svc();
    (s as unknown as { client: unknown }).client = { isReady: true, ping: vi.fn(async () => 'PONG') };
    await expect(s.isHealthy()).resolves.toBe(true);
  });

  it('answers false when the ping rejects', async () => {
    const s = svc();
    (s as unknown as { client: unknown }).client = {
      isReady: true,
      ping: vi.fn(async () => { throw new Error('down'); }),
    };
    await expect(s.isHealthy()).resolves.toBe(false);
  });

  it('answers false when there is no client yet', async () => {
    await expect(svc().isHealthy()).resolves.toBe(false);
  });
});
