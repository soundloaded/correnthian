import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AppError } from '../errors.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) throw AppError.unauthorized();
    return data ? user[data] : user;
  },
);
