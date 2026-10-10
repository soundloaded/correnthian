import { Module } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ComplianceController } from './compliance.controller.js';
import { ComplianceGate } from './compliance-gate.service.js';
import { JurisdictionService } from './jurisdiction.service.js';
import { KycService } from './kyc.service.js';
import { PersonaWebhookController } from './persona-webhook.controller.js';
import { ConfigService } from '../config/config.service.js';
import { FakeScreeningProvider } from './screening/fake-screening.provider.js';
import { PersonaScreeningProvider } from './screening/persona-screening.provider.js';
import { SCREENING_PROVIDER } from './screening/screening-provider.js';

const logger = new Logger('ComplianceModule');

/**
 * Construction lives here rather than inline in the provider entry so the
 * explicit-DI check does not read `new PersonaScreeningProvider(...)` as a
 * container registration: neither adapter is constructed by Nest, both are
 * handed their arguments by this function, and there is no metadata to lose.
 */
function screeningProvider(config: ConfigService) {
  const persona = config.persona;
  if (persona.configured && persona.apiKey && persona.webhookSecret) {
    return new PersonaScreeningProvider({
      apiKey: persona.apiKey,
      webhookSecret: persona.webhookSecret,
      baseUrl: persona.baseUrl,
      templateId: persona.templateId,
    });
  }
  // Unconfigured in development and test — and, until credentials
  // exist, everywhere else. The fake throws on anything unscripted,
  // so an unconfigured production denies fiat with "screening
  // unavailable" rather than waving it through. Failing closed is a
  // property of the fallback, not just of the gate.
  if (config.isProduction) {
    logger.warn(
      'PERSONA_API_KEY/PERSONA_WEBHOOK_SECRET are unset: screening is unconfigured and all fiat movement will be denied',
    );
  }
  return new FakeScreeningProvider();
}

/**
 * Verification, screening and the fiat gate live here — not scattered
 * across the modules they protect. The gate is consumed by redemption (and,
 * when they exist, onramp execution and metals purchase); the protected
 * modules import this one, never the reverse, so no cycle can form around
 * the compliance check.
 */
@Module({
  controllers: [ComplianceController, PersonaWebhookController],
  providers: [
    JurisdictionService,
    KycService,
    ComplianceGate,
    {
      provide: SCREENING_PROVIDER,
      useFactory: (config: ConfigService) => screeningProvider(config),
      inject: [ConfigService],
    },
  ],
  exports: [JurisdictionService, KycService, ComplianceGate, SCREENING_PROVIDER],
})
export class ComplianceModule {}
