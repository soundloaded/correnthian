import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module.js';
import { OnRampController } from './onramp.controller.js';
import { OnRampService } from './onramp.service.js';

@Module({
  imports: [ComplianceModule],
  controllers: [OnRampController],
  providers: [OnRampService],
  exports: [OnRampService],
})
export class OnRampModule {}
