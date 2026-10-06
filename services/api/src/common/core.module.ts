import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor.js';
import { IdempotencyModule } from './idempotency/idempotency.module.js';
import { RolesGuard } from './guards/roles.guard.js';
import { AuditInterceptor } from './interceptors/audit.interceptor.js';
import { RateLimitGuard } from './guards/rate-limit.guard.js';
import { SessionGuard } from './guards/session.guard.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';

/**
 * Cross-cutting concerns, registered globally so no controller can forget
 * them. Authentication is deny-by-default: a route must be explicitly marked
 * @Public() to be reachable without a session.
 *
 * Interceptor order is deliberate. `IdempotencyInterceptor` is registered
 * first, so it wraps `AuditInterceptor`: a replay short-circuits before the
 * audit trail sees it, which is right — a replay mutated nothing, and writing
 * a success line for every duplicate press would teach operators to ignore the
 * trail. Real executions, successes and failures alike, still pass through.
 */
@Global()
@Module({
  imports: [AuthModule, AuditModule, IdempotencyModule],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuthModule, IdempotencyModule],
})
export class CoreModule {}