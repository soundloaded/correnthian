import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { SwapsController } from './swaps.controller.js';
import { SwapsService } from './swaps.service.js';

@Module({
  imports: [ProvidersModule],
  controllers: [SwapsController],
  providers: [SwapsService],
  exports: [SwapsService],
})
export class SwapsModule {}
