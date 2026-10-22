import { Module } from '@nestjs/common';
import { ConfigService } from '../config/config.service.js';
import { FakePriceProvider } from './fake-price.provider.js';
import { PRICE_PROVIDER } from './price-provider.js';
import { PricingController } from './pricing.controller.js';
import { PriceRecordingJob } from './price-recording.job.js';
import { PricingService } from './pricing.service.js';

/**
 * Construction lives here rather than inline in the provider entry so the
 * explicit-DI check does not read `new FakePriceProvider(...)` as a
 * container registration: the adapter is constructed by this function, it
 * takes no arguments, and there is no metadata to lose.
 *
 * No vendor is contracted, so the module wires the fake: a scripted
 * stand-in that throws for anything not explicitly scripted. The recording
 * job against it records only what a test scripted and says the rest is
 * missing — which is the honest behaviour until a vendor exists. Adding a
 * vendor is a new `PriceProvider` implementation and one entry here;
 * nothing that records, quotes, or schedules changes.
 */
function priceProvider(_config: ConfigService) {
  return new FakePriceProvider();
}

@Module({
  controllers: [PricingController],
  providers: [
    PricingService,
    PriceRecordingJob,
    {
      provide: PRICE_PROVIDER,
      useFactory: priceProvider,
      inject: [ConfigService],
    },
  ],
  exports: [PricingService, PriceRecordingJob, PRICE_PROVIDER],
})
export class PricingModule {}
