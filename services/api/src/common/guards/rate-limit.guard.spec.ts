import { ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ConfigService } from '../../config/config.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { hashSessionToken } from '../../auth/token-hash.js';
import { RATE_LIMIT_SKIP, RateLimitGuard } from './rate-limit.guard.js';

/**
 * The two defects this file replaced.
 *
 * DEF-004: the guard hardcoded `WINDOW_SECONDS = 60` and `{ auth: 10,
 * api: 120 }` while `@correnthian/config` validated environment variables that
 * changed nothing. Every limit below is asserted *through* a configuration
 * object — a test with the old constants baked in would pass against the
 * broken code too, which is how it shipped.
 *
 * DEF-005: the guard could only bucket by IP. It is registered before
 * `SessionGuard`, so `req.user` was never set — one office behind one NAT
 * address shared a single budget while a client rotating addresses got a
 * fresh one per request. Reordering would not have fixed it: `POST /auth/login`
 * is `@Public()`, `SessionGuard` returns early there, and that is the route
 * that most needs a per-identity budget.
 */

interface RateConfig {
  windowSeconds: number;
  maxRequests: number;
  authMaxRequests: number;
}

const RATE: RateConfig = { windowSeconds: 60, maxRequests: 120, authMaxRequests: 10 };

interface RedisMock {
  incr: Mock;
  expire: Mock;
  ttl: Mock;
}

function makeGuard(rate: RateConfig = { ...RATE }, redis: Partial<RedisMock> = {}) {
  const raw: RedisMock = {
    incr: vi.fn<() => Promise<number>>().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
    ttl: vi.fn<() => Promise<number>>().mockResolvedValue(59),
    ...redis,
  };
  const redisSvc = { raw } as unknown as RedisService;
  // Held as its own binding rather than reached through the cast, so the test
  // never references the method unbound.
  const getAllOverride = vi.fn().mockReturnValue(false);
  const reflector = { getAllAndOverride: getAllOverride } as unknown as Reflector;
  const config = { rateLimit: rate } as ConfigService;

  return {
    guard: new RateLimitGuard(redisSvc, reflector, config),
    raw,
    getAllOverride,
  };
}

function ctx(url: string, opts: { authorization?: string; ip?: string | null } = {}) {
  const request: Record<string, unknown> = { originalUrl: url };
  if (opts.authorization !== undefined) request['headers'] = { authorization: opts.authorization };
  else request['headers'] = {};
  if (opts.ip !== null) request['ip'] = opts.ip ?? '127.0.0.1';

  const setHeader = vi.fn();
  const exec = {
    getHandler: () => () => undefined,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ setHeader }) }),
  } as unknown as ExecutionContext;

  return { exec, setHeader };
}

/** Runs the guard and returns the Redis key it counted against. */
async function keyOf(
  guard: RateLimitGuard,
  raw: RedisMock,
  exec: ExecutionContext,
): Promise<string> {
  await guard.canActivate(exec);
  const call = raw.incr.mock.calls.at(-1);
  return String(call?.[0]);
}

beforeEach(() => Logger.overrideLogger(false));

describe('DEF-004 — limits come from configuration', () => {
  it('spends the configured auth ceiling, not a constant', async () => {
    const { guard, raw } = makeGuard({ ...RATE, authMaxRequests: 3 });
    const { exec, setHeader } = ctx('/api/v1/auth/login');

    for (let i = 1; i <= 3; i++) {
      raw.incr.mockResolvedValue(i);
      await expect(guard.canActivate(exec)).resolves.toBe(true);
    }
    expect(setHeader).toHaveBeenCalledWith('RateLimit-Limit', '3');

    raw.incr.mockResolvedValue(4);
    await expect(guard.canActivate(exec)).rejects.toMatchObject({ status: 429 });
  });

  it('spends the configured api ceiling', async () => {
    const { guard, raw } = makeGuard({ ...RATE, maxRequests: 7 });
    const { exec, setHeader } = ctx('/api/v1/assets');

    raw.incr.mockResolvedValue(7);
    await expect(guard.canActivate(exec)).resolves.toBe(true);
    expect(setHeader).toHaveBeenCalledWith('RateLimit-Limit', '7');

    raw.incr.mockResolvedValue(8);
    await expect(guard.canActivate(exec)).rejects.toMatchObject({ status: 429 });
  });

  it('applies the configured window to the counter', async () => {
    const { guard, raw } = makeGuard({ ...RATE, windowSeconds: 5 });
    await guard.canActivate(ctx('/api/v1/assets').exec);
    expect(raw.expire).toHaveBeenCalledWith(expect.any(String), 5);
  });

  it('keeps the two budgets independent', async () => {
    // Ten logins must not consume the general API budget — that inversion is
    // the reason `authMaxRequests` is its own setting.
    const { guard, raw } = makeGuard({ ...RATE, authMaxRequests: 2, maxRequests: 120 });

    const auth = ctx('/api/v1/auth/login');
    raw.incr.mockResolvedValue(3);
    await expect(guard.canActivate(auth.exec)).rejects.toMatchObject({ status: 429 });

    const api = ctx('/api/v1/assets');
    raw.incr.mockResolvedValue(3);
    await expect(guard.canActivate(api.exec)).resolves.toBe(true);
  });

  it('still reads /auth as a path segment under a version prefix', async () => {
    // `startsWith('/auth/')` stopped matching the moment `/api/v1` was added,
    // moving every login onto the general budget. Segment matching survives it.
    const { guard } = makeGuard({ ...RATE, authMaxRequests: 1 });
    const { exec, setHeader } = ctx('/api/v1/auth/login');

    await expect(guard.canActivate(exec)).resolves.toBe(true);
    expect(setHeader).toHaveBeenCalledWith('RateLimit-Limit', '1');
  });
});

