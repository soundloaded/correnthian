import { Inject, Injectable, Logger } from '@nestjs/common';
import { redactDeep } from '@correnthian/security';
import type { JobRun, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JobTrigger } from './job.js';

/**
 * The durable half of the schedule.
 *
 * The lease in `JobLockService` decides *who* runs a job. This decides what an
 * operator can find out about it afterwards, and it is the half that has to
 * survive a Redis flush, a failover and the person asking at 3am.
 *
 * Three things it is responsible for that are easy to get wrong:
 *
 * **A run that never finishes is recorded as such.** When an instance dies
 * mid-run the row it opened stays `running` forever, because the process that
 * would have closed it is gone. `begin` marks it `abandoned` instead of
 * leaving it — and it is correct to do so without checking anything, because
 * the caller only reaches `begin` while holding the job's lease. If we hold
 * the lease, nobody else can be inside this job, so any `running` row for it
 * belongs to a process that no longer exists.
 *
 * **Errors and detail are redacted before they are stored.** A provider
 * error string is a payload from outside our trust boundary and can carry an
 * endpoint, a key in a query parameter, or topology we do not publish. The
 * field is 500 characters because an operator needs the first line, not a
 * stack. Detail is free-form by design, which is exactly why it gets a
 * key-name denylist of its own on top of `redactDeep` — see `CREDENTIAL_KEYS`.
 *
 * **Retention is this module's job, not a second schedule's.** A ledger that
 * can only be stopped from growing by another job is the same unbounded-growth
 * bug the jobs exist to fix, one level up. `prune` runs at the end of every
 * run of the job it is pruning, in bounded batches.
 */

export interface JobRunView {
  id: string;
  jobName: string;
  instanceId: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  outcome: 'running' | 'succeeded' | 'failed' | 'abandoned';
  affected: number;
  detail: Record<string, unknown> | null;
  error: string | null;
}

/** How many runs of one job are kept before the oldest are dropped. */
export const RETAIN_RUNS_PER_JOB = 200;

/** And how long, regardless of count. A quiet job should not keep January. */
export const RETAIN_RUNS_FOR_MS = 30 * 24 * 60 * 60 * 1000;

const PRUNE_BATCH = 200;

const MAX_ERROR_CHARS = 500;

/**
 * Key names `redactDeep` does not cover, and this sink has to.
 *
 * `@correnthian/security` redacts under
 * `/seed|mnemonic|privatekey|secret|password|passphrase/i`. That is the right
 * denylist for a log line, and `packages/security` is not this module's to
 * extend. But `JobRun.detail` is a **persisted, free-form** field that jobs
 * fill with provider and chain state, and the names that show up there —
 * `apiKey`, `token`, `authorization` — match none of those patterns. A rule
 * that a job must never store key material is only as strong as the one sink
 * that can hold it, so the sink adds the names it actually sees.
 *
 * This is applied *after* `redactDeep`, never instead of it, so the
 * seed-phrase and key-material patterns stay the security package's to define
 * and this list cannot quietly replace them.
 */
const CREDENTIAL_KEYS =
  /api[-_]?key|access[-_]?token|auth[-_]?token|authorization|credential|bearer|cookie|passphrase/i;

function redactJobDetail<T>(value: T): T {
  return stripCredentialKeys(redactDeep(value));
}

function stripCredentialKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripCredentialKeys(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = CREDENTIAL_KEYS.test(k) ? '[REDACTED]' : stripCredentialKeys(v);
    }
    return out as T;
  }
  return value;
}

export function toJobRunView(row: JobRun): JobRunView {
  return {
    id: row.id,
    jobName: row.jobName,
    instanceId: row.instanceId,
    trigger: row.trigger,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    durationMs: row.durationMs,
    outcome: row.outcome,
    affected: row.affected,
    detail: (row.detail as Record<string, unknown> | null) ?? null,
    error: row.error,
  };
}

