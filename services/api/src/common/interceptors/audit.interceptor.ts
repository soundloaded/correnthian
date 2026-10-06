import {
  CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/audit.service.js';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Sign-in traffic is not audited here.
 *
 * Matched as a path segment rather than a prefix for the same reason the rate
 * limiter does it: `startsWith('/auth/')` silently stopped matching the day
 * `/api/v1` was introduced, and the first thing that would have surfaced the
 * regression is a bug report saying sign-ins are not in the audit trail.
 */
const AUTH_SEGMENT = /(^|\/)auth(\/|$)/;

/**
 * Records an audit line for every state-changing request.
 *
 * A hand-written `audit.record()` inside each service method is the obvious
 * alternative, and it is worse: it gets forgotten the first time someone adds
 * an endpoint, and a silently unaudited admin mutation is exactly the failure
 * an audit trail exists to catch. The admin console states that changes are
 * audited, so it needs to be true by construction rather than by discipline.
 *
 * Guards run before interceptors, so `request.user` is already resolved.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  // `@Inject` explicitly: Nest's CLI compiles with tsc, which emits decorator
  // metadata, but vitest uses esbuild, which does not. Without it `this.audit`
  // is undefined at runtime and every mutating request 500s — a failure that
  // only appears once a test makes a POST, which is why it survived until one
  // did.
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: { id: string; role: string } }>();
    if (!MUTATING.has(req.method)) return next.handle();

    // AuthService records sign-in attempts itself, where it knows whether the
    // attempt succeeded. Recording them here would log a failure for every
    // successful sign-in, which trains operators to ignore the audit trail.
    if (AUTH_SEGMENT.test(req.originalUrl ?? '')) return next.handle();

    const controller = context.getClass().name;
    const action = `${req.method} ${controller}.${context.getHandler().name}`;

    const write = (outcome: 'success' | 'failure') =>
      void this.audit.record({
        actorId: req.user?.id ?? null,
        actorRole: req.user?.role ?? null,
        action,
        targetType: controller,
        outcome,
        ipAddress: req.ip,
        metadata: { method: req.method, path: req.originalUrl },
      });

    return next.handle().pipe(tap({ next: () => write('success'), error: () => write('failure') }));
  }
}
