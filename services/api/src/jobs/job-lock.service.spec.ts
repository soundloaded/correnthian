import { describe, expect, it, vi, beforeEach } from 'vitest';
import { JobLockService } from './job-lock.service.js';
import { RedisService } from '../redis/redis.service.js';

/**
 * JobLockService against a scripted Redis — batch B gap.
 *
 * The property under test is fail-closed: a lost race answers null (never
 * a lease), and a Redis error answers null rather than granting a lease
 * nobody verified was free. The grant path returns a lease whose extend
 * reports the Lua verdict honestly.
 */
function makeRedis(behavior: { set?: unknown; setError?: Error; evalResult?: unknown }) {
  return {
    raw: {
      set: vi.fn(async () => {
        if (behavior.setError) throw behavior.setError;
        return behavior.set ?? null;
      }),
      eval: vi.fn(async () => behavior.evalResult ?? 0),
      pTTL: vi.fn(async () => 1000),
    },
  } as unknown as RedisService;
}

const svc = (r: RedisService) => new JobLockService(r);

describe('lease acquisition is fail-closed', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('grants exactly one winner with an extendable lease', async () => {
    const lease = await svc(makeRedis({ set: 'OK', evalResult: 1 })).acquire('job-a', 30_000);
    expect(lease).not.toBeNull();
    await expect(lease!.extend(30_000)).resolves.toBe(true);
    await lease!.release();
  });

  it('a lost race answers null', async () => {
    await expect(svc(makeRedis({ set: null })).acquire('job-a', 30_000)).resolves.toBeNull();
  });

  it('a Redis error answers null, never a granted lease', async () => {
    await expect(
      svc(makeRedis({ setError: new Error('connection reset') })).acquire('job-a', 30_000),
    ).resolves.toBeNull();
  });

  it('extend reports the Lua verdict rather than assuming ownership', async () => {
    const lease = await svc(makeRedis({ set: 'OK', evalResult: 0 })).acquire('job-a', 30_000);
    await expect(lease!.extend(30_000)).resolves.toBe(false);
  });
});
