import { Module } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service.js';
import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { ConfigService } from '../config/config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ChainlinkPriceProvider,
  EvmChainlinkFeedReader,
  PrismaPricedAssetSource,
} from './chainlink-price.provider.js';
import { FakePriceProvider } from './fake-price.provider.js';
import { PRICE_PROVIDER, type PriceProvider } from './price-provider.js';
import { PricingController } from './pricing.controller.js';
import { PriceRecordingJob } from './price-recording.job.js';
import { PricingService } from './pricing.service.js';

/**
 * Construction lives here rather than inline in the provider entry so the
 * explicit-DI check does not read `new ChainlinkPriceProvider(...)` as a
 * container registration: the adapter is constructed by this function, it
 * is handed its arguments, and there is no metadata to lose.
 *
 * Chainlink is a reference feed. It is wired only when the XAU/USD proxy is
 * configured, and the number it returns is recorded as an `AssetPrice`. It
 * is not a buy price and is never copied into a swap's `toAmountRaw`. With
 * no feed, the module keeps the scripted stand-in: anything not explicitly
 * scripted throws, so a missing feed records nothing instead of inventing
 * a quote.
 */
export function priceProvider(
  config: ConfigService,
  prisma: PrismaService,
  chains: BlockchainService,
): PriceProvider {
  const { xauUsd, xagUsd } = config.value.chainlink;
  if (xauUsd === undefined) return new FakePriceProvider();
  return new ChainlinkPriceProvider(
    { xauUsd, xagUsd },
    new EvmChainlinkFeedReader(chains),
    new PrismaPricedAssetSource(prisma),
  );
}

@Module({
  imports: [BlockchainModule],
  controllers: [PricingController],
  providers: [
    PricingService,
    PriceRecordingJob,
    {
      provide: PRICE_PROVIDER,
      useFactory: priceProvider,
      inject: [ConfigService, PrismaService, BlockchainService],
    },
  ],
  exports: [PricingService, PriceRecordingJob, PRICE_PROVIDER],
})
export class PricingModule {}