@Injectable()
export class JobRunStore {
  private readonly logger = new Logger(JobRunStore.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Open a run, and close out anything an earlier instance left open.
   *
   * Call this only while holding the job's lease — the abandonment sweep
   * below is unconditional, and it is only safe because of that.
   */
  async begin(params: {
    jobName: string;
    instanceId: string;
    trigger: JobTrigger;
    now: Date;
  }): Promise<JobRunView> {
    const abandoned = await this.prisma.jobRun.updateMany({
      where: { jobName: params.jobName, outcome: 'running' },
      data: {
        outcome: 'abandoned',
        finishedAt: params.now,
        error: 'The instance running this job stopped before it finished. Its effects are re-runnable.',
      },
    });
    if (abandoned.count > 0) {
      this.logger.warn(
        `Marked ${abandoned.count} abandoned run(s) of ${params.jobName}: the instance holding ` +
          `the lease died mid-run. The next run is safe to overlap nothing, because nothing is running.`,
      );
    }

    const row = await this.prisma.jobRun.create({
      data: {
        jobName: params.jobName,
        instanceId: params.instanceId,
        trigger: params.trigger,
        startedAt: params.now,
      },
    });
    return toJobRunView(row);
  }

  async finish(params: {
    id: string;
    startedAt: Date;
    outcome: 'succeeded' | 'failed';
    affected: number;
    finishedAt: Date;
    detail?: Record<string, unknown>;
    error?: string | null;
  }): Promise<JobRunView> {
    const row = await this.prisma.jobRun.update({
      where: { id: params.id },
      data: {
        outcome: params.outcome,
        affected: params.affected,
        finishedAt: params.finishedAt,
        // Taken from the injected clock, not from `Date.now()` here, so a run
        // driven by a test clock reports the duration the test set up rather
        // than a real elapsed time the test cannot predict.
        durationMs: Math.max(0, params.finishedAt.getTime() - params.startedAt.getTime()),
        detail: params.detail
          ? (redactJobDetail(params.detail) as Prisma.InputJsonValue)
          : undefined,
        error: params.error ? redactDeep(params.error).slice(0, MAX_ERROR_CHARS) : null,
      },
    });
    return toJobRunView(row);
  }

  async latestFor(jobName: string): Promise<JobRunView | null> {
    const row = await this.prisma.jobRun.findFirst({
      where: { jobName },
      orderBy: { startedAt: 'desc' },
    });
    return row ? toJobRunView(row) : null;
  }

  async history(jobName: string, limit: number): Promise<JobRunView[]> {
    const rows = await this.prisma.jobRun.findMany({
      where: { jobName },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map(toJobRunView);
  }

  /**
   * Drop runs this job no longer needs to remember.
   *
   * Two bounds, and the stricter of the two wins: the newest
   * `RETAIN_RUNS_PER_JOB`, and anything older than `RETAIN_RUNS_FOR_MS`. Count
   * alone would let a job that runs once a minute keep 40 000 rows; age alone
   * would let a healthy high-frequency job keep a fortnight of history it
   * never reads. Taking the *later* of the two cutoffs instead would mean
   * whichever bound is more generous always wins, and the other one is
   * decoration — the count bound in particular could never fire while the job
   * had fewer than `RETAIN_RUNS_FOR_MS` worth of runs, which is most of the
   * time.
   *
   * So the cutoff is the **later** timestamp of "the oldest run we are
   * keeping" and "the oldest age we tolerate", and everything strictly before
   * it goes.
   *
   * Bounded batches, and it never deletes the row it was just called about —
   * `keep` is at least 1, and the caller passes a run that was written moments
   * ago.
   */
  async prune(params: {
    jobName: string;
    now: Date;
    keep?: number;
    olderThanMs?: number;
  }): Promise<number> {
    const keep = Math.max(params.keep ?? RETAIN_RUNS_PER_JOB, 2);
    const olderThanMs = params.olderThanMs ?? RETAIN_RUNS_FOR_MS;

    // The start of the run that is one past the ones we are keeping. Anything
    // strictly older than this is out on count.
    const boundary = await this.prisma.jobRun.findMany({
      where: { jobName: params.jobName },
      orderBy: { startedAt: 'desc' },
      skip: keep - 1,
      take: 1,
      select: { startedAt: true },
    });
    const byCount = boundary.at(0)?.startedAt ?? null;
    const byAge = new Date(params.now.getTime() - olderThanMs);
    // The later of the two, so both bounds actually bind. See above.
    const cutoff = byCount && byCount > byAge ? byCount : byAge;

    let deleted = 0;
    for (;;) {
      const doomed = await this.prisma.jobRun.findMany({
        where: { jobName: params.jobName, startedAt: { lt: cutoff } },
        orderBy: { startedAt: 'asc' },
        take: PRUNE_BATCH,
        select: { id: true },
      });
      if (doomed.length === 0) break;
      const { count } = await this.prisma.jobRun.deleteMany({
        // The `startedAt` guard is repeated here for the same reason the
        // idempotency purge repeats it: between the read and the delete a row
        // could have been written that is not the row we selected.
        where: { id: { in: doomed.map((r) => r.id) }, startedAt: { lt: cutoff } },
      });
      deleted += count;
      if (count === 0) break;
    }
    return deleted;
  }
}
