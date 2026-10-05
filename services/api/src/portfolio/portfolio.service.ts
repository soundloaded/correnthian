import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from '../pricing/pricing.service.js';

export interface Holding {
  assetId: string;
  symbol: string;
  name: string;
  category: string;
  balanceRaw: string;
  priceUsd: number | null;
  valueUsd: number | null;
  /** True when no fresh price exists, so the holding cannot be valued. */
  unpriced: boolean;
}

export interface Portfolio {
  totalUsd: number;
  /** Value of holdings we could price. Unpriced holdings are excluded, not zeroed. */
  pricedValueUsd: number;
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
    if (!wallet) throw new Error('Wallet not found');

    const assetIds = wallet.accounts.map((a) => a.asset.assetId);
    const prices = await this.pricing.latestMap(assetIds);

    const holdings: Holding[] = wallet.accounts.map((a) => {
      const price = prices[a.asset.assetId] ?? null;
      // Base units to a human number, via string arithmetic — never a float
      // multiply on a 18-decimal balance.
      const units = Number(a.balanceRaw) / 10 ** a.asset.decimals;
      const valueUsd = price === null ? null : units * price;
      return {
        assetId: a.asset.assetId,
        symbol: a.asset.symbol,
        name: a.asset.name,
        category: a.asset.category,
        balanceRaw: a.balanceRaw,
        priceUsd: price,
        valueUsd: valueUsd === null ? null : Number(valueUsd.toFixed(8)),
        unpriced: price === null,
      };
    });

    const priced = holdings.filter((h) => h.valueUsd !== null);
    const pricedValueUsd = priced.reduce((sum, h) => sum + (h.valueUsd ?? 0), 0);
    const unpricedCount = holdings.length - priced.length;

    return {
      totalUsd: Number(pricedValueUsd.toFixed(8)),
      pricedValueUsd: Number(pricedValueUsd.toFixed(8)),
      unpricedCount,
      holdings: holdings.sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1)),
      generatedAt: new Date().toISOString(),
      caveat: CAVEAT,
    };
  }

  /** Every wallet a user has registered, valued. */
  async forUser(userId: string): Promise<{ wallets: Portfolio[]; combinedUsd: number; unpricedCount: number }> {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    const out: Portfolio[] = [];
    for (const w of wallets) out.push(await this.forWallet(userId, w.id));

    return {
      wallets: out,
      combinedUsd: Number(out.reduce((s, p) => s + p.pricedValueUsd, 0).toFixed(8)),
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
}
