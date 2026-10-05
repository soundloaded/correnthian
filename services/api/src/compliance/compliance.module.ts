import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller.js';
import { JurisdictionService } from './jurisdiction.service.js';

@Module({
  controllers: [ComplianceController],
  providers: [JurisdictionService],
  exports: [JurisdictionService],
})
export class ComplianceModule {}
