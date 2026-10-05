import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { RolesGuard } from './guards/roles.guard.js';
import { SessionGuard } from './guards/session.guard.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';

/**
 * Cross-cutting concerns, registered globally so no controller can forget
 * them. Authentication is deny-by-default: a route must be explicitly marked
 * @Public() to be reachable without a session.
 */
@Global()
@Module({
  imports: [AuthModule],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthModule],
})
export class CoreModule {}
