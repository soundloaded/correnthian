import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface Eligibility {
  allowed: boolean;
  canBuyCrypto: boolean;
  canSellCrypto: boolean;
  canUseMetals: boolean;
  canRedeem: boolean;
  kycRequired: boolean;
  blockedProviders: string[];
  matchedRule: { country: string; region: string | null } | null;
  /** True when nothing matched, which for a regulated product means deny. */
  unmatched: boolean;
}

/**
 * Jurisdiction engine: country -> state -> eligibility -> available features.
 *
 * Defaults are deny. A location with no rule is not "allowed by default" —
 * for a regulated financial product, unknown jurisdiction means stop and ask.
 * That inversion is the whole point of the module; getting it the other way
 * round would make the system permissive by omission.
 */
@Injectable()
export class JurisdictionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async evaluate(country: string | null, region: string | null): Promise<Eligibility> {
    if (!country || country.length !== 2) {
      return this.deny(null, region, 'unknown');
    }
    const cc = country.toUpperCase();

    // Most specific match wins: region rule, else country-wide rule.
    const rule =
      (region
        ? await this.prisma.jurisdictionRule.findUnique({
            where: { country_region: { country: cc, region } },
          })
        : null) ??
      (await this.prisma.jurisdictionRule.findFirst({
        where: { country: cc, region: null },
      }));

    if (!rule || !rule.active) return this.deny(cc, region, 'unmatched');

    return {
      allowed: true,
      canBuyCrypto: rule.canBuyCrypto,
      canSellCrypto: rule.canSellCrypto,
      canUseMetals: rule.canUseMetals,
      canRedeem: rule.canRedeem,
      kycRequired: rule.kycRequired,
      blockedProviders: rule.blockedProviders,
      matchedRule: { country: rule.country, region: rule.region },
      unmatched: false,
    };
  }

  /**
   * Throw rather than return false. A blocked jurisdiction is a 451 with the
   * reason, not a silent no-op the caller may ignore.
   */
  async assertEligible(
    country: string | null,
    region: string | null,
    action: 'buy' | 'sell' | 'metals' | 'redeem',
  ): Promise<Eligibility> {
    const e = await this.evaluate(country, region);
    if (!e.allowed) {
      throw AppError.jurisdictionBlocked(
        'This action is not available in your jurisdiction.',
        { country, region, reason: 'no_matching_rule' },
      );
    }
    const permitted = {
      buy: e.canBuyCrypto, sell: e.canSellCrypto,
      metals: e.canUseMetals, redeem: e.canRedeem,
    }[action];
    if (!permitted) {
      throw AppError.jurisdictionBlocked(`Not permitted in your jurisdiction.`, {
        country, region, action, matchedRule: e.matchedRule,
      });
    }
    return e;
  }

  async isProviderBlocked(country: string | null, region: string | null, providerSlug: string): Promise<boolean> {
    const e = await this.evaluate(country, region);
    return e.blockedProviders.includes(providerSlug);
  }

  private deny(country: string | null, region: string | null, reason: string): Eligibility {
    return {
      allowed: false, canBuyCrypto: false, canSellCrypto: false,
      canUseMetals: false, canRedeem: false, kycRequired: true,
      blockedProviders: [],
      matchedRule: country ? { country: country.toUpperCase(), region } : null,
      unmatched: true,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ...(reason ? {} : {}),
    };
  }
}
