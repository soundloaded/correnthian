import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { JurisdictionService } from '../compliance/jurisdiction.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface OnRampQuote {
  providerSlug: string;
  /** Always itemised and never hidden inside the rate. */
  fees: Array<{ label: string; amountUsd: number }>;
  network: string;
  assetId: string;
  receivedRaw: string;
  expiresAt: string;
}

/**
 * Fiat on-ramp and off-ramp.
 *
 * Correnthian does not hold fiat and does not touch the customer's card or
 * bank details. A licensed provider runs the KYC, takes the payment and
 * delivers crypto to an address the user supplies. Our job is to pick a
 * provider, surface its terms honestly, and refuse when the user's
 * jurisdiction does not permit it.
 *
 * No provider is selected yet, so every method here refuses rather than
 * returning a fabricated rate.
 */
@Injectable()
export class OnRampService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JurisdictionService) private readonly jurisdiction: JurisdictionService,
  ) {}

  /** Providers that can actually serve a fiat purchase right now. */
  private async activeProvider(category: 'onramp' | 'offramp', country: string | null, region: string | null) {
    const providers = await this.prisma.provider.findMany({
      where: { category, status: 'active' },
      orderBy: { name: 'asc' },
    });
    if (providers.length === 0) return null;
    for (const p of providers) {
      if (!(await this.jurisdiction.isProviderBlocked(country, region, p.slug))) return p;
    }
    return null;
  }

  /**
   * Whether the feature is available here, and if not, why — in words a
   * support agent can relay. Returned as an object rather than a bare string
   * or null so the response stays self-describing and versionable.
   */
  async unavailability(
    kind: 'buy' | 'sell',
    country: string | null,
    region: string | null,
  ): Promise<{ available: boolean; reason: string | null }> {
    const category = kind === 'buy' ? 'onramp' : 'offramp';
    const available = { available: true, reason: null };

    const provider = await this.activeProvider(category, country, region);
    if (!provider) {
      return {
        available: false,
        reason: `No ${category} provider is available. Correnthian has not contracted one yet.`,
      };
    }

    const eligibility = await this.jurisdiction.evaluate(country, region);
    if (!eligibility.allowed) {
      return { available: false, reason: 'Fiat conversion is not available in your jurisdiction.' };
    }

    const permitted = kind === 'buy' ? eligibility.canBuyCrypto : eligibility.canSellCrypto;
    if (!permitted) {
      return {
        available: false,
        reason:
          kind === 'buy'
            ? 'Buying crypto with fiat is not permitted in your jurisdiction.'
            : 'Selling crypto for fiat is not permitted in your jurisdiction.',
      };
    }
    return available;
  }

  async quote(
    kind: 'buy' | 'sell',
    params: { assetId: string; amountUsd: number; country: string | null; region: string | null },
  ): Promise<OnRampQuote> {
    if (!Number.isFinite(params.amountUsd) || params.amountUsd <= 0) {
      throw AppError.badRequest('amountUsd must be a positive number');
    }

    const { available, reason } = await this.unavailability(kind, params.country, params.region);
    if (!available) throw AppError.providerUnavailable(reason ?? 'Fiat conversion unavailable');

    const provider = await this.activeProvider(
      kind === 'buy' ? 'onramp' : 'offramp', params.country, params.region,
    );
    if (!provider) throw AppError.providerUnavailable('No provider available');

    const asset = await this.prisma.asset.findUnique({ where: { assetId: params.assetId } });
    if (!asset) throw AppError.notFound('Asset not in the registry');
    if (!asset.enabled) throw AppError.badRequest(`${asset.symbol} is not currently enabled`);

    // Unreachable until a provider is contracted. Kept explicit so the
    // failure is a refusal, not a plausible-looking rate.
    throw AppError.providerUnavailable(`Provider ${provider.slug} has no rate for this pair yet.`);
  }
}
