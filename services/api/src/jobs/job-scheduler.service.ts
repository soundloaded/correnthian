import { hostname } from 'node:os';
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { redactDeep } from '@correnthian/security';
import { AppError } from '../common/errors.js';
import { CLOCK, type Clock } from './clock.js';
import { JobLockService, type JobLease } from './job-lock.service.js';
import { JobRunStore, type JobRunView } from './job-run.store.js';
import { JOBS, type JobTrigger, type ScheduledJob } from './job.js';

/**
 * The scheduler — §7.
 *
 * ## Where the schedule lives, and why not here
 *
 * Every instance runs this loop. The loop does **not** decide that a job runs;
 * it decides that a job is *due*, and then asks `JobLockService` for the job's
 * lease. One instance gets it. The others find out they did not, and go back
 * to sleep. So the schedule is not a property of any process — it is a
 * property of the job's Redis key, which is the only thing every replica can
 * see, and adding a replica adds a candidate rather than a duplicate runner.
 *
 * The naive alternative is a `setInterval` that just calls the job, and it is
 * wrong the moment there are two replicas: both fire, both sweep, and the
 * second one is invisible because nothing in the system notices that two
 * processes did the same work.
 *
 * ## What happens when the instance holding the lease dies
 *
 * It stops renewing, the key expires, and the next tick — on any instance —
 * takes it. No failure detector, no heartbeat table, no operator action. The
 * run it left open is `abandoned` in the ledger, written by whoever picks the
 * job up next, because a dead process cannot write its own.
 *
 * ## Overlap, at three levels
 *
 *   1. **Within a process** — a job already in flight is skipped, and the skip
 *      is counted. This is checked before the lease, so a slow job does not
 *      burn a Redis round trip per tick.
 *   2. **Between processes** — the lease. Only the holder runs.
 *   3. **Still between processes, when the lease is lost** — a run that
 *      outlives its TTL can overlap the next instance's run. Nothing prevents
 *      that, and nothing needs to: every job's mutation is guarded by the
 *      predicate it selected on, so the second run re-derives the same answer
 *      and changes nothing. The lease is a cost control, not a correctness
 *      control, and the jobs are written on that basis.
 *
 * A job whose run exceeds `everyMs` therefore does not stack. It runs, then
 * the next tick after it finishes may run it again — which is a later run, not
 * a concurrent one.
 *
 * ## The clock
 *
 * `clock.now()` decides whether a job is due and what `now` the run is
 * anchored to. Nothing here calls `Date.now()` for a decision. `setTimeout` is
 * used for exactly one thing — aborting a run that has exceeded its budget —
 * and that is a supervisor's safety bound rather than a decision about data,
 * so a test never observes it.
 */

const DEFAULT_TICK_MS = 15_000;

/**
 * A job is `overdue` once it has gone this many intervals without starting.
 *
 * Three rather than two: one missed interval is a tick landing late, two is a
 * slow run, and three consecutive misses means the loop is not keeping up or
 * the job is not being granted its lease. Below three the signal fires on
 * ordinary jitter and an operator learns to ignore it.
 */
const OVERDUE_INTERVALS = 3;

/** The lease outlives the run's own budget, so a job unwinds while still owning it. */
const LEASE_GRACE_MS = 60_000;

export type JobHealth = 'ok' | 'running' | 'failing' | 'overdue' | 'never_run' | 'disabled';

export interface SchedulerStatus {
  scheduler: {
    running: boolean;
    instanceId: string;
    tickMs: number;
    lastTickAt: string | null;
    lastLeaseError: string | null;
  };
  jobs: Array<{
    name: string;
    description: string;
    everyMs: number;
    timeoutMs: number;
    health: JobHealth;
    runningNow: boolean;
    overlapsSkipped: number;
    lastRun: JobRunView | null;
    recentRuns: JobRunView[];
  }>;
}

type TriggerResult =
  | { kind: 'ran'; run: JobRunView }
  | { kind: 'busy'; reason: string };

