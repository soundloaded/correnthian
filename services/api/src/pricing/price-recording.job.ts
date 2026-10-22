import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JobContext, JobOutcome, ScheduledJob } from '../jobs/job.js';
import { PRICE_PROVIDER, PriceProvider, PriceUnavailableError } from './price-provider.js';

/**
 * Record reference prices from the market-data vendor — BE-502's delivery.
 *
 * The registry holds what the platform believes about metal; without a
 * vendor feeding it, the belief goes stale and every fee priced from it
 * prices from a number that no longer exists. The job closes that gap by
 * writing what the vendor said, when it said it, for every asset the
 * vendor can price.
 *
 * ## What "missing" means
 *
 * An asset the vendor cannot price gets no row, and the run says so by
 * name. `latest()` already answers "no price on record" honestly — the
 * job's job is to make that answer rarer, not to invent a row that would
 * silence it wrongly. A price carried forward is a price nobody gave.
 *
 * ## What "down" means
 *
 * `isAvailable()` false, or `spotPrices()` throwing, ends the run with
 * zero affected and the reason in the detail. The run is not a failure:
 * a vendor that is down for an hour is a gap in the record, and the
 * staleness flag is what tells the operator the gap exists. Failing the
 * run would say the scheduler is broken, which it is not.
 */
@Injectable()
export class PriceRecordingJob implements ScheduledJob {
  private readonly logger = new Logger(PriceRecordingJob.name);

  readonly name = 'pricing.record-reference';
  readonly everyMs = 5 * 60_000;
  readonly timeoutMs = 2 * 60_000;
  readonly description =
    'Record reference prices from the market-data vendor. Assets the vendor ' +
    'cannot price get no row; a vendor that is down ends the run, not the schedule.';

  /** Rows per run: one per price the vendor gave, bounded by the registry. */
  private static readonly MAX_LISTED = 50;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PRICE_PROVIDER) private readonly prices: PriceProvider,
  ) {}

  async run(ctx: JobContext): Promise<JobOutcome> {
    if (!(await this.prices.isAvailable())) {
      return {
        affected: 0,
        detail: { recorded: 0, skipped: [], reason: `${this.prices.name} unavailable` },
      };
    }

    let quotes;
    try {
      quotes = await this.prices.spotPrices();
    } catch (err) {
      const reason =
        err instanceof PriceUnavailableError ? err.message : 'The price vendor could not be reached.';
      this.logger.warn(`Price recording skipped: ${reason}`);
      return { affected: 0, detail: { recorded: 0, skipped: [], reason } };
    }

    let recorded = 0;
    const skipped: string[] = [];
    const seen: string[] = [];

    for (const quote of quotes) {
      if (ctx.signal.aborted) break;
      if (!Number.isFinite(quote.priceUsd) || quote.priceUsd <= 0 || !quote.source.trim()) {
        // A malformed price from the vendor is the vendor's bug, and it is
        // recorded as skipped — never written, never retried, never hidden.
        skipped.push(quote.assetId);
        continue;
      }
      const asset = await this.prisma.asset.findUnique({
        where: { assetId: quote.assetId },
        select: { id: true },
      });
      if (!asset) {
        // The vendor prices something the registry does not hold. Not a
        // row, not a silent drop: a name the operator can investigate.
        skipped.push(quote.assetId);
        continue;
      }
      await this.prisma.assetPrice.create({
        data: {
          assetId: asset.id,
          priceUsd: quote.priceUsd,
          source: quote.source.slice(0, 80),
          capturedAt: ctx.now,
        },
      });
      recorded += 1;
      if (seen.length < PriceRecordingJob.MAX_LISTED) seen.push(quote.assetId);
    }

    return {
      affected: recorded,
      detail: { recorded, skipped: skipped.slice(0, PriceRecordingJob.MAX_LISTED), assetIds: seen },
    };
  }
}
