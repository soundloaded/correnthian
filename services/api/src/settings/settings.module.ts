import { Module } from '@nestjs/common';
import { ChainsModule } from '../chains/chains.module.js';
import { ClientConfigController } from './client-config.controller.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';
import { SystemSettingsController } from './system-settings.controller.js';
import { SystemSettingsService } from './system-settings.service.js';

/**
 * BE-1505's system-configuration surface, and BE-1507's settings store.
 *
 * `PrismaService` and `AuditService` are both `@Global()`, so this module has
 * no imports of its own. Named `SettingsModule` rather than `FeatureFlags` on
 * purpose: the controllers own `/settings/*`, and whatever settings grow
 * beside flags (system settings, if notification preferences arrive) land
 * here rather than in a second module guarding the same path prefix.
 *
 * Two services, two kinds of setting. `SettingsService` owns the feature
 * flags — a named switch with a rollout, read by the console and, so far, by
 * nothing else. `SystemSettingsService` owns the settings the code reads: a
 * typed value with a declared default, overridden by an operator and read by
 * the services whose behaviour depends on it.
 */
@Module({
  // `ChainsModule` for the chain projection the client config publishes. The
  // chains module owns that table; this one asks it for the client-safe
  // shape rather than reaching for the table itself.
  imports: [ChainsModule],
  controllers: [SettingsController, SystemSettingsController, ClientConfigController],
  providers: [SettingsService, SystemSettingsService],
  exports: [SettingsService, SystemSettingsService],
})
export class SettingsModule {}
