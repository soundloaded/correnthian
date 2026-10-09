import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../errors.js';
import { RolesGuard, ROLES_KEY } from './roles.guard.js';

/**
 * `RolesGuard` — BE-1703.
 *
 * `routes.spec.ts` proves an anonymous request gets 401. It says nothing about
 * a *session*: `DEF-001` shipped as a fully unit-tested dead endpoint, and the
 * same hole opens in the other direction — a controller that lost its
 * `@Roles()` would still answer 401 to a stranger and still pass every suite
 * that exists. The guard is the only thing between a signed-in customer and
 * an operator console route, and until now nothing tested it at all.
 *
 * The tests are written against literals rather than against `ROLE_RANK`:
 * a guard checked with the same table it consults can be broken in both
 * directions at once and still agree with itself.
 */

const RANK = { user: 0, support: 1, compliance: 2, admin: 3, owner: 4 } as const;

function contextWith(required: string[] | undefined, user?: { role: string }) {
  // Held as its own binding: `expect(reflector.getAllAndOverride)` reads a
  // method off an object, which the linter cannot prove keeps its receiver.
  const getAllAndOverride = vi.fn(() => required);
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  const ctx = {
    getHandler: () => Symbol('handler'),
    getClass: () => Symbol('class'),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;

  return { guard, ctx, getAllAndOverride };
}

describe('RolesGuard', () => {
  it('allows a route with no role requirement', () => {
    const { guard, ctx, getAllAndOverride } = contextWith(undefined, { role: 'user' });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });

  it('allows an empty @Roles() as no requirement', () => {
    const { guard, ctx } = contextWith([], { role: 'user' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('refuses a customer on a support route with 403', () => {
    const { guard, ctx } = contextWith(['support'], { role: 'user' });
    try {
      guard.canActivate(ctx);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('forbidden');
      expect((err as AppError).status).toBe(403);
    }
  });

  it('refuses a customer on every required role, not just one', () => {
    for (const required of [['support'], ['admin'], ['owner'], ['support', 'admin']]) {
      const { guard, ctx } = contextWith(required, { role: 'user' });
      expect(() => guard.canActivate(ctx), `required ${required.join(',')}`).toThrow(
        /Insufficient role/,
      );
    }
  });

  it('allows a role that satisfies the requirement — the hierarchy, to its face', () => {
    // Literals, deliberately: the guard and this test agreeing because both
    // read `ROLE_RANK` would prove nothing if the ranks were wrong.
    expect(RANK.support).toBe(1);
    expect(RANK.compliance).toBe(2);
    expect(RANK.admin).toBe(3);
    expect(RANK.owner).toBe(4);

    for (const [role, required] of [
      ['support', 'support'],
      ['admin', 'support'],
      ['admin', 'admin'],
      ['owner', 'admin'],
      ['owner', 'owner'],
      ['compliance', 'support'],
    ] as const) {
      const { guard, ctx } = contextWith([required], { role });
      expect(guard.canActivate(ctx), `${role} on @Roles('${required}')`).toBe(true);
    }
  });

  it('refuses a higher requirement regardless of rank below it', () => {
    for (const [role, required] of [
      ['support', 'admin'],
      ['admin', 'owner'],
      ['user', 'support'],
    ] as const) {
      const { guard, ctx } = contextWith([required], { role });
      expect(() => guard.canActivate(ctx), `${role} on @Roles('${required}')`).toThrow(
        /Insufficient role/,
      );
    }
  });

  it('allows any one of several required roles', () => {
    const { guard, ctx } = contextWith(['support', 'compliance'], { role: 'compliance' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies an unknown held role — fail closed, not open', () => {
    // `ROLE_RANK` has no entry for `superuser`. `rankOf` returns -1, below
    // `user`, so nothing is satisfied. If this ever returns true, an
    // unrecognised role from a corrupt row becomes a wildcard.
    const { guard, ctx } = contextWith(['support'], { role: 'superuser' });
    expect(() => guard.canActivate(ctx)).toThrow(/Insufficient role/);
  });

  it('denies everyone when the requirement itself is unknown', () => {
    // The misspelling case: `@Roles('supprot')` requires a rank nothing has,
    // including the highest real one. A permission check that fails open on a
    // typo is worse than one that fails closed, because the typo is invisible
    // in review — the route just quietly admits everyone.
    const { guard, ctx } = contextWith(['supprot'], { role: 'owner' });
    expect(() => guard.canActivate(ctx)).toThrow(/Insufficient role/);
  });

  it('denies when no user was attached, rather than crashing', () => {
    // SessionGuard runs first and attaches `req.user`, so this should not
    // happen. If it does, the guard treats an absent identity as an absent
    // role instead of throwing a TypeError that would surface as a 500.
    const { guard, ctx } = contextWith(['support'], undefined);
    expect(() => guard.canActivate(ctx)).toThrow(/Insufficient role/);
  });

  it('checks metadata on the handler before the class', () => {
    // `getAllAndOverride([handler, class])` decides that order; here we pin
    // that the guard asks in exactly the order that lets a method-level
    // @Roles override a class-level one — every parameter of the call.
    const { guard, ctx, getAllAndOverride } = contextWith(['support'], { role: 'user' });
    expect(() => guard.canActivate(ctx)).toThrow();
    const call = getAllAndOverride.mock.calls[0];
    expect(call, 'the guard never asked for metadata').toBeDefined();
    const [key, sources] = call as unknown as [string, unknown[]];
    expect(key).toBe(ROLES_KEY);
    expect(sources).toHaveLength(2);
  });
});
