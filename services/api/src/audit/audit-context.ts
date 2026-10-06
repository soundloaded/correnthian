import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Per-request facts that every audit line needs and no service should have to
 * remember to pass.
 *
 * `requestId`, `deviceId` and `ipAddress` are properties of the *request*, not
 * of the operation. Threading them as parameters would mean every call site in
 * the codebase can forget one, and a forgotten `requestId` is invisible: the
 * entry looks fine and simply cannot be correlated with anything. So they live
 * in an `AsyncLocalStorage` for the duration of the request and `record()`
 * reads them itself.
 *
 * An entry may still override any of them explicitly — background jobs and
 * scheduled work have no request, and pass what they know.
 */

export interface AuditRequestContext {
  requestId: string;
  ipAddress?: string;
  deviceId?: string | null;
  /**
   * Set by `AuditReasonGuard` from a `@RequireAuditReason()` handler. Destructive
   * operations can therefore carry their reason from the HTTP body to the audit
   * line without a service threading it through by hand.
   */
  reason?: string | null;
}

const storage = new AsyncLocalStorage<AuditRequestContext>();

/** The context for the request being served, or undefined outside one. */
export function currentAuditContext(): AuditRequestContext | undefined {
  return storage.getStore();
}

/** Test and batch seam. Runs `fn` as if it were serving a request. */
export function runWithAuditContext<T>(ctx: AuditRequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export const REQUEST_ID_HEADER = 'x-request-id';
export const DEVICE_ID_HEADER = 'x-device-id';

/**
 * Bounded and charset-checked before it is stored or echoed.
 *
 * `x-request-id` is attacker-controlled. Unbounded it is a log-injection and
 * a storage-growth vector; unfiltered it lets a caller write newlines into the
 * audit trail and the log lines that operators read beside it. Anything that
 * does not look like an id is discarded and replaced rather than sanitised —
 * a mangled id would silently fail to correlate, which is worse than a new one.
 */
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function acceptId(candidate: unknown): string | null {
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  return ID_PATTERN.test(trimmed) ? trimmed : null;
}

/** Express request shape. Kept local so `common/` does not have to change. */
type AuditableRequest = Request & {
  requestId?: string;
  deviceId?: string | null;
  auditReason?: string | null;
};

@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(req: AuditableRequest, res: Response, next: NextFunction): void {
    const requestId = acceptId(req.headers[REQUEST_ID_HEADER]) ?? randomUUID();
    // Present in the body for the routes that name it explicitly; harmless
    // when the body has not been parsed yet.
    const fromBody = (req.body as { deviceId?: unknown } | undefined)?.deviceId;
    const deviceId = acceptId(req.headers[DEVICE_ID_HEADER]) ?? acceptId(fromBody);

    req.requestId = requestId;
    req.deviceId = deviceId ?? null;
    res.setHeader('X-Request-Id', requestId);

    // `next()` runs the rest of the chain inside `run`, so every handler and
    // every await beneath it can read the context.
    storage.run({ requestId, ipAddress: req.ip, deviceId: deviceId ?? null }, () => next());
  }
}

/** Attach a reason discovered later in the request to the ambient context. */
export function setContextReason(reason: string | null): void {
  const ctx = storage.getStore();
  if (ctx) ctx.reason = reason;
}