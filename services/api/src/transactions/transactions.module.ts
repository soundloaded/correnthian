import { Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionIndexingService } from './transaction-indexing.service.js';
import { TransactionsService } from './transactions.service.js';

/**
 * `AuditModule` is `@Global`, so `AuditService` resolves without importing it
 * — and the transaction lifecycle is audited through the same path as
 * everything else, including the request id, rather than around it.
 */
/**
 * The only module that writes `Transaction`.
 *
 * It imports `BlockchainModule` for `BlockchainService`: the indexer observes
 * the chain, and `TransactionsService` assembles sends from it. The reverse
 * dependency would be a cycle, which is why indexing lives *here* rather than
 * beside the adapter — one table, one owning module, no circular graph.
 */
@Module({
  controllers: [TransactionsController],
  imports: [BlockchainModule, SettingsModule],
  providers: [TransactionsService, TransactionIndexingService],
  exports: [TransactionsService, TransactionIndexingService],
})
export class TransactionsModule {}