import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JobContext, JobOutcome, ScheduledJob } from './job.js';

/**
 * Delete idempotency records nobody can use any more.
 *
 * ## The gap this closes
 *
 * `IdempotencyStore.purgeExpired()` existed and was called by nothing. Records
 * expire *logically* — a request carrying a key past its `expiresAt` is
 * correctly treated as a fresh request — so nothing broke. The rows simply
 * never went away, and that table holds a fingerprint of every financial POST
 * the platform has ever seen. Unbounded growth in the one table whose whole
 * job is to remember money.
 *
 * ## Why bounded batches rather than one `DELETE`
 *
 * A single `DELETE ... WHERE expiresAt < now` against a table with a year of
 * history takes a long lock, writes a huge WAL burst, and on a busy system
 * blocks the inserts it is racing. The purge is not urgent — a row that
 * outlives its usefulness by another fifteen minutes costs nothing — so it
 * runs in bounded batches with the run's budget as the stop condition. A
 * backlog is worked down over successive runs, which is exactly what an
 * interval is for.
 *
 * ## Why it is safe to re-run, and safe to overlap
 *
 * The predicate *is* the guard. A row already deleted does not match; a row
 * that is still expired when the second run reads it is deleted by whichever
 * run gets there first and matches zero for the other. Both runs report fewer
 * deletions, and the row count is the same.
 *
 * The `expiresAt` clause is repeated on the delete, not just on the read, and
 * that is load-bearing: `IdempotencyStore.claim` can take over an expired
 * *completed* record and give it a fresh 24-hour life. Deleting by id alone
 * would let this job remove a record that is, at this instant, an active claim
 * — reopening a key that a request is currently running under, which is the
 * double-purchase this whole mechanism exists to prevent.
 *
 * ## In-progress rows are purged too, and that is deliberate
 *
 * A claim whose lease expired and was never completed is `in_progress` with an
 * `expiresAt` in the past, and `resolveExisting` already refuses to reuse it —
 * it answers `abandoned`, which the interceptor turns into a 409 rather than
 * an execution. So a row like that is logically dead the moment it passes
 * `expiresAt`, and leaving it is pure growth. The `expiresAt` guard on the
 * delete is what keeps this correct: an in-progress row still inside its
 * 24-hour window is never selected, however long its lease has been stale.
 */
@Injectable()
export class IdempotencyPurgeJob implements ScheduledJob {
  private readonly logger = new Logger(IdempotencyPurgeJob.name);

  readonly name = 'idempotency.purge';
  readonly everyMs = 15 * 60_000;
  readonly timeoutMs = 5 * 60_000;
  readonly description =
    'Delete idempotency records past their expiry, in bounded batches. ' +
    'Expired records are already treated as absent; this stops them accumulating.';

  /** Rows per statement. Small enough that no single delete holds a long lock. */
  private static readonly BATCH = 500;

  /** A ceiling on one run, so a huge backlog is drained over several runs. */
  private static readonly MAX_BATCHES = 40;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(ctx: JobContext): Promise<JobOutcome> {
    let deleted = 0;
    let batches = 0;
    let stoppedEarly: 'complete' | 'budget' | 'batch_cap' = 'complete';

    for (;;) {
      if (ctx.signal.aborted) {
        stoppedEarly = 'budget';
        break;
      }
      if (batches >= IdempotencyPurgeJob.MAX_BATCHES) {
        stoppedEarly = 'batch_cap';
        break;
      }

      const doomed = await this.prisma.idempotencyRecord.findMany({
        where: { expiresAt: { lt: ctx.now } },
        // Oldest first, so a backlog drains in the order it accumulated rather
        // than in whatever order the planner feels like.
        orderBy: { expiresAt: 'asc' },
        take: IdempotencyPurgeJob.BATCH,
        select: { id: true },
      });
      if (doomed.length === 0) break;

      const { count } = await this.prisma.idempotencyRecord.deleteMany({
        where: {
          id: { in: doomed.map((r) => r.id) },
          // Repeated on purpose — see the module header. A record taken over
          // between the read and this delete has a future `expiresAt` and must
          // survive.
          expiresAt: { lt: ctx.now },
        },
      });
      deleted += count;
      batches += 1;

      if (count === 0) {
        // Every candidate was taken over or removed by somebody else. Another
        // run will find whatever is genuinely left; spinning here would just
        // burn the job's budget rediscovering the same rows.
        stoppedEarly = 'complete';
        break;
      }
    }

    if (deleted > 0) {
      this.logger.log(`Purged ${deleted} expired idempotency record(s) in ${batches} batch(es)`);
    }

    return {
      affected: deleted,
      detail: { batches, stoppedEarly, expiredBefore: ctx.now.toISOString() },
    };
  }
}
