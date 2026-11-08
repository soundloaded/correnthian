import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import type { JobContext, JobOutcome, ScheduledJob } from './job.js';

/**
 * Flag assets whose price has gone stale.
 *
 * ## Flag, never prune. This is the decision, not a hesitation.
 *
 * Pruning `AssetPrice` rows would be destructive in a way that is not
 * recoverable and not obviously wrong, which is the worst combination. A price
 * history is the record of what a user was shown at the moment they were shown
 * it — the only evidence available if a fill is later disputed, and the input
 * to any future reconciliation between our number and a provider's. Deleting
 * it to save space is trading the thing that makes the product's central claim
 * checkable for disk.
 *
 * So this job writes nothing. It reads what is stale, names it, and stops.
 * Storage is cheap and price rows are small; the moment a genuine retention
 * policy is wanted it belongs to whoever owns the pricing module, with a
 * stated retention period and an export path, not to a sweep that starts
 * deleting history because nobody objected.
 *
 * ## What "stale" means, and why it is the same definition the API uses
 *
 * `PricingService.isStale` is the check `latest()` and `latestMap()` already
 * apply. A `chainlink:` row is stale only past the 86400-second heartbeat.
 * Every other source uses `MAX_AGE_SECONDS`. This job does not keep a second
 * copy: two thresholds would drift, and the drift would be invisible.
 *
 * ## Why it exists at all, given staleness is computed on read
 *
 * Read-time staleness is correct and stays. What it cannot do is tell anyone
 * *before* a user hits it. A price feed that dies at 03:00 produces no error,
 * no failed request and no alert — it produces a buy flow that quietly stops
 * offering a price. This sweep turns that into a dated row in the job ledger
 * within one interval, which is the difference between noticing and finding
 * out.
 */
@Injectable()
export class StalePriceFlagJob implements ScheduledJob {
  private readonly logger = new Logger(StalePriceFlagJob.name);

  readonly name = 'price.flag-stale';
  readonly everyMs = 5 * 60_000;
  readonly timeoutMs = 60_000;
  readonly description =
    'Flag enabled assets with no price, or no price fresher than the freshness threshold the ' +
    'API applies. Writes nothing: price history is never pruned.';

  /** Matches the cap the pricing list endpoints use, so the sweep sees the same registry. */
  private static readonly MAX_ASSETS = 1_000;

  /** Named in the run detail. Beyond this the list stops being readable. */
  private static readonly MAX_LISTED = 50;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(ctx: JobContext): Promise<JobOutcome> {
    const assets = await this.prisma.asset.findMany({
      where: { enabled: true },
      orderBy: { symbol: 'asc' },
      take: StalePriceFlagJob.MAX_ASSETS,
      select: { id: true, assetId: true, symbol: true },
    });

    if (assets.length === 0) {
      return {
        affected: 0,
        detail: { assets: 0, stale: [], neverPriced: [], thresholdSeconds: PricingService.MAX_AGE_SECONDS },
      };
    }

    // One row per asset: the newest price. `distinct` compiles to `DISTINCT ON`
    // on Postgres, which is the same shape `PricingService.latestMap` uses —
    // the per-asset newest price is the only thing either of them needs.
    const newest = await this.prisma.assetPrice.findMany({
      where: { assetId: { in: assets.map((a) => a.id) } },
      orderBy: { capturedAt: 'desc' },
      distinct: ['assetId'],
      select: { assetId: true, source: true, capturedAt: true },
    });

    const latestByAsset = new Map(newest.map((row) => [row.assetId, row]));

    // Built in full, then capped only when it goes into the run detail — a
    // count an operator acts on must not be a count of what fitted in a log.
    const staleness: Array<Record<string, unknown>> = [];
    const neverPriced: string[] = [];

    for (const asset of assets) {
      const row = latestByAsset.get(asset.id);
      if (!row) {
        neverPriced.push(asset.symbol);
        staleness.push({ symbol: asset.symbol, reason: 'never_priced' });
        continue;
      }
      const ageSeconds = Math.max(0, Math.round((ctx.now.getTime() - row.capturedAt.getTime()) / 1000));
      if (!PricingService.isStale(row.source, ageSeconds)) continue;
      staleness.push({
        symbol: asset.symbol,
        reason: 'stale',
        ageSeconds,
        source: row.source,
        capturedAt: row.capturedAt.toISOString(),
      });
    }

    const staleCount = staleness.filter((s) => s['reason'] === 'stale').length;
    const oldestAgeSeconds = staleness.reduce(
      (max, s) => Math.max(max, typeof s['ageSeconds'] === 'number' ? s['ageSeconds'] : 0),
      0,
    );

    if (staleness.length > 0) {
      this.logger.warn(
        `Price freshness: ${staleCount} asset(s) stale, ` +
          `${neverPriced.length} never priced. Nothing was pruned; the price history is intact.`,
      );
    }

    return {
      // Nothing was written. The number an operator wants from this job is how
      // many assets are currently unpriceable, so that is what is reported —
      // `0` here means the feeds are keeping up, not that the job was idle.
      affected: staleness.length,
      detail: {
        assets: assets.length,
        priced: assets.length - neverPriced.length,
        staleCount,
        neverPricedCount: neverPriced.length,
        // Which ones, capped. A count is what an operator acts on; the names
        // are what they act on it with, and `staleness` cannot carry them
        // beyond its own cap without losing the stale rows instead.
        neverPriced: neverPriced.slice(0, StalePriceFlagJob.MAX_LISTED),
        oldestAgeSeconds,
        thresholdSeconds: PricingService.MAX_AGE_SECONDS,
        truncated: staleness.length > StalePriceFlagJob.MAX_LISTED,
        wroteNothing: true,
        staleness: staleness.slice(0, StalePriceFlagJob.MAX_LISTED),
      },
    };
  }
}
