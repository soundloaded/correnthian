import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JobContext, JobOutcome, ScheduledJob } from './job.js';

/**
 * Move quotes past their expiry from `quoted` to `expired`.
 *
 * `SwapQuote` carries an `expiresAt` and a `state` whose enum has an `expired`
 * member, and until this job existed nothing ever reached it. A quote the user
 * did not act on stayed `quoted` forever, so a table of live-looking quotes
 * accumulated that no rail would honour — and any surface counting "open
 * quotes" counted the entire history.
 *
 * ## What it deliberately does not touch
 *
 * Only `quoted` rows. `awaiting_payment` and `broadcast` mean a payment or a
 * transaction is already in flight against the quote, and expiring one of
 * those is not a bookkeeping decision — it is a claim that money which may
 * still be moving is not. If those states need a timeout, they need a timeout
 * with a policy attached to it, decided by whoever owns the swap rail. This
 * job does not invent one.
 *
 * ## Why it is safe to re-run
 *
 * The `state: 'quoted'` guard is on the update, not only on the read. A row
 * the first run already expired does not match the second run's update, so two
 * overlapping runs produce the same table. The `expiresAt` guard is repeated
 * too, so a quote that was re-issued under the same row — which nothing does
 * today, and which would be a bug if it did — would not be expired by a stale
 * read.
 */
@Injectable()
export class SwapQuoteExpiryJob implements ScheduledJob {
  private readonly logger = new Logger(SwapQuoteExpiryJob.name);

  readonly name = 'swap-quote.expire';
  readonly everyMs = 60_000;
  readonly timeoutMs = 60_000;
  readonly description =
    'Move quotes still in "quoted" past their expiresAt to "expired". ' +
    'Quotes with a payment or a transaction already against them are left alone.';

  private static readonly BATCH = 500;
  private static readonly MAX_BATCHES = 20;

  /** States a quote may be in and still be expirable. Just the one. */
  private static readonly EXPIRABLE = ['quoted'] as const;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(ctx: JobContext): Promise<JobOutcome> {
    let expired = 0;
    let batches = 0;
    let stoppedEarly: 'complete' | 'budget' | 'batch_cap' = 'complete';

    for (;;) {
      if (ctx.signal.aborted) {
        stoppedEarly = 'budget';
        break;
      }
      if (batches >= SwapQuoteExpiryJob.MAX_BATCHES) {
        stoppedEarly = 'batch_cap';
        break;
      }

      const doomed = await this.prisma.swapQuote.findMany({
        where: {
          state: { in: [...SwapQuoteExpiryJob.EXPIRABLE] },
          expiresAt: { lt: ctx.now },
        },
        orderBy: { expiresAt: 'asc' },
        take: SwapQuoteExpiryJob.BATCH,
        select: { id: true },
      });
      if (doomed.length === 0) break;

      const { count } = await this.prisma.swapQuote.updateMany({
        where: {
          id: { in: doomed.map((r) => r.id) },
          state: { in: [...SwapQuoteExpiryJob.EXPIRABLE] },
          expiresAt: { lt: ctx.now },
        },
        data: { state: 'expired' },
      });
      expired += count;
      batches += 1;
      if (count === 0) break;
    }

    if (expired > 0) {
      this.logger.log(`Expired ${expired} stale swap quote(s) in ${batches} batch(es)`);
    }

    return {
      affected: expired,
      detail: {
        batches,
        stoppedEarly,
        states: [...SwapQuoteExpiryJob.EXPIRABLE],
        expiredBefore: ctx.now.toISOString(),
      },
    };
  }
}
