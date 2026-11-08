import { Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { FeesModule } from '../fees/fees.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { SwapsController } from './swaps.controller.js';
import { SwapsService } from './swaps.service.js';
import { EvmTokenAllowance, TOKEN_ALLOWANCE } from './token-allowance.js';
import { UniswapV3Quoter } from './uniswap-v3-quoter.js';

@Module({
  imports: [ProvidersModule, FeesModule, SettingsModule, BlockchainModule, TransactionsModule],
  controllers: [SwapsController],
  providers: [
    SwapsService,
    UniswapV3Quoter,
    { provide: TOKEN_ALLOWANCE, useClass: EvmTokenAllowance },
  ],
  exports: [SwapsService],
})
export class SwapsModule {}
