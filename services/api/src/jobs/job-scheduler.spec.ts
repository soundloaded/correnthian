import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clock } from './clock.js';
import { JobLockService, type JobLease } from './job-lock.service.js';
import { JobRunStore, type JobRunView } from './job-run.store.js';
import { JobScheduler } from './job-scheduler.service.js';
import type { JobContext, JobOutcome, ScheduledJob } from './job.js';

/**
 * The scheduler, driven by a clock it moves by hand.
 *
 * Nothing here sleeps and nothing here waits for a real interval. Every
 * "did this happen within the next two minutes" question is answered by
 * calling `advance()`, so a test that passes did so because the scheduler made
 * the right decision at the right point on the timeline — not because the
 * machine was fast enough.
 *
 * The fakes are behavioural rather than `vi.fn().mockResolvedValue(...)`
 * wherever a stub could not fail. In particular the lock fake really does
 * refuse a second holder, because "only one instance runs a job" is the whole
 * property and a stub that always returns a lease would test nothing.
 */

class FakeClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current.getTime());
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

class FakeLocks {
  readonly held = new Set<string>();
  readonly attempts: string[] = [];
  /** Every renewal. A renewal that outlives its run is a lease held forever. */
  extendCalls = 0;
  /** Set to make `acquire` throw, the way an unreachable Redis does. */
  down = false;

  asService(): JobLockService {
    return this as unknown as JobLockService;
  }

  async acquire(jobName: string, _ttlMs: number): Promise<JobLease | null> {
    this.attempts.push(jobName);
    if (this.down) throw new Error('redis is unreachable');
    if (this.held.has(jobName)) return null;
    this.held.add(jobName);
    const self = this;
    return {
      token: `token-${jobName}`,
      extend: async () => {
        self.extendCalls += 1;
        return true;
      },
      release: async () => {
        self.held.delete(jobName);
      },
    };
  }
}

interface FakeRun extends JobRunView {}

class FakeRunStore {
  readonly runs: FakeRun[] = [];
  readonly pruned: string[] = [];
  /** Set to make `begin` throw, the way a database that will not take a row does. */
  failBeginWith: string | null = null;
  private nextId = 1;

  asStore(): JobRunStore {
    return this as unknown as JobRunStore;
  }

  async begin(params: {
    jobName: string;
    instanceId: string;
    trigger: string;
    now: Date;
  }): Promise<FakeRun> {
    const run: FakeRun = {
      id: `run-${this.nextId++}`,
      jobName: params.jobName,
      instanceId: params.instanceId,
      trigger: params.trigger,
      startedAt: params.now.toISOString(),
      finishedAt: null,
      durationMs: null,
      outcome: 'running',
      affected: 0,
      detail: null,
      error: null,
    };
    this.runs.push(run);
    return run;
  }

  async finish(params: {
    id: string;
    startedAt: Date;
    outcome: 'succeeded' | 'failed';
    affected: number;
    finishedAt: Date;
    detail?: Record<string, unknown>;
    error?: string | null;
  }): Promise<FakeRun> {
    const run = this.runs.find((r) => r.id === params.id);
    if (!run) throw new Error(`No fake run ${params.id}`);
    run.outcome = params.outcome;
    run.affected = params.affected;
    run.finishedAt = params.finishedAt.toISOString();
    run.durationMs = params.finishedAt.getTime() - params.startedAt.getTime();
    run.detail = params.detail ?? null;
    run.error = params.error ?? null;
    return run;
  }

  async latestFor(jobName: string): Promise<FakeRun | null> {
    const of = this.runs.filter((r) => r.jobName === jobName);
    return of.at(-1) ?? null;
  }

  async history(jobName: string, limit: number): Promise<FakeRun[]> {
    return this.runs.filter((r) => r.jobName === jobName).slice(-limit).reverse();
  }

  async prune(params: { jobName: string }): Promise<number> {
    this.pruned.push(params.jobName);
    return 0;
  }
}

/**
 * A job the test drives.
 *
 * `gate` holds the run open until the test lets it go, which is how a "this
 * job is taking longer than its interval" scenario is produced without a
 * millisecond of real waiting.
 */
class TestJob implements ScheduledJob {
  runs = 0;
  readonly seen: JobContext[] = [];
  private gate: Promise<void> | null = null;
  private openGate: (() => void) | null = null;

