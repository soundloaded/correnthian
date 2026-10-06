import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

/**
 * `AuditModule` is `@Global`, so `AuditService` resolves without importing it
 * — and the transaction lifecycle is audited through the same path as
 * everything else, including the request id, rather than around it.
 */
@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}