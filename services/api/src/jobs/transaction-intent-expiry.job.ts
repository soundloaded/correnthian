import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service.js';
import type { JobContext, JobOutcome, ScheduledJob } from './job.js';

/**
 * Expire transaction intents nobody acted on.
 *
 * `TransactionsService.expireStale()` was written with the lifecycle engine,
 * complete with the rule that a broadcast transaction is never expired, and
 * nothing called it. So the `expired` terminal state in §21's diagram was
 * unreachable from anywhere, and an unsigned intent sat in `created` or `signed`
 * with an `expiresAt` in the past indefinitely.
 *
 * This job is only the caller. The sweep's semantics — which states it may
 * touch, what reason it records, and why it acts as the `system` role rather
 * than as a user — belong to the transition table, and duplicating any of them
 * here would create a second authority for a question about money.
 */
@Injectable()
export class TransactionIntentExpiryJob implements ScheduledJob {
  private readonly logger = new Logger(TransactionIntentExpiryJob.name);

  readonly name = 'transaction.expire-intents';
  readonly everyMs = 60_000;
  readonly timeoutMs = 120_000;
  readonly description =
    'Move transaction intents past their expiry that nobody signed or broadcast to "expired". ' +
    'A transaction already on the network is never expired by this.';

  /** Named in the run detail. The sweep caps itself; this is only for the reader. */
  private static readonly MAX_LISTED = 50;

  constructor(@Inject(TransactionsService) private readonly transactions: TransactionsService) {}

  async run(ctx: JobContext): Promise<JobOutcome> {
    const result = await this.transactions.expireStale(ctx.now);

    if (result.expired > 0) {
      this.logger.log(`Expired ${result.expired} stale transaction intent(s) as of ${result.at}`);
    }

    return {
      affected: result.expired,
      detail: {
        expired: result.expired,
        at: result.at,
        // Ids only, capped. Enough to look a specific row up; not enough to
        // turn one run record into a log.
        ids: result.ids.slice(0, TransactionIntentExpiryJob.MAX_LISTED),
        truncated: result.ids.length > TransactionIntentExpiryJob.MAX_LISTED,
      },
    };
  }
}