  constructor(
    readonly name: string,
    readonly everyMs: number,
    readonly timeoutMs = 30_000,
  ) {}

  // A getter, not a field: a field initialiser runs before parameter
  // properties are assigned, so `this.name` would read undefined there.
  get description(): string {
    return `test job ${this.name}`;
  }

  block(): void {
    this.gate = new Promise<void>((resolve) => {
      this.openGate = resolve;
    });
  }

  release(): void {
    this.openGate?.();
    this.gate = null;
  }

  failNextWith(message: string): void {
    this.toThrow = message;
  }

  private toThrow: string | null = null;

  async run(ctx: JobContext): Promise<JobOutcome> {
    this.runs += 1;
    this.seen.push(ctx);
    if (this.gate) await this.gate;
    if (this.toThrow) {
      const message = this.toThrow;
      this.toThrow = null;
      throw new Error(message);
    }
    return { affected: 1, detail: { attempt: this.runs } };
  }
}

describe('JobScheduler', () => {
  let clock: FakeClock;
  let locks: FakeLocks;
  let store: FakeRunStore;
  const schedulers: JobScheduler[] = [];

  const build = (...jobs: ScheduledJob[]): JobScheduler => {
    const scheduler = new JobScheduler(
      jobs,
      locks.asService(),
      store.asStore(),
      clock,
    );
    schedulers.push(scheduler);
    return scheduler;
  };

  beforeEach(() => {
    clock = new FakeClock(new Date('2026-10-06T09:00:00.000Z'));
    locks = new FakeLocks();
    store = new FakeRunStore();
  });

  afterEach(() => {
    for (const s of schedulers.splice(0)) s.stop();
  });

  it('runs a job on its first tick', async () => {
    const job = new TestJob('test.one', 60_000);
    const scheduler = build(job);

    await scheduler.tick();
    await flush();

    expect(job.runs).toBe(1);
    expect(job.seen[0]?.trigger).toBe('schedule');
    // The run is anchored to the injected clock, not to the wall clock.
    expect(job.seen[0]?.now.toISOString()).toBe('2026-10-06T09:00:00.000Z');
    expect(job.seen[0]?.deadline.toISOString()).toBe('2026-10-06T09:00:30.000Z');
  });

  it('does not run a job again before its interval has elapsed', async () => {
    const job = new TestJob('test.one', 60_000);
    const scheduler = build(job);

    await scheduler.tick();
    await flush();

    clock.advance(59_000);
    await scheduler.tick();
    await flush();
    expect(job.runs).toBe(1);

    // Measured start to start, so one second past the interval is enough.
    clock.advance(1_000);
    await scheduler.tick();
    await flush();
    expect(job.runs).toBe(2);
  });

  it('does not stack a job that is still running when the next tick arrives', async () => {
    const job = new TestJob('test.one', 1_000);
    const scheduler = build(job);
    job.block();

    await scheduler.tick();
    await flush();
    expect(job.runs).toBe(1);

    clock.advance(5_000);
    await scheduler.tick();
    await flush();

    // Five intervals elapsed and the job is still in flight. It must not have
    // been started again — that is the whole of "a job that takes longer than
    // its interval must not stack".
    expect(job.runs).toBe(1);
    expect((await scheduler.status()).jobs[0]?.overlapsSkipped).toBeGreaterThan(0);

    job.release();
    await flush();

    // And once it has finished, the schedule resumes rather than treating the
    // skipped ticks as a debt to repay.
    await scheduler.tick();
    await flush();
    expect(job.runs).toBe(2);
  });

  it('records every run, with the instance that ran it', async () => {
    const job = new TestJob('test.one', 60_000);
    const scheduler = build(job);

    await scheduler.tick();
    await flush();

    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]?.jobName).toBe('test.one');
    // Read through the operator view rather than a private field: the value
    // an operator sees is the one worth pinning.
    const status = await scheduler.status();
    expect(store.runs[0]?.instanceId).toBe(status.scheduler.instanceId);
    expect(store.runs[0]?.outcome).toBe('succeeded');
    expect(store.runs[0]?.affected).toBe(1);
    expect(store.runs[0]?.detail).toEqual({ attempt: 1 });
    // Pruned on the way out, so the ledger that records jobs is itself bounded.
    expect(store.pruned).toEqual(['test.one']);
  });

  it('records a failing job as failed, and carries on with the next one', async () => {
    const first = new TestJob('test.broken', 60_000);
    const second = new TestJob('test.working', 60_000);
    first.failNextWith('the sweep exploded');
    const scheduler = build(first, second);

    await scheduler.tick();
    await flush();

    const failed = store.runs.find((r) => r.jobName === 'test.broken');
    expect(failed?.outcome).toBe('failed');
    expect(failed?.error).toBe('the sweep exploded');
    expect(failed?.affected).toBe(0);

    // One job's failure must not abandon the rest of the tick.
    expect(second.runs).toBe(1);
  });

  it('does not run a job another instance holds, and says so', async () => {
    const job = new TestJob('test.one', 60_000);
    const scheduler = build(job);

    // Another instance took the lease first.
    locks.held.add('test.one');

    await scheduler.tick();
    await flush();

    expect(job.runs).toBe(0);
    // No run record: nothing happened, and claiming otherwise in the ledger
    // would be a lie an operator would act on.
    expect(store.runs).toHaveLength(0);
  });

  it('refuses to run when the lease cannot be checked at all', async () => {
    const job = new TestJob('test.one', 60_000);
    const scheduler = build(job);
    locks.down = true;

    await scheduler.tick();
    await flush();

    // "I could not check whether anyone is running this" is not evidence that
    // nobody is. Failing open here would run every job on every replica at
    // once, which is the failure the lock exists to prevent.
    expect(job.runs).toBe(0);

    const status = await scheduler.status();
    expect(status.scheduler.lastLeaseError).toContain('redis is unreachable');
  });

  it('releases the lease when a run finishes, so the next interval can take it', async () => {
    const job = new TestJob('test.one', 60_000);
    const scheduler = build(job);

    await scheduler.tick();
    await flush();

    expect(locks.held.has('test.one')).toBe(false);

    clock.advance(61_000);
    await scheduler.tick();
    await flush();
    expect(job.runs).toBe(2);
  });

  it('will not re-enter a tick that is still dispatching', async () => {
    const job = new TestJob('test.one', 60_000);
    const scheduler = build(job);

    const first = scheduler.tick();
    const second = scheduler.tick();
    await Promise.all([first, second]);
    await flush();

    // Two ticks in the same instant, one run. The overlap guard is about a
    // slow run; this is about a slow *tick*, which the lease alone would not
    // have caught if the two ticks raced on `lastStartedAt`.
    expect(job.runs).toBe(1);
  });

  describe('health', () => {
    it('reports never_run before anything has run', async () => {
      const scheduler = build(new TestJob('test.one', 60_000));
      scheduler.start();

      const status = await scheduler.status();
      expect(status.jobs[0]?.health).toBe('never_run');
      expect(status.jobs[0]?.lastRun).toBeNull();
      expect(status.scheduler.running).toBe(true);
    });

    it('reports ok once a run has happened inside the interval', async () => {
      const job = new TestJob('test.one', 60_000);
      const scheduler = build(job);
      scheduler.start();

      await scheduler.tick();
      await flush();

      const status = await scheduler.status();
      expect(status.jobs[0]?.health).toBe('ok');
      expect(status.jobs[0]?.lastRun?.outcome).toBe('succeeded');
      expect(status.jobs[0]?.recentRuns).toHaveLength(1);
    });

    it('reports failing when the last run failed', async () => {
      const job = new TestJob('test.one', 60_000);
      job.failNextWith('nope');
      const scheduler = build(job);
      scheduler.start();

      await scheduler.tick();
      await flush();

      const status = await scheduler.status();
      expect(status.jobs[0]?.health).toBe('failing');
      expect(status.jobs[0]?.lastRun?.error).toBe('nope');
    });

    it('reports overdue when nothing has started within three intervals', async () => {
      const job = new TestJob('test.one', 60_000);
      const scheduler = build(job);
      scheduler.start();

      await scheduler.tick();
      await flush();
      expect((await scheduler.status()).jobs[0]?.health).toBe('ok');

      // Stop the schedule and let three intervals go by. This is exactly the
      // "it silently stopped" case, and the number an operator has to be able
      // to spot.
      scheduler.stop();
      clock.advance(3 * 60_000 + 1);
      scheduler.start();

      expect((await scheduler.status()).jobs[0]?.health).toBe('overdue');
    });

    it('says disabled rather than never_run when this process is not scheduling', async () => {
      const scheduler = build(new TestJob('test.one', 60_000));

      // `start()` was never called, so there is no loop here.
      const status = await scheduler.status();
      expect(status.scheduler.running).toBe(false);
      expect(status.jobs[0]?.health).toBe('disabled');
    });

    it('reports running while a job is in flight', async () => {
      const job = new TestJob('test.one', 60_000);
      const scheduler = build(job);
      scheduler.start();
      job.block();

      await scheduler.tick();
      await flush();

      expect((await scheduler.status()).jobs[0]?.health).toBe('running');
      expect((await scheduler.status()).jobs[0]?.runningNow).toBe(true);

      job.release();
      await flush();
    });
  });

  describe('runNow', () => {
    it('runs a job immediately and records it as a manual trigger', async () => {
      const job = new TestJob('test.one', 24 * 60 * 60_000);
      const scheduler = build(job);

      const run = await scheduler.runNow('test.one');

      expect(job.runs).toBe(1);
      expect(run.trigger).toBe('manual');
      expect(run.outcome).toBe('succeeded');
      expect(job.seen[0]?.trigger).toBe('manual');
    });

    it('refuses a name that is not in the registry', async () => {
      const scheduler = build(new TestJob('test.one', 60_000));
      await expect(scheduler.runNow('test.nonexistent')).rejects.toThrow(
        /No scheduled job named/,
      );
    });

    it('refuses to start a job that is already running on this instance', async () => {
      const job = new TestJob('test.one', 60_000);
      const scheduler = build(job);
      job.block();

      const inFlight = scheduler.tick();
      await flush();
      await expect(scheduler.runNow('test.one')).rejects.toThrow(/already running/);

      job.release();
      await inFlight;
      await flush();
    });

    it('refuses when another instance holds the lease', async () => {
      const scheduler = build(new TestJob('test.one', 60_000));
      locks.held.add('test.one');
      await expect(scheduler.runNow('test.one')).rejects.toThrow(/already running/);
    });
  });

  describe('bootstrap', () => {
    const original = process.env['JOBS_ENABLED'];

    beforeEach(() => {
      process.env['JOBS_ENABLED'] = 'true';
    });

    afterEach(() => {
      if (original === undefined) delete process.env['JOBS_ENABLED'];
      else process.env['JOBS_ENABLED'] = original;
    });

    it('seeds the schedule from the ledger so a restart does not re-run everything', async () => {
      const job = new TestJob('test.one', 60_000);
      const scheduler = build(job);

      // A previous instance ran this job half a minute ago and then the
      // process restarted. Its `startedAt` is still in the store.
      const earlier = new Date(clock.now().getTime() - 30_000);
      store.runs.push({
        id: 'run-old',
        jobName: 'test.one',
        instanceId: 'somebody-else:99',
        trigger: 'schedule',
        startedAt: earlier.toISOString(),
        finishedAt: earlier.toISOString(),
        durationMs: 12,
        outcome: 'succeeded',
        affected: 3,
        detail: null,
        error: null,
      });

      await scheduler.onApplicationBootstrap();

      // Immediately after a restart, nothing is due. Without the seeding, a
      // rolling deploy of N replicas would run every job N times over.
      await scheduler.tick();
      await flush();
      expect(job.runs).toBe(0);

      // And the schedule still works once the interval has genuinely passed.
      clock.advance(30_000);
      await scheduler.tick();
      await flush();
      expect(job.runs).toBe(1);
    });

    it('runs a job with no history on the first tick after a restart', async () => {
      const job = new TestJob('test.never', 60_000);
      const scheduler = build(job);

      await scheduler.onApplicationBootstrap();
      await scheduler.tick();
      await flush();

      expect(job.runs).toBe(1);
    });
  });
});

/**
 * Let every promise the scheduler dispatched settle.
 *
 * `tick` dispatches without awaiting — a slow job must not delay the other
 * jobs — so a test has to be explicit about when it is reading the result.
 * These fakes resolve within a handful of microtasks, so draining the
 * microtask queue is enough and no test ever waits on real time.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}
