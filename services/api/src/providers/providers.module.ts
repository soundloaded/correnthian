import { Module } from '@nestjs/common';
import { PROVIDER_PROBES } from './provider-probe.js';
import { ProviderHealthService } from './provider-health.service.js';
import { ProvidersController } from './providers.controller.js';
import { ProvidersService } from './providers.service.js';

/**
 * `PROVIDER_PROBES` is an empty registry on purpose.
 *
 * A provider's health can only be established by reaching it, and there is
 * nothing in this deployment to reach it with: `packages/integrations` exports
 * nothing, no metals or on-ramp provider is contracted, and `Provider` has no
 * URL or credential column by design. Registering a probe that answered
 * `reachable` because a row exists would make this module's output
 * unfalsifiable, which is the one thing a health signal must never be — see
 * `provider-probe.ts`.
 *
 * So the registry starts empty and `ProviderHealthService` treats an absent
 * probe as `unavailable`: the provider's status is not asserted, and one that
 * claims `active` without anything verifying it is demoted rather than left
 * standing.
 *
 * Adding a probe is one entry here — `useExisting` or a class — plus a
 * `ProviderProbe` implementation. Nothing else in the module changes.
 */
@Module({
  controllers: [ProvidersController],
  providers: [
    ProvidersService,
    ProviderHealthService,
    { provide: PROVIDER_PROBES, useValue: [] },
  ],
  exports: [ProvidersService, ProviderHealthService],
})
export class ProvidersModule {}
