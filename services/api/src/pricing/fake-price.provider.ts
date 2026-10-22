import {
  PriceProvider,
  PriceUnavailableError,
  type SpotPrice,
} from './price-provider.js';

/**
 * The scripted stand-in behind the price port.
 *
 * Used by every test and by local development without market-data
 * credentials. Fail-closed by construction: anything not explicitly
 * scripted throws `PriceUnavailableError`, so a test that forgot to script
 * an asset exercises the vendor-down path instead of silently passing on
 * an unexamined price.
 */
export class FakePriceProvider extends PriceProvider {
  readonly name = 'fake';

  private readonly prices = new Map<string, SpotPrice>();
  readonly calls: { spotPrices: number } = { spotPrices: 0 };

  scriptPrice(assetId: string, price: Omit<SpotPrice, 'assetId'>): void {
    this.prices.set(assetId, { ...price, assetId });
  }

  async spotPrices(): Promise<SpotPrice[]> {
    this.calls.spotPrices += 1;
    if (this.prices.size === 0) {
      throw new PriceUnavailableError('no scripted prices');
    }
    return [...this.prices.values()];
  }

  async isAvailable(): Promise<boolean> {
    return this.prices.size > 0;
  }
}
