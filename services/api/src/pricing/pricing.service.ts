import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PriceRecord {
  assetId: string;
  priceUsd: number;
  source: string;
  capturedAt: string;
}

/**
 * Pricing.
 *
 * The distinction that matters here is **reference price vs executable price**.
 *
 * A gold spot quote is a reference: it is what the metal is notionally worth.
 * It is NOT what a user receives. The executable price is the reference plus
 * the provider's spread, plus network and provider fees. Showing a user a spot
 * price as though it were the price they would get is the single most damaging
 * thing a metals product can do, because the gap is invisible until settlement.
 *
 * Both are stored, and the spread between them is never hidden.
 */
@Injectable()
export class PricingService {
  /** Stale beyond this, a price is not shown at all rather than shown as current. */
  static readonly MAX_AGE_SECONDS = 300;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Record a price. A price without a source is not usable — the source is
   * what makes it auditable, and an unattributed number is just a constant.
   */
  async record(assetId: string, priceUsd: number, source: string) {
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      throw AppError.badRequest('priceUsd must be a positive number');
    }
    if (!source.trim()) throw AppError.badRequest('A price must carry a source');

    const asset = await this.prisma.asset.findUnique({ where: { assetId } });
    if (!asset) throw AppError.notFound('Asset not in the registry');

    return this.prisma.assetPrice.create({
      data: { assetId: asset.id, priceUsd, source, capturedAt: new Date() },
      select: { assetId: true, priceUsd: true, source: true, capturedAt: true },
    });
  }

  /**
   * The most recent price, plus whether it is fresh enough to display.
   *
   * Staleness is reported rather than silently smoothed over. A price from
   * six hours ago is not a current price, and presenting it as one is how a
   * user ends up transacting against a number that no longer exists.
   */
  async latest(assetId: string): Promise<
    | { found: false; assetId: string; reason: string }
    | { found: true; assetId: string; priceUsd: number; source: string; capturedAt: string; ageSeconds: number; stale: boolean }
  > {
    const asset = await this.prisma.asset.findUnique({ where: { assetId } });
    if (!asset) throw AppError.notFound('Asset not in the registry');

    const row = await this.prisma.assetPrice.findFirst({
      where: { assetId: asset.id },
      orderBy: { capturedAt: 'desc' },
    });

    if (!row) {
      return { found: false, assetId, reason: 'No price has been recorded for this asset' };
    }

    const ageSeconds = Math.round((Date.now() - row.capturedAt.getTime()) / 1000);
    return {
      found: true,
      assetId,
      priceUsd: Number(row.priceUsd),
      source: row.source,
      capturedAt: row.capturedAt.toISOString(),
      ageSeconds,
      stale: ageSeconds > PricingService.MAX_AGE_SECONDS,
    };
  }

  /**
   * Reference and executable side by side, with the spread explicit.
   *
   * Until a provider is contracted there is no executable price, and this
   * says so rather than quoting the reference as if it were obtainable.
   */
  async quote(assetId: string, notionalUsd?: number) {
    const latest = await this.latest(assetId);
    if (!latest.found) return latest;

    // No metals provider is contracted, so there is no executable price to
    // quote and no spread to compute. Both stay null and the reason is
    // stated, rather than the reference price being passed off as obtainable.
    return {
      ...latest,
      referencePriceUsd: latest.priceUsd,
      executablePriceUsd: null,
      spreadUsd: null,
      note: 'No executable price: no metals provider is contracted. The reference price is not obtainable.',
      notionalUsd: notionalUsd ?? null,
    };
  }

  /** Latest price for every asset, for portfolio valuation. */
  async latestMap(assetIds: string[]): Promise<Record<string, number>> {
    if (assetIds.length === 0) return {};
    const rows = await this.prisma.assetPrice.findMany({
      where: { assetId: { in: assetIds } },
      orderBy: { capturedAt: 'desc' },
      distinct: ['assetId'],
      select: { assetId: true, priceUsd: true, capturedAt: true },
    });
    const out: Record<string, number> = {};
    for (const r of rows) {
      const age = (Date.now() - r.capturedAt.getTime()) / 1000;
      if (age <= PricingService.MAX_AGE_SECONDS) out[r.assetId] = Number(r.priceUsd);
    }
    return out;
  }

  async history(assetId: string, limit = 100) {
    return this.prisma.assetPrice.findMany({
      where: { assetId },
      orderBy: { capturedAt: 'desc' },
      take: Math.min(limit, 1000),
      select: { priceUsd: true, source: true, capturedAt: true },
    });
  }
}
