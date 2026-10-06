import { Module } from '@nestjs/common';
import { FeesController } from './fees.controller.js';
import { FeesService } from './fees.service.js';

/**
 * §37's fee engine.
 *
 * `PrismaService` and `AuditService` are both `@Global()`, so this module has
 * no imports of its own. It exports `FeesService` because `SwapsModule` prices
 * every quote through it — a quote that carried its own fee arithmetic would
 * be a second engine, and two engines disagree about a rate the first time
 * either of them changes.
 */
@Module({
  controllers: [FeesController],
  providers: [FeesService],
  exports: [FeesService],
})
export class FeesModule {}
