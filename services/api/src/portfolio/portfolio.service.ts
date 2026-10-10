import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { AppError } from '../common/errors.js';
import {
  formatUsd,
  notionalUsd,
  parseUsd,
  sumUsd,
  USD_SCALE,
  type Usd,
} from '../fees/money.js';

export interface Holding {
  assetId: string;
  symbol: string;
  name: string;
  category: string;
  balanceRaw: string;
  /** Decimal string at 10^-8, not a JS number — see `priceAt`. */
  priceUsd: string | null;
  /** Decimal string at 10^-8. Exact, and never a float. */
  valueUsd: string | null;
  /** True when no fresh price exists, so the holding cannot be valued. */
  unpriced: boolean;
}

export interface Portfolio {
  /** Decimal string at 10^-8. A floor: unpriced holdings are excluded, not zeroed. */
  totalUsd: string;
  /** Value of holdings we could price. Unpriced holdings are excluded, not zeroed. */
  pricedValueUsd: string;
  unpricedCount: number;
  holdings: Holding[];
  generatedAt: string;
  caveat: string;
}

const CAVEAT =
  'Balances are public blockchain data. Values exclude any holding without a ' +
  'fresh price, so the total is a floor rather than an exact figure.';

/**
 * Portfolio valuation.
 *
 * The rule that shapes this module: a holding with no fresh price is marked
 * unpriced and excluded from the total. Treating it as zero would understate
 * what a user owns; treating it as its last known price would overstate it
 * without saying so. The total is therefore explicitly a floor, and the
 * unpriced count is reported alongside it.
 */
/**
 * The one place a price stops being a float.
 *
 * `PricingService.latestMap` hands back `Number(row.priceUsd)` off a `Decimal`
 * column, so a float is already in play by the time this module sees it. Money
 * here is `Usd` — a count of 10^-8 — so the conversion happens exactly once, at
 * the boundary, and everything derived from it is thereafter exact.
 *
 * `toFixed` loses nothing the number had not already lost: it formats the value
 * the float actually holds rather than inventing digits.
 *
 * Returns `null` for a price that cannot be represented, because this module's
 * vocabulary for "cannot value this" is `unpriced` and it is counted. A
 * non-finite or negative price would otherwise throw out of the whole
 * portfolio, turning one corrupt row into a 500 on every holding.
 */
function priceAt(price: number): Usd | null {
  if (!Number.isFinite(price) || price < 0) return null;
  return parseUsd(price.toFixed(USD_SCALE));
}

