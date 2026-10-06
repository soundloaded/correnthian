import {
  CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../common/errors.js';
import { setContextReason } from './audit-context.js';
import { isUsableReason, MIN_REASON_LENGTH } from './destructive-actions.js';

export const AUDIT_REASON_KEY = 'correnthian:audit-reason';

/**
 * Mark a handler as destroying something a user depends on.
 *
 * The argument is the operation in the operator's own words, because it is
 * what they will read in the rejection: "disable an asset", "suspend an
 * account". A generic message makes the requirement feel arbitrary and gets
 * worked around.
 *
 * Applying this is what makes the reason mandatory at the edge, before a
 * service method has done anything — rather than relying on every service to
 * remember to call `audit.assertReason`. §55's four operations are the ones
 * that must carry it.
 */
export const RequireAuditReason = (operation: string) => SetMetadata(AUDIT_REASON_KEY, operation);

/**
 * Enforces `@RequireAuditReason()`.
 *
 * Registered globally from `AuditModule` and a no-op on every handler that
 * does not carry the decorator, so adopting it is a one-line change at the
 * controller and cannot affect routes that did not ask for it.
 *
 * The accepted reason is put on the request context, which is how it reaches
 * the audit line: a service calling `audit.recordChange()` picks it up rather
 * than having it threaded by hand.
 */
@Injectable()
export class AuditReasonGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const operation = this.reflector.getAllAndOverride<string>(AUDIT_REASON_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!operation) return true;

    const req = ctx.switchToHttp().getRequest<Request & { auditReason?: string | null }>();
    const reason = this.readReason(req);

    if (!isUsableReason(reason)) {
      throw AppError.badRequest(
        `${operation} needs a reason of at least ${MIN_REASON_LENGTH} characters. ` +
          `It is recorded against your name, and it is what the next person to read ` +
          `this entry will actually need.`,
      );
    }

    setContextReason(reason.trim());
    req.auditReason = reason.trim();
    return true;
  }

  private readReason(req: Request): string | null {
    const body = req.body as { reason?: unknown } | undefined;
    const query = req.query as { reason?: unknown } | undefined;
    const candidate = body?.reason ?? query?.reason;
    return typeof candidate === 'string' ? candidate : null;
  }
}