@Injectable()
export class JobScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobScheduler.name);
  private readonly instanceId = `${hostname()}:${process.pid}`;
  private readonly inFlight = new Map<string, { startedAt: Date; trigger: JobTrigger }>();
  /** Start time of the last run, per job. Note: start, not finish — see `tick`. */
  private readonly lastStartedAt = new Map<string, number>();
  private readonly overlaps = new Map<string, number>();

  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private lastTickAt: string | null = null;
  private lastLeaseError: string | null = null;

  constructor(
    @Inject(JOBS) private readonly jobs: readonly ScheduledJob[],
    @Inject(JobLockService) private readonly locks: JobLockService,
    @Inject(JobRunStore) private readonly runs: JobRunStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Whether this process runs the schedule at all.
   *
   * A test boot is not a deployment. The suites in this repository boot the
   * real module graph against a real database, so a background sweep firing
   * mid-suite would make their results depend on when a timer happened to
   * land — which is the one thing these tests are not allowed to do. Vitest
   * marks itself in the environment, and `NODE_ENV=test` is honoured for any
   * other runner.
   *
   * `JOBS_ENABLED=false` turns the loop off in a deployment — a process whose
   * only job is to serve requests, or a debugging session where a sweep would
   * be unhelpful. `JOBS_ENABLED=true` overrides the test-runner check, for the
   * integration test that deliberately wants the loop.
   *
   * Read from `process.env` rather than through `ConfigService`, following the
   * precedent `LOG_LEVEL` sets in `app.module.ts`: whether a scheduler is
   * running is a property of the process, not of the domain configuration, and
   * `packages/config` is not this module's to extend.
   */
  private static resolveEnabled(): boolean {
    const declared = process.env['JOBS_ENABLED'];
    if (declared === 'true' || declared === '1') return true;
    if (declared === 'false' || declared === '0') return false;
    return process.env['NODE_ENV'] !== 'test' && !process.env['VITEST'];
  }

  get enabled(): boolean {
    return JobScheduler.resolveEnabled();
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  /**
   * Seed "when did this job last start" from the ledger before the first tick.
   *
   * Without it, every restart re-runs every job immediately — and during a
   * rolling deploy of N replicas that is N rounds of catch-up work for jobs
   * that were running normally a minute earlier. The ledger already knows the
   * answer; asking it costs one indexed query per job at boot.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.log(
        'Scheduled jobs are disabled in this process (JOBS_ENABLED / NODE_ENV / test runner). ' +
          'No job will run here, and job health will report the schedule as stopped.',
      );
      return;
    }
    for (const job of this.jobs) {
      const latest = await this.runs.latestFor(job.name);
      if (latest) this.lastStartedAt.set(job.name, new Date(latest.startedAt).getTime());
    }
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  /** Idempotent: a second call is a no-op rather than a second loop. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), DEFAULT_TICK_MS);
    // Not unref'd. The HTTP server keeps the process alive in an API
    // deployment, but a process that exists *only* to run the schedule should
    // not exit the moment it finishes booting.
    this.logger.log(
      `Scheduler started on ${this.instanceId}: ${this.jobs.length} job(s), tick ${DEFAULT_TICK_MS}ms`,
    );
  }

  /**
   * Stop dispatching.
   *
   * It does not wait for jobs in flight, and it deliberately does not try: a
   * shutdown that blocks on a sweep turns a rolling deploy into a hang. A run
   * that is interrupted is recorded as `abandoned` by whichever instance picks
   * the job up next, which is the designed path and the reason it exists.
   */
  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    if (this.inFlight.size > 0) {
      this.logger.warn(
        `Scheduler stopped with ${this.inFlight.size} job(s) still running ` +
          `(${[...this.inFlight.keys()].join(', ')}). They will be recorded as abandoned.`,
      );
    } else {
      this.logger.log('Scheduler stopped');
    }
  }

  /**
   * One pass over the registry.
   *
   * Jobs are dispatched, not awaited. Awaiting them would mean one slow job
   * delays every other job by its own runtime, which turns a job that is
   * taking too long into a scheduler that has stopped — the precise failure
   * this module exists to make visible would hide itself.
   *
   * The pass is guarded by `ticking`, so a tick that takes a while is not
   * re-entered by the next interval: the same rule the jobs get, applied to
   * the thing that starts them.
   */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = this.clock.now();
      this.lastTickAt = now.toISOString();

      for (const job of this.jobs) {
        if (this.inFlight.has(job.name)) {
          this.overlaps.set(job.name, (this.overlaps.get(job.name) ?? 0) + 1);
          continue;
        }
        // Measured from the last *start*, not the last finish. An interval is
        // a cadence, not a cooldown: a job that took 20s of a 60s interval
        // should start 40s after it finished, not 60.
        const last = this.lastStartedAt.get(job.name);
        if (last !== undefined && now.getTime() - last < job.everyMs) continue;

        // `inFlight` is set synchronously inside `runJob`, before its first
        // await, so the guard above cannot miss a job that was dispatched a
        // microsecond ago and has not yet got as far as taking its lease.
        void this.runJob(job, 'schedule').catch((err: unknown) => {
          // `runJob` records its own failures; reaching here means the
          // bookkeeping failed too — a database that will not take a run
          // record. It cannot be swallowed, and it must not become an
          // unhandled rejection that takes the process down with it.
          this.logger.error(
            `Could not record the outcome of ${job.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }
    } finally {
      this.ticking = false;
    }
  }

  /** The operator's "run it now". Goes through the same lease as the schedule. */
  async runNow(name: string): Promise<JobRunView> {
    const job = this.jobs.find((j) => j.name === name);
    if (!job) throw AppError.notFound(`No scheduled job named "${name}"`);
    if (this.inFlight.has(name)) {
      throw AppError.conflict(`"${name}" is already running on this instance.`);
    }

    const result = await this.runJob(job, 'manual');
    if (result.kind === 'busy') throw AppError.conflict(result.reason);
    return result.run;
  }

  /**
   * Run one job, under its lease, with its budget, recorded.
   *
   * The order matters: mark it in flight, take the lease, open the run,
   * execute, close the run, release. Opening the run last would let a crash
   * between the two leave a job running with nothing recording it; releasing
   * the lease last would let the next instance start while this one is still
   * writing its result, which is how a run ends up with two authors.
   */
  private async runJob(job: ScheduledJob, trigger: JobTrigger): Promise<TriggerResult> {
    const startedAt = this.clock.now();
    this.lastStartedAt.set(job.name, startedAt.getTime());
    this.inFlight.set(job.name, { startedAt, trigger });

    try {
      const leaseTtl = job.timeoutMs + LEASE_GRACE_MS;

      let lease: JobLease | null;
      try {
        lease = await this.locks.acquire(job.name, leaseTtl);
        this.lastLeaseError = null;
      } catch (err) {
        this.lastLeaseError = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Could not acquire the lease for ${job.name}: ${this.lastLeaseError}`);
        return { kind: 'busy', reason: `The lease for "${job.name}" could not be checked.` };
      }
      if (!lease) {
        return {
          kind: 'busy',
          reason: `"${job.name}" is already running, on this instance or another.`,
        };
      }

      const controller = new AbortController();
      const guard = setTimeout(() => controller.abort(), job.timeoutMs);
      // A renewal that cannot keep up is a lost lease, not a failed job: the
      // job keeps running (its effects are re-runnable) and the loss is
      // logged, because it is the operator's cue that the schedule is
      // under pressure.
      const renew = setInterval(() => {
        void lease
          .extend(leaseTtl)
          .then((held) => {
            if (!held) {
              this.logger.warn(
                `Lost the lease for ${job.name} while it was still running. The next instance may ` +
                  'start it too; this run\'s effects are re-runnable, so the overlap is waste ' +
                  'rather than damage.',
              );
            }
          })
          .catch(() => undefined);
      }, Math.max(Math.floor(leaseTtl / 3), 1_000));
      // Neither timer should hold the process open on its own. Optional-call
      // on both, so a harness that substitutes its own timers — which is how
      // the renewal is tested — is not a hard failure.
      guard.unref?.();
      renew.unref?.();

      // `begin` is inside this `try`, not before it. The renewal interval
      // above re-extends the lease on its own, so a throw from the ledger
      // between taking the lease and entering the old `try` would leave this
      // process renewing a job's lock indefinitely — the job stops running
      // anywhere, and nothing says why. The `finally` has to cover every line
      // after the lease is held.
      let run: JobRunView | null = null;
      try {
        run = await this.runs.begin({
          jobName: job.name,
          instanceId: this.instanceId,
          trigger,
          now: startedAt,
        });
        const outcome = await job.run({
          now: startedAt,
          deadline: new Date(startedAt.getTime() + job.timeoutMs),
          signal: controller.signal,
          trigger,
        });
        const settled = await this.runs.finish({
          id: run.id,
          startedAt,
          outcome: 'succeeded',
          affected: outcome.affected,
          finishedAt: this.clock.now(),
          detail: outcome.detail,
        });
        this.logger.log(
          `${job.name} ${trigger} run finished: affected ${settled.affected} in ${settled.durationMs}ms`,
        );
        return { kind: 'ran', run: settled };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (!run) {
          // The ledger would not even open the run, so the job never executed
          // and there is no outcome to record. Say so and let it out: the
          // `finally` below has already been guaranteed the lease and its
          // renewal, which is the whole reason `begin` sits inside the `try`.
          this.logger.error(
            `Could not open a run record for ${job.name}; the job did not run: ${redactDeep(message)}`,
          );
          throw err;
        }

        const settled = await this.runs.finish({
          id: run.id,
          startedAt,
          outcome: 'failed',
          affected: 0,
          finishedAt: this.clock.now(),
          error: message,
        });
        // Loudly. A job that fails silently is worse than one that fails
        // loudly: the failure's whole cost is that nobody noticed it for three
        // weeks.
        this.logger.error(
          `${job.name} ${trigger} run failed: ${redactDeep(message)} — recorded as ${settled.id}`,
        );
        return { kind: 'ran', run: settled };
      } finally {
        clearTimeout(guard);
        clearInterval(renew);
        try {
          await lease.release();
        } catch {
          // The lease expires on its own; failing to drop it costs at most
          // one skipped interval.
        }
        try {
          await this.runs.prune({ jobName: job.name, now: this.clock.now() });
        } catch (err) {
          // Retention is housekeeping. Losing a prune must never turn a
          // successful sweep into a failed one.
          this.logger.warn(
            `Could not prune the run history for ${job.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } finally {
      this.inFlight.delete(job.name);
    }
  }

  /** What the operations view reports. Reads only; starts nothing. */
  async status(): Promise<SchedulerStatus> {
    const now = this.clock.now();
    const running = this.isRunning;

    const jobs = [];
    for (const job of this.jobs) {
      const lastRun = await this.runs.latestFor(job.name);
      const recentRuns = await this.runs.history(job.name, 10);
      jobs.push({
        name: job.name,
        description: job.description,
        everyMs: job.everyMs,
        timeoutMs: job.timeoutMs,
        health: this.verdict(job, lastRun, now, running),
        runningNow: this.inFlight.has(job.name),
        overlapsSkipped: this.overlaps.get(job.name) ?? 0,
        lastRun,
        recentRuns,
      });
    }

    return {
      scheduler: {
        running,
        instanceId: this.instanceId,
        tickMs: DEFAULT_TICK_MS,
        lastTickAt: this.lastTickAt,
        lastLeaseError: this.lastLeaseError,
      },
      jobs,
    };
  }

  /**
   * The verdict an operator reads first.
   *
   * `failing` before `overdue` because a job that fails loudly every interval
   * is not also late — it is running, and the answer is in `lastRun.error`.
   * `disabled` is separate from `never_run` deliberately: the first means this
   * process is not scheduling, the second means it is and the job has not run.
   */
  private verdict(
    job: ScheduledJob,
    lastRun: JobRunView | null,
    now: Date,
    schedulerRunning: boolean,
  ): JobHealth {
    if (!schedulerRunning) return 'disabled';
    if (this.inFlight.has(job.name)) return 'running';
    if (!lastRun) return 'never_run';
    if (lastRun.outcome === 'failed') return 'failing';
    const since = now.getTime() - new Date(lastRun.startedAt).getTime();
    if (since > job.everyMs * OVERDUE_INTERVALS) return 'overdue';
    return 'ok';
  }
}
