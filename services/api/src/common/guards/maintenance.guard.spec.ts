import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { AppError } from '../errors.js';
import { MaintenanceGuard, isAllowedDuringMaintenance } from './maintenance.guard.js';

/**
 * Maintenance mode, enforced — BE-1507.
 *
 * The guard is tested here rather than over HTTP on purpose. Turning the
 * setting on is global: a single HTTP test that flipped it would make every
 * suite running alongside it see 503s where it expects 401s, and the failure
 * would read as broken authentication rather than as a test that leaked. The
 * wiring is verified against a running API instead.
 */
const context = (url: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ url }) }),
  }) as unknown as ExecutionContext;

const settings = (overrides: Record<string, unknown> = {}) => ({
  get: vi.fn(async (key: string) => {
    if (key in overrides) return overrides[key];
    if (key === 'platform.maintenance-mode') return false;
    if (key === 'platform.maintenance-message') return '';
    throw new Error(`unexpected key ${key}`);
  }),
});

const guard = (overrides: Record<string, unknown> = {}) =>
  new MaintenanceGuard({ get: settings(overrides).get } as never);

const ON = { 'platform.maintenance-mode': true };

describe('the maintenance guard', () => {
  it('lets everything through while maintenance is off', async () => {
    const g = guard();
    await expect(g.canActivate(context('/api/v1/users'))).resolves.toBe(true);
    await expect(g.canActivate(context('/api/v1/settings/system'))).resolves.toBe(true);
  });

  it('refuses the rest of the API with a 503 while maintenance is on', async () => {
    const g = guard(ON);
    const err = await g.canActivate(context('/api/v1/users')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(503);
    expect((err as AppError).code).toBe('maintenance');
  });

  it('carries the operator\'s message, and omits it when there is none', async () => {
    const withMessage = guard({ ...ON, 'platform.maintenance-message': 'Back at 14:00.' });
    const err = await withMessage.canActivate(context('/api/v1/users')).catch((e: unknown) => e);
    expect((err as AppError).detail).toEqual({ message: 'Back at 14:00.' });

    const without = guard({ ...ON, 'platform.maintenance-message': '' });
    const bare = await without.canActivate(context('/api/v1/users')).catch((e: unknown) => e);
    expect((bare as AppError).detail).toBeUndefined();
  });

  it('keeps the way out open, and the paths a client needs to know why', () => {
    // The settings routes are how an operator turns maintenance off; the
    // auth routes are how they sign in to reach them; the config route
    // carries the message; meta is version discovery; webhooks are inbound
    // vendor events that must not be lost.
    for (const path of [
      '/api/v1/settings/system',
      '/api/v1/settings/flags',
      '/api/v1/auth/login',
      '/api/v1/auth/logout',
      '/api/v1/config',
      '/api/v1/meta/versions',
      '/api/v1/compliance/webhooks/persona',
    ]) {
      expect(isAllowedDuringMaintenance(path), `${path} must stay open`).toBe(true);
    }
  });

  it('closes everything else, including a path that merely starts the same', () => {
    for (const path of [
      '/api/v1/users',
      '/api/v1/assets',
      '/api/v1/swaps/quotes',
      '/api/v1/settingsomething',
      '/api/v1/compliance/reviews',
      '/api/v2/users',
    ]) {
      expect(isAllowedDuringMaintenance(path), `${path} must be closed`).toBe(false);
    }
  });

  it('does not close the health probe or the API documentation', async () => {
    // The process is healthy and it is the one serving the 503, so a probe
    // pointed at it must keep answering.
    const g = guard(ON);
    await expect(g.canActivate(context('/health/live'))).resolves.toBe(true);
    await expect(g.canActivate(context('/health/ready'))).resolves.toBe(true);
    await expect(g.canActivate(context('/docs'))).resolves.toBe(true);
  });

  it('refuses the transitional unversioned alias too', async () => {
    // The version middleware rewrites `req.url` to the versioned path, so
    // the guard matches the rewritten URL. Matching `originalUrl` instead
    // would let this spelling through.
    const g = guard(ON);
    const err = await g.canActivate(context('/api/users')).catch((e: unknown) => e);
    expect((err as AppError).status).toBe(503);
  });

  it('fails open when the setting cannot be read', async () => {
    // A configuration read that fails must not close the platform: the
    // limiter already refuses everything when Redis is down, and a second
    // refusal nobody can clear is worse than an open platform.
    const failing = {
      get: vi.fn(async () => {
        throw new Error('the database is unreachable');
      }),
    };
    const g = new MaintenanceGuard(failing as never);
    await expect(g.canActivate(context('/api/v1/users'))).resolves.toBe(true);
  });
});
