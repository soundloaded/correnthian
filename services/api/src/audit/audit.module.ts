import { Global, MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditContextMiddleware } from './audit-context.js';
import { AuditReasonGuard } from './audit-reason.guard.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

/**
 * Global so any module can record an audit line without importing it — and so
 * `requestId`/`deviceId` reach every one of those call sites without any of
 * them passing them.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    // A no-op on every handler that does not carry `@RequireAuditReason()`.
    { provide: APP_GUARD, useClass: AuditReasonGuard },
  ],
  exports: [AuditService],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuditContextMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}