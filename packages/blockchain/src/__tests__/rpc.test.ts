import { describe, expect, it } from 'vitest';
import { RpcPool } from '../rpc.js';

/** Resolves to `v`. */
const ok = <T>(v: T) => Promise.resolve(v);
/** Rejects, standing in for an endpoint that is down. */
const fail = () => Promise.reject(new Error('endpoint down'));

describe('RpcPool', () => {
  it('refuses to construct with no endpoints', () => {
    expect(() => new RpcPool([])).toThrow(/at least one/);
  });

  it('uses the first endpoint when it works', async () => {
    const pool = new RpcPool([{ url: 'a' }, { url: 'b' }]);
    expect(await pool.withFailover(() => ok(7))).toBe(7);
  });

  it('fails over to the next endpoint on error', async () => {
    const pool = new RpcPool([{ url: 'a' }, { url: 'b' }]);
    expect(await pool.withFailover((u) => (u === 'a' ? fail() : ok('from-b')))).toBe('from-b');
  });

  it('tries every endpoint before giving up', async () => {
    const pool = new RpcPool([{ url: 'a' }, { url: 'b' }, { url: 'c' }]);
    const attempted: string[] = [];
    await expect(
      pool.withFailover(async (u) => { attempted.push(u); return fail(); }),
    ).rejects.toThrow(/All 3 RPC endpoint/);
    expect(attempted).toEqual(['a', 'b', 'c']);
  });

  it('quarantines a failing endpoint rather than retrying it every call', async () => {
    const pool = new RpcPool([{ url: 'a' }, { url: 'b' }]);
    await pool.withFailover((u) => (u === 'a' ? fail() : ok(1)));

    const attempted: string[] = [];
    await pool.withFailover(async (u) => { attempted.push(u); return ok(2); });
    expect(attempted).not.toContain('a');
  });

  it('still tries a quarantined endpoint when nothing else is available', async () => {
    const pool = new RpcPool([{ url: 'only' }]);
    await expect(pool.withFailover(fail)).rejects.toThrow();
    // A single-endpoint chain must not go permanently offline after one blip.
    expect(await pool.withFailover(() => ok('recovered'))).toBe('recovered');
  });

  it('prefers lower-weight endpoints', async () => {
    const pool = new RpcPool([{ url: 'heavy', weight: 10 }, { url: 'light', weight: 1 }]);
    const attempted: string[] = [];
    await pool.withFailover(async (u) => { attempted.push(u); return ok(1); });
    expect(attempted).toEqual(['light']);
  });

  it('clears the failure record after an endpoint recovers', async () => {
    const pool = new RpcPool([{ url: 'a' }]);
    await expect(pool.withFailover(fail)).rejects.toThrow();
    expect(pool.recentFailures.length).toBeGreaterThan(0);
    await pool.withFailover(() => ok(1));
    expect(pool.recentFailures.length).toBe(0);
  });

  it('reports health per endpoint', async () => {
    const pool = new RpcPool([{ url: 'a' }, { url: 'b' }]);
    expect(await pool.health((u) => Promise.resolve(u === 'a'))).toEqual({ healthy: 1, total: 2 });
  });

  it('treats a throwing health probe as unhealthy rather than propagating', async () => {
    const pool = new RpcPool([{ url: 'a' }]);
    expect(await pool.health(fail)).toEqual({ healthy: 0, total: 1 });
  });
});
