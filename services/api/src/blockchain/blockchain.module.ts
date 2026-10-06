import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller.js';
import { BlockchainService } from './blockchain.service.js';
import { IndexingService } from './indexing.service.js';

@Module({
  controllers: [BlockchainController],
  providers: [BlockchainService, IndexingService],
  exports: [BlockchainService, IndexingService],
})
export class BlockchainModule {}
