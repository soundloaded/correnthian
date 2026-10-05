import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module.js';
import { RedemptionController } from './redemption.controller.js';
import { RedemptionService } from './redemption.service.js';

@Module({
  imports: [ComplianceModule],
  controllers: [RedemptionController],
  providers: [RedemptionService],
  exports: [RedemptionService],
})
export class MetalsModule {}
