import {
  CanActivate, ExecutionContext, Inject, Injectable, Logger, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AppError } from '../errors.js';
import { RedisService } from '../../redis/redis.service.js';

export const RATE_LIMIT_SKIP = 'correnthian:rateLimitSkip';

/** Opt a route out of rate limiting — health probes, static assets. */
export const SkipRateLimit = () => SetMetadata(RATE_LIMIT_SKIP, true);

const WINDOW_SECONDS = 60;
const LIMITS = { auth: 10, api: 120 } as const;

type Bucket = keyof typeof LIMITS;

/**
 * Redis-backed fixed-window rate limiting.
 *
 * Redis rather than an in-process counter because a horizontally scaled API
 * with per-instance counters is not rate limited at all: each instance allows
 * the full budget, so N instances allow N times the limit. The counter has to
 * be shared for the number to mean anything.
 *
 * The authenticated identity is the bucket where we have one. Per-IP alone
 * means a whole office behind one NAT address shares a budget, while a single
 * client rotating IPs gets a fresh one.
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
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(RATE_LIMIT_SKIP, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const res = ctx.switchToHttp().getResponse<Response>();

    const bucket: Bucket = req.originalUrl?.startsWith('/auth/') ? 'auth' : 'api';
    const max = LIMITS[bucket];
    const actor = req.user?.id ?? req.ip ?? 'unknown';
    const key = `correnthian:rate:${bucket}:${actor}`;

    let count: number;
    let ttl: number;
    try {
      count = await this.redis.raw.incr(key);
      if (count === 1) await this.redis.raw.expire(key, WINDOW_SECONDS);
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
}
