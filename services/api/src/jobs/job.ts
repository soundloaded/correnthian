/**
 * What a scheduled job is — §7.
 *
 * A job is a named, interval-driven, re-runnable sweep. Three properties are
 * part of the contract rather than a convention, because each of them is a
 * thing that silently goes wrong otherwise:
 *
 * **It takes its `now` from the caller.** A job never reads the wall clock to
 * decide what to act on, so the same call against the same rows produces the
 * same answer, and a test can put a quote one second past its expiry without
 * waiting a second.
 *
 * **It is re-runnable.** Every job's mutation is guarded by the predicate it
 * selected on — `state = 'quoted' AND expiresAt < now`, `expiresAt < now`, and
 * so on — so a run that died half way through, or a second run that overlaps
 * the first because a lease was lost, changes nothing the first run did not
 * already change. This is why losing the lock is survivable: the worst case
 * is duplicated work, not a duplicated effect.
 *
 * **It is bounded.** `signal` is aborted when the run passes its budget, and
 * `deadline` says when that will happen. A job that ignored both would hold a
 * database connection and a lease indefinitely, which is how a slow job
 * becomes an outage.
 */

export interface JobContext {
  /**
   * The instant the run is anchored to. Every selection a job makes is
   * relative to this, never to `new Date()`.
   */
  readonly now: Date;
  /** When `signal` will abort. Derived from the job's own `timeoutMs`. */
  readonly deadline: Date;
  /** Aborted at `deadline`, or on shutdown. */
  readonly signal: AbortSignal;
  /** `manual` when an operator triggered this run. */
  readonly trigger: JobTrigger;
}

export type JobTrigger = 'schedule' | 'manual';

export interface JobOutcome {
  /**
   * Rows this run acted on: deleted, transitioned, or — for a job whose job is
   * observation rather than mutation — flagged.
   *
   * A `0` is a real answer and is worth reading: a job reporting success and
   * zero forever is a job running and useless, usually because a filter has
   * quietly stopped matching.
   */
  affected: number;
  /**
   * Job-specific detail for the run record. Must be small and must not
   * contain anything derived from a credential — the store redacts it, and
   * redaction is a second line of defence rather than a licence.
   */
  detail?: Record<string, unknown>;
}

export interface ScheduledJob {
  /**
   * Stable identity, `<area>.<verb>`. It keys the lease, the run history and
   * the operator's view, so renaming one orphans its history.
   */
  readonly name: string;
  /** How often the schedule should run it. Measured start to start. */
  readonly everyMs: number;
  /**
   * The run's own budget. The lock leases for longer than this so a job that
   * hits its deadline still holds the lease while it unwinds.
   */
  readonly timeoutMs: number;
  /** One line for the operations view. What it does, not how. */
  readonly description: string;
  run(ctx: JobContext): Promise<JobOutcome>;
}

/** The registry token. The scheduler takes the list, not each job. */
export const JOBS = 'correnthian:jobs';
