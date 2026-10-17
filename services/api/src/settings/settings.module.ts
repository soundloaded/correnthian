import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

/**
 * BE-1505's system-configuration surface.
 *
 * `PrismaService` and `AuditService` are both `@Global()`, so this module has
 * no imports of its own. Named `SettingsModule` rather than `FeatureFlags` on
 * purpose: the controller owns `/settings/*`, and whatever settings grow
 * beside flags (notification preferences, if Belfry builds them) lands here
 * rather than in a second module guarding the same path prefix.
 */
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
