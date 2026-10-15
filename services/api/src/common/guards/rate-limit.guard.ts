import {
  CanActivate, ExecutionContext, Inject, Injectable, Logger, SetMetadata,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { ConfigService } from '../../config/config.service.js';
import { AppError } from '../errors.js';
import { RedisService } from '../../redis/redis.service.js';
import { bearerToken } from '../bearer.js';
import { hashSessionToken } from '../../auth/token-hash.js';

export const RATE_LIMIT_SKIP = 'correnthian:rateLimitSkip';

/** Opt a route out of rate limiting — health probes, static assets. */
export const SkipRateLimit = () => SetMetadata(RATE_LIMIT_SKIP, true);

/**
 * Sign-in traffic gets a much tighter budget than the rest of the API.
 *
 * Matched as a path *segment*, not as a prefix. `startsWith('/auth/')` was
 * correct until `/api/v1` was introduced, at which point it silently stopped
 * matching and every login quietly moved onto the general budget — the exact
 * budget brute-force credential stuffing is not meant to have. A path
 * assumption like this has to be written so that adding a version prefix
 * cannot change it.
 */
const AUTH_SEGMENT = /(^|\/)auth(\/|$)/;

type Bucket = 'auth' | 'api';

/**
 * Redis-backed fixed-window rate limiting.
 *
 * Redis rather than an in-process counter because a horizontally scaled API
 * with per-instance counters is not rate limited at all: each instance allows
 * the full budget, so N instances allow N times the limit. The counter has to
 * be shared for the number to mean anything.
 *
 * ## Two independent axes
 *
 * A request is counted against a `key` of
 * `correnthian:rate:<route bucket>:<actor>`, where the route bucket is `auth`
 * or `api` (which ceiling applies) and the actor is who is spending it:
 *
 *   - `Bearer` present  -> `session:<sha256 of the token>` — the same value
 *     stored in `Session.tokenHash`
 *   - `POST /auth/login` with an address in the body -> `email:<sha256 of the
 *     normalised address>` — credential stuffing targets an *account*, and an
 *     attacker rotating IPs would otherwise get a fresh budget per address.
 *     Hashed, because a Redis key naming who tried to sign in is a plaintext
 *     list of targeted accounts.
 *   - no token          -> `ip:<address>`
 *
 * Both halves are load-bearing. Drop the route bucket and a handful of logins
 * consume the general API budget; drop the actor and every office behind one
 * NAT address spends from a single pot.
 *
 * **Why not resolve the user and key on that?** Because the limiter runs before
 * `SessionGuard` — see below — and `resolveSession` is a database round trip.
 * A rate limiter that has to hit the database to decide whether to admit a
 * request has made itself a dependency of the thing it exists to protect, and
 * the moment that query is slow the limiter's own failure path opens.
 * `hashSessionToken` is arithmetic: the identity the database already decided
 * on, computed with no I/O at all.
 *
 * Consequence worth stating rather than hiding: the unit is the session, not
 * the account, so one account holding N sessions holds N budgets. Session
 * creation goes through authenticated flows, so this is bounded and not an
 * amplification an unauthenticated client can reach for.
 *
 * ## Why the session guard cannot simply be reordered
 *
 * It was tempting, and it does not work. `SessionGuard` returns early on
 * `@Public()` routes and never writes `req.user` there — and `POST /auth/login`
 * is public, because you cannot require a session in order to obtain one.
 * Reordering would therefore fix exactly the routes that do not need fixing
 * and leave credential stuffing, the route that most needs a per-identity
 * budget, bucketed by IP precisely because it has no session to be identified
 * by. Reading the bearer token is the only approach that works for both.
 *
 * Fails **closed** on a Redis error. An API that stops limiting when its cache
 * is unavailable has invited exactly the traffic the limit exists to shed, and
 * silently failing open is the more dangerous default of the two.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(RATE_LIMIT_SKIP, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();

    const url = req.originalUrl ?? '';
    const bucket: Bucket = AUTH_SEGMENT.test(url) ? 'auth' : 'api';
    const { windowSeconds, max } = this.budget(bucket);
    const { scheme, id } = this.actor(req);
    const key = `correnthian:rate:${bucket}:${scheme}:${id}`;

    let count: number;
    let ttl: number;
    try {
      count = await this.redis.raw.incr(key);
      if (count === 1) await this.redis.raw.expire(key, windowSeconds);
      ttl = await this.redis.raw.ttl(key);
    } catch (err) {
      this.logger.error(`Rate limiting unavailable, failing closed: ${String(err)}`);
      throw AppError.rateLimited('Request throttling is temporarily unavailable');
    }

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - count)));
    res.setHeader('RateLimit-Reset', String(Math.max(0, ttl)));

    if (count > max) {
      res.setHeader('Retry-After', String(Math.max(1, ttl)));
      throw AppError.rateLimited('Too many requests. Please slow down.');
    }
    return true;
  }

  /**
   * Window and ceiling, read from validated configuration.
   *
   * The bucket stays in the Redis key on purpose. Dropping it once seemed
   * tidy — the scheme already separates callers — and would have merged the
   * two budgets into one counter: ten logins would then have consumed the
   * general API budget, which is the exact inversion this guard exists to
   * prevent.
   */
  private budget(bucket: Bucket): { windowSeconds: number; max: number } {
    const { windowSeconds, maxRequests, authMaxRequests } = this.config.rateLimit;
    return {
      windowSeconds,
      max: bucket === 'auth' ? authMaxRequests : maxRequests,
    };
  }

  /**
   * Who this request is counted against. Both parts are deliberate and neither
   * can be a bare truthiness check: a token that is present but empty is no
   * identity at all, and would otherwise mint a shared bucket named `''`.
   *
   * The email branch reads the *unvalidated* body — the guard runs before the
   * zod pipe — so it accepts anything shaped like an address and lets the
   * pipe reject the rest. A malformed body falls back to the IP bucket rather
   * than to no bucket.
   */
  private actor(req: Request): { scheme: 'session' | 'email' | 'ip'; id: string } {
    const token = bearerToken(req.headers.authorization);
    if (token) return { scheme: 'session', id: hashSessionToken(token) };

    const path = (req.originalUrl ?? '').split('?')[0] ?? '';
    if (/\/auth\/login$/.test(path)) {
      const body = req.body as unknown;
      const email =
        body && typeof body === 'object' && 'email' in body && typeof body.email === 'string'
          ? body.email.trim().toLowerCase()
          : '';
      if (email) {
        return { scheme: 'email', id: createHash('sha256').update(email).digest('hex') };
      }
    }

    const address = req.ip;
    if (address) return { scheme: 'ip', id: address };

    return { scheme: 'ip', id: 'unknown' };
  }
}
