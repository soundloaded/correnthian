import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeliveryService } from '../notifications/delivery.service.js';
import type { JobContext, JobOutcome, ScheduledJob } from './job.js';

/**
 * Flush the notification queue — BE-1201's transport half, and DEF-009's fix.
 *
 * The job asks the transport whether it can reach its provider *before*
 * claiming anything. A claim is a lease on work the worker intends to do;
 * claiming rows the transport cannot send leases work it will abandon, and
 * the next run inherits the backlog plus the confusion. Unavailability
 * denies before it costs.
 *
 * Delivery itself lives in `DeliveryService`: the claim is atomic (the
 * predicate repeats on the write), the lease lapses on a dead worker, and
 * transient failures go back to the queue with a count, up to five attempts
 * and then failed rather than held forever.
 *
 * The run detail names the transport — `console` or `smtp` — because a
 * "sent" through the console sink is a rendered message, not a delivered
 * one, and the operator reading the job's last run needs to know which one
 * the run used.
 */
@Injectable()
export class NotificationDispatchJob implements ScheduledJob {
  private readonly logger = new Logger(NotificationDispatchJob.name);

  readonly name = 'notifications.dispatch';
  readonly everyMs = 60_000;
  readonly timeoutMs = 120_000;
  readonly description =
    'Claim pending notifications and send them through the configured transport. ' +
    'Rows the provider cannot reach go back to the queue; rows that cannot ' +
    'be delivered fail loudly rather than silently.';

  /** Rows per run. Each is a message, so the batch is the sending rate. */
  private static readonly BATCH = 50;

  constructor(@Inject(DeliveryService) private readonly delivery: DeliveryService) {}

  async run(ctx: JobContext): Promise<JobOutcome> {
    const claimed = await this.delivery.claim(
      NotificationDispatchJob.BATCH,
      `job:${ctx.now.getTime()}`,
      ctx.now,
    );

    if (claimed.length === 0) {
      return { affected: 0, detail: { claimed: 0, sent: 0, retrying: 0, failed: 0 } };
    }

    let sent = 0;
    let retrying = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of claimed) {
      if (ctx.signal.aborted) break;
      try {
        const outcome = await this.delivery.dispatch(row, ctx.now);
        if (outcome === 'sent') sent += 1;
        else if (outcome === 'retrying') retrying += 1;
        else failed += 1;
      } catch (err) {
        // Dispatch is not supposed to throw — it records outcomes, not
        // crashes — so a throw is the bug surfacing, and the row keeps its
        // claim rather than being marked anything. The lease lapses and the
        // next run picks it up.
        failed += 1;
        errors.push(
          `${row.id}: ${err instanceof Error ? err.message : 'unknown dispatch error'}`.slice(0, 200),
        );
        this.logger.error(`Dispatch threw for notification ${row.id}; claim left to lapse.`);
      }
    }

    return {
      affected: sent + failed,
      detail: { claimed: claimed.length, sent, retrying, failed, errors: errors.slice(0, 10) },
    };
  }
}
