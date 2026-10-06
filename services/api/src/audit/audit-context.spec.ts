import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  AuditContextMiddleware, currentAuditContext, DEVICE_ID_HEADER, REQUEST_ID_HEADER,
  runWithAuditContext,
} from './audit-context.js';
import { AuditReasonGuard, RequireAuditReason } from './audit-reason.guard.js';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

function run(headers: Record<string, string>, body?: unknown) {
  const middleware = new AuditContextMiddleware();
  const req = { headers, body, ip: '198.51.100.4' } as unknown as Request;
  const setHeader = vi.fn();
  const res = { setHeader } as unknown as Response;

  let seen: ReturnType<typeof currentAuditContext>;
  let downstreamRan = false;
  middleware.use(req, res, () => {
    downstreamRan = true;
    // Read asynchronously too: a handler awaits, and the context has to
    // survive the await or `record()` would see nothing.
    seen = currentAuditContext();
  });

  return { seen: seen!, setHeader, downstreamRan, req };
}

describe('AuditContextMiddleware', () => {
  it('accepts a caller-supplied request id and echoes it back', () => {
    const { seen, setHeader } = run({ [REQUEST_ID_HEADER]: 'trace-abc-123' });
    expect(seen.requestId).toBe('trace-abc-123');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'trace-abc-123');
  });

  it('generates one when the caller does not supply a usable id', () => {
    const { seen, setHeader } = run({});
    expect(seen.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', seen.requestId);
  });

  it('replaces a header that could inject a newline into the trail', () => {
    const { seen } = run({ [REQUEST_ID_HEADER]: 'abc\nlevel=30 fake log line' });
    expect(seen.requestId).not.toContain('\n');
  });

  it('replaces an over-long header rather than storing it', () => {
    const { seen } = run({ [REQUEST_ID_HEADER]: 'a'.repeat(5000) });
    expect(seen.requestId.length).toBeLessThanOrEqual(128);
  });

  it('reads the device from its header', () => {
    expect(run({ [DEVICE_ID_HEADER]: 'device-9' }).seen.deviceId).toBe('device-9');
  });

  it('carries the caller IP', () => {
    expect(run({}).seen.ipAddress).toBe('198.51.100.4');
  });

  it('runs the rest of the chain inside the context', () => {
    expect(run({}).downstreamRan).toBe(true);
  });

  it('has no context outside a request', () => {
    expect(currentAuditContext()).toBeUndefined();
  });
});

describe('AuditReasonGuard', () => {
  const guard = new AuditReasonGuard(new Reflector());

  const contextFor = (req: Record<string, unknown>, handler: object): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  /**
   * Applied the way Nest applies it. `SetMetadata` writes to `descriptor.value`
   * — the method function — which is why `ExecutionContext.getHandler()` can
   * find it. Calling the decorator with `(target, key)` alone would put the
   * metadata somewhere the guard never looks, and the test would pass while
   * the real route stayed unguarded.
   */
  const handlerWith = (operation: string) => {
    const descriptor = {
      value: () => undefined,
      writable: true, enumerable: false, configurable: true,
    };
    RequireAuditReason(operation)({}, 'handle', descriptor);
    return descriptor.value;
  };

  const plain = () => undefined;

  it('is a no-op on a handler that did not ask for a reason', () => {
    expect(guard.canActivate(contextFor({ body: {} }, plain))).toBe(true);
  });

  it('refuses a destructive handler with no reason', () => {
    expect(() => guard.canActivate(contextFor({ body: {} }, handlerWith('disable an asset'))))
      .toThrow(/disable an asset needs a reason of at least 8 characters/);
  });

  it('refuses a reason that is present but empty', () => {
    expect(() => guard.canActivate(contextFor({ body: { reason: '   ' } }, handlerWith('suspend an account'))))
      .toThrow(/needs a reason/);
  });

  it('accepts a real one and puts it on the request context for the service to pick up', () => {
    const req = { body: { reason: 'Provider outage — settlements failing.' } } as Record<string, unknown>;
    expect(guard.canActivate(contextFor(req, handlerWith('disable a provider')))).toBe(true);
    expect(req).toHaveProperty('auditReason', 'Provider outage — settlements failing.');
  });

  it('accepts a reason from the query string too, for a DELETE with no body', () => {
    const req = { query: { reason: 'Issuer withdrew the attestation.' }, body: undefined };
    expect(guard.canActivate(contextFor(req, handlerWith('disable an asset')))).toBe(true);
  });

  it('hands the reason to the request context, so the service does not have to pass it', () => {
    const outer = { requestId: 'req-7' };
    const seen: Array<string | null | undefined> = [];
    runWithAuditContext(outer, () => {
      guard.canActivate(contextFor({ body: { reason: 'Provider outage — settlements failing.' } }, handlerWith('disable a provider')));
      seen.push(currentAuditContext()?.reason);
    });
    expect(seen).toEqual(['Provider outage — settlements failing.']);
  });
});