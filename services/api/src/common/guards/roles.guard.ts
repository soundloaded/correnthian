import { CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../errors.js';

export const ROLES_KEY = 'correnthian:roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Role hierarchy. A role satisfies a requirement if it is equal or higher. */
const RANK: Record<string, number> = {
  user: 0,
  support: 1,
  compliance: 2,
  admin: 3,
  owner: 4,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: { role: string } }>();
    const actual = req.user?.role;
    const held = actual ? (RANK[actual] ?? -1) : -1;

    if (!required.some((r) => held >= (RANK[r] ?? Infinity))) {
      throw AppError.forbidden('Insufficient role');
    }
    return true;
  }
}
