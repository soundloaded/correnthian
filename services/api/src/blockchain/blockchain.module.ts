import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller.js';
import { BlockchainService } from './blockchain.service.js';
import { IndexingService } from './indexing.service.js';

/**
 * Adapter resolution and balance sync, and nothing that writes `Transaction`.
 *
 * The transaction-indexing service moved to `transactions` (see that module)
 * so that every writer of the `Transaction` table lives in one module — and,
 * more immediately, so `TransactionsService` can depend on `BlockchainService`
 * for assembling sends without the two modules importing each other. Nest
 * resolves a circular module graph into `undefined` dependencies, which is the
 * failure `check-explicit-di.mjs` exists to catch in the other direction.
 */
@Module({
  controllers: [BlockchainController],
  providers: [BlockchainService, IndexingService],
  exports: [BlockchainService, IndexingService],
})
export class BlockchainModule {}
