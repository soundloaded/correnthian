import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { BlockchainController } from './blockchain.controller.js';
import { BlockchainService } from './blockchain.service.js';
import { IndexingService } from './indexing.service.js';
import { TransactionIndexingService } from './transaction-indexing.service.js';

/**
 * `TransactionsModule` is imported for `TransactionsService`, which owns every
 * write to the `Transaction` table — including the one the indexer makes.
 * Letting a second module create rows directly would put the lifecycle rules
 * and the idempotency key in two places, and the unique index on
 * `(chainId, txHash)` only helps if exactly one caller knows to use it.
 */
@Module({
  controllers: [BlockchainController],
  imports: [TransactionsModule],
  providers: [BlockchainService, IndexingService, TransactionIndexingService],
  exports: [BlockchainService, IndexingService, TransactionIndexingService],
})
export class BlockchainModule {}
