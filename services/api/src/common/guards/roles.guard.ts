import {
  CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../errors.js';
import { roleSatisfies } from '../roles.js';

export const ROLES_KEY = 'correnthian:roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: { role: string } }>();

    // Both failure directions are closed in `../roles.ts`: an unknown held
    // role ranks below `user`, and an unknown requirement is unsatisfiable.
    // A misspelled `@Roles()` therefore denies everyone rather than admitting
    // them, which is the only safe direction for a permissions check to fail.
    if (!required.some((r) => roleSatisfies(req.user?.role, r))) {
      throw AppError.forbidden('Insufficient role');
    }
    return true;
  }
}