@Injectable()
export class PortfolioService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PricingService) private readonly pricing: PricingService,
  ) {}

  async forWallet(userId: string, walletId: string): Promise<Portfolio> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId },
      include: {
        accounts: {
          include: {
            asset: {
              select: { assetId: true, symbol: true, name: true, category: true, decimals: true },
            },
          },
        },
      },
    });
    if (!wallet) throw AppError.notFound('Wallet not found');

    // Surrogate FK, not the domain assetId — see PricingService.latestMap.
    const assetIds = wallet.accounts.map((a) => a.assetId);
    const prices = await this.pricing.latestMap(assetIds);

    // Valued in `Usd` first, formatted last. Sorting and summing both happen
    // on the exact values, so neither is subject to the rounding order of a
    // float reduction — the thing that makes two totals disagree by a cent.
    const valued = wallet.accounts.map((a) => {
      const priceUsd = priceAt(prices[a.assetId] ?? Number.NaN);
      return {
        account: a,
        priceUsd,
        // The same arithmetic the fees engine uses: bigint base units,
        // one division, half-up at 10^-8. Two notions of a dollar cannot
        // coexist into `BE-1602`.
        valueUsd:
          priceUsd === null ? null : notionalUsd(a.balanceRaw, a.asset.decimals, priceUsd),
      };
    });

    const pricedValueUsd = sumUsd(
      valued.flatMap((v) => (v.valueUsd === null ? [] : [v.valueUsd])),
    );
    const unpricedCount = valued.filter((v) => v.valueUsd === null).length;

    // Descending by value, unpriced last — the order the old float comparison
    // produced, done on exact values so a tie is a real tie.
    const ordered = [...valued].sort((a, b) => {
      if (a.valueUsd === null) return b.valueUsd === null ? 0 : 1;
      if (b.valueUsd === null) return -1;
      if (a.valueUsd === b.valueUsd) return 0;
      return a.valueUsd > b.valueUsd ? -1 : 1;
    });

    const holdings: Holding[] = ordered.map(({ account: a, priceUsd, valueUsd }) => ({
      assetId: a.asset.assetId,
      symbol: a.asset.symbol,
      name: a.asset.name,
      category: a.asset.category,
      // Exact, and always was: this is the string straight from the chain.
      balanceRaw: a.balanceRaw,
      priceUsd: priceUsd === null ? null : formatUsd(priceUsd),
      valueUsd: valueUsd === null ? null : formatUsd(valueUsd),
      unpriced: valueUsd === null,
    }));

    const formatted = formatUsd(pricedValueUsd);
    return {
      totalUsd: formatted,
      pricedValueUsd: formatted,
      unpricedCount,
      holdings,
      generatedAt: new Date().toISOString(),
      caveat: CAVEAT,
    };
  }

  /** Every wallet a user has registered, valued. */
  async forUser(userId: string): Promise<{ wallets: Portfolio[]; combinedUsd: string; unpricedCount: number }> {    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    const out: Portfolio[] = [];
    for (const w of wallets) out.push(await this.forWallet(userId, w.id));

    return {
      wallets: out,
      // `parseUsd` round-trips a decimal string exactly, so combining
      // portfolios cannot reintroduce the float the wallet path just removed.
      combinedUsd: formatUsd(sumUsd(out.map((p) => parseUsd(p.pricedValueUsd)))),
      unpricedCount: out.reduce((s, p) => s + p.unpricedCount, 0),
    };
  }

  /**
   * Persist a snapshot. Historical charts are built from these, so the write
   * happens after valuation and carries the unpriced count for later
   * reconciliation rather than silently producing a wrong-looking history.
   */
  async capture(userId: string, walletId: string) {
    const portfolio = await this.forWallet(userId, walletId);
    return this.prisma.portfolioSnapshot.create({
      data: {
        walletId,
        totalUsd: portfolio.pricedValueUsd,
        breakdown: {
          holdings: portfolio.holdings,
          unpricedCount: portfolio.unpricedCount,
        } as object,
      },
      select: { id: true, totalUsd: true, capturedAt: true },
    });
  }

  async history(userId: string, walletId: string, limit = 90) {
    return this.prisma.portfolioSnapshot.findMany({
      where: { walletId, wallet: { userId } },
      orderBy: { capturedAt: 'desc' },
      take: Math.min(limit, 365),
      select: { totalUsd: true, breakdown: true, capturedAt: true },
    });
  }

  /**
   * Allocation across every registered address: priced value grouped by
   * category, assets nested inside, each with an integer share.
   *
   * Shares are basis points of the priced total, truncated — never floats.
   * Truncation means shares can sum below 10000; that is documented on the
   * response rather than hidden by fudging the last bucket, because a
   * fudged bucket is a bucket that lies about one asset to flatter the
   * arithmetic. Unpriced holdings are excluded from every figure (an
   * unknown cannot be allocated) and counted, the same rule as valuation.
   */
  async allocation(userId: string): Promise<{
    pricedValueUsd: string;
    unpricedCount: number;
    byCategory: Array<{
      category: string;
      valueUsd: string;
      /** Truncated basis points of the priced total. See above. */
      shareBps: number;
      assets: Array<{ assetId: string; symbol: string; valueUsd: string; shareBps: number }>;
    }>;
    generatedAt: string;
  }> {
    const { wallets } = await this.forUser(userId);
    const priced = wallets
      .flatMap((w) => w.holdings)
      // `unpriced` is derived from `valueUsd === null` where holdings are
      // built, so one predicate covers both — a second would assert on a
      // distinction the producer never makes.
      .filter((h) => h.valueUsd !== null);

    const total = sumUsd(priced.map((h) => parseUsd(h.valueUsd as string)));
    const shareOf = (value: Usd): number => {
      if (total === 0n) return 0;
      return Number((value * 10_000n) / total);
    };

    const categories = new Map<string, { value: Usd; assets: Map<string, { symbol: string; value: Usd }> }>();
    for (const h of priced) {
      const value = parseUsd(h.valueUsd as string);
      let group = categories.get(h.category);
      if (!group) {
        group = { value: 0n as Usd, assets: new Map() };
        categories.set(h.category, group);
      }
      group.value = (group.value + value) as Usd;
      const asset = group.assets.get(h.assetId);
      if (asset) asset.value = (asset.value + value) as Usd;
      else group.assets.set(h.assetId, { symbol: h.symbol, value });
    }

    const byCategory = [...categories.entries()]
      .map(([category, group]) => ({
        category,
        valueUsd: formatUsd(group.value),
        shareBps: shareOf(group.value),
        assets: [...group.assets.entries()]
          .map(([assetId, asset]) => ({
            assetId,
            symbol: asset.symbol,
            valueUsd: formatUsd(asset.value),
            shareBps: shareOf(asset.value),
          }))
          .sort((a, b) => (a.valueUsd === b.valueUsd ? 0 : a.valueUsd > b.valueUsd ? -1 : 1)),
      }))
      .sort((a, b) => (a.valueUsd === b.valueUsd ? 0 : a.valueUsd > b.valueUsd ? -1 : 1));

    return {
      pricedValueUsd: formatUsd(total),
      unpricedCount: wallets.reduce((n, w) => n + w.unpricedCount, 0),
      byCategory,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Snapshot history reduced to one point per UTC bucket, ascending — the
   * shape a chart renders directly. Latest snapshot in each bucket wins;
   * empty buckets are absent rather than zero-filled, because a zero would
   * claim a valuation that was never taken.
   */
  async historySeries(
    userId: string,
    walletId: string,
    bucket: 'day' | 'week',
    limit = 90,
  ): Promise<Array<{ bucketStart: string; totalUsd: string; unpricedCount: number }>> {
    const rows = await this.prisma.portfolioSnapshot.findMany({
      where: { walletId, wallet: { userId } },
      orderBy: { capturedAt: 'desc' },
      take: Math.min(limit, 365),
      select: { totalUsd: true, breakdown: true, capturedAt: true },
    });

    const seen = new Map<string, { bucketStart: string; totalUsd: string; unpricedCount: number }>();
    for (const row of rows) {
      const at = new Date(row.capturedAt);
      const start =
        bucket === 'day'
          ? new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
          : startOfUtcWeek(at);
      const key = start.toISOString();
      // Rows arrive newest-first, so the first row per bucket is its latest
      // snapshot. Later rows in the same bucket are older readings, skipped.
      if (seen.has(key)) continue;
      const breakdown = (row.breakdown ?? {}) as { unpricedCount?: unknown };
      seen.set(key, {
        bucketStart: key,
        // Decimal serialises exactly; String() keeps whatever the column
        // holds rather than reformatting it into a new claim.
        totalUsd: String(row.totalUsd),
        unpricedCount: typeof breakdown.unpricedCount === 'number' ? breakdown.unpricedCount : 0,
      });
    }
    return [...seen.values()].reverse();
  }
}

/** Monday 00:00 UTC of the week containing `at`. */
function startOfUtcWeek(at: Date): Date {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const mondayOffset = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - mondayOffset * 86_400_000);
}
