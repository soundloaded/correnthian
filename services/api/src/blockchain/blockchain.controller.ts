import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/guards/roles.guard.js';
import { BlockchainService } from './blockchain.service.js';
import { IndexingService } from './indexing.service.js';

@ApiTags('blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(
    @Inject(BlockchainService) private readonly blockchain: BlockchainService,
    @Inject(IndexingService) private readonly indexing: IndexingService,
  ) {}

  @Get('health')
  @Roles('support')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Per-chain reachability. Never exposes RPC endpoints.' })
  health() {
    return this.blockchain.health();
  }

  @Post('wallets/:walletId/sync')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Index a registered address from chain state' })
  sync(@CurrentUser() user: AuthenticatedUser, @Param('walletId') walletId: string) {
    return this.indexing.syncWallet(user.id, walletId);
  }
}