describe('DEF-005 — the budget is per session, not per address', () => {
  it('gives one identity two budgets when it changes address', async () => {
    const { guard, raw } = makeGuard();
    const authorization = 'Bearer a-known-session-token';

    const atHome = ctx('/api/v1/users', { authorization, ip: '203.0.113.9' });
    const atOffice = ctx('/api/v1/users', { authorization, ip: '198.51.100.4' });

    const a = await keyOf(guard, raw, atHome.exec);
    const b = await keyOf(guard, raw, atOffice.exec);

    expect(a).toBe(b);
    expect(a).toBe(`correnthian:rate:api:session:${hashSessionToken('a-known-session-token')}`);
  });

  it('gives two identities separate budgets behind one address', async () => {
    const { guard, raw } = makeGuard();
    const ip = '198.51.100.4';

    const alice = await keyOf(
      guard, raw, ctx('/api/v1/users', { authorization: 'Bearer alice-token', ip }).exec,
    );
    const bob = await keyOf(
      guard, raw, ctx('/api/v1/users', { authorization: 'Bearer bob-token', ip }).exec,
    );

    expect(alice).not.toBe(bob);
    expect(alice).toContain(':session:');
    expect(bob).toContain(':session:');
  });

  it('keys on the value stored in Session.tokenHash', async () => {
    const { guard, raw } = makeGuard();
    const key = await keyOf(
      guard, raw, ctx('/api/v1/users', { authorization: 'Bearer raw-token' }).exec,
    );
    // `AuthService.resolveSession` looks sessions up by sha256(raw). If the two
    // hashes ever diverge the limiter would count sessions the database cannot
    // find, and the two would drift silently.
    expect(key).toBe(`correnthian:rate:api:session:${hashSessionToken('raw-token')}`);
  });

  it('falls back to the address when there is no token', async () => {
    const { guard, raw } = makeGuard();
    const key = await keyOf(guard, raw, ctx('/api/v1/assets', { ip: '203.0.113.9' }).exec);
    expect(key).toBe('correnthian:rate:api:ip:203.0.113.9');
  });

  it('does not mint a shared bucket for an empty bearer', async () => {
    // Truthiness on the raw header would produce the key `...::`, which every
    // client sending `Authorization: Bearer ` would then share.
    const { guard, raw } = makeGuard();
    const empty = await keyOf(guard, raw, ctx('/api/v1/assets', { authorization: 'Bearer ' }).exec);
    const absent = await keyOf(guard, raw, ctx('/api/v1/assets').exec);

    expect(empty).toBe(absent);
    expect(empty).toContain(':ip:');
  });

  it('degrades to a named unknown when there is no address', async () => {
    const { guard, raw } = makeGuard();
    const key = await keyOf(guard, raw, ctx('/api/v1/assets', { ip: null }).exec);
    expect(key).toBe('correnthian:rate:api:ip:unknown');
  });
});

describe('fail-closed', () => {
  it('denies when the counter cannot be read', async () => {
    const { guard } = makeGuard(RATE, {
      incr: vi.fn<() => Promise<number>>().mockRejectedValue(new Error('redis is down')),
    });

    await expect(guard.canActivate(ctx('/api/v1/assets').exec)).rejects.toMatchObject({
      status: 429,
    });
  });

  it('does not touch the counter for an opted-out route', async () => {
    const { guard, raw, getAllOverride } = makeGuard();
    getAllOverride.mockReturnValue(true);

    await expect(guard.canActivate(ctx('/health/ready').exec)).resolves.toBe(true);
    expect(raw.incr).not.toHaveBeenCalled();
  });
});

describe('headers', () => {
  it('reports the ceiling, the remainder and the reset', async () => {
    const { guard, raw } = makeGuard({ ...RATE, maxRequests: 10 });
    raw.incr.mockResolvedValue(4);
    raw.ttl.mockResolvedValue(42);

    const { exec, setHeader } = ctx('/api/v1/assets');
    await expect(guard.canActivate(exec)).resolves.toBe(true);

    expect(setHeader).toHaveBeenCalledWith('RateLimit-Limit', '10');
    expect(setHeader).toHaveBeenCalledWith('RateLimit-Remaining', '6');
    expect(setHeader).toHaveBeenCalledWith('RateLimit-Reset', '42');
  });

  it('advertises Retry-After when it refuses', async () => {
    const { guard, raw } = makeGuard({ ...RATE, maxRequests: 1 });
    raw.incr.mockResolvedValue(2);
    raw.ttl.mockResolvedValue(30);

    const { exec, setHeader } = ctx('/api/v1/assets');
    await expect(guard.canActivate(exec)).rejects.toMatchObject({ status: 429 });
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '30');
  });
});

describe('opt-out marker', () => {
  it('is read under the documented key', () => {
    expect(RATE_LIMIT_SKIP).toBe('correnthian:rateLimitSkip');
  });
});
