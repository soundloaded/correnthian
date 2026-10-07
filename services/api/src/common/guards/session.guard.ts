import { CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { bearerToken } from '../bearer.js';
import { AppError } from '../errors.js';

/**
 * Deny by default: a route is authenticated unless marked @Public().
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = bearerToken(req.headers.authorization);
    if (!token) throw AppError.unauthorized('Missing session token');

    req.user = await this.auth.resolveSession(token);
    return true;
  }
}
