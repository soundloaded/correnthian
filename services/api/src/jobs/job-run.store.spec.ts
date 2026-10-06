import { describe, expect, it } from 'vitest';
import {
  JobRunStore,
  RETAIN_RUNS_FOR_MS,
  RETAIN_RUNS_PER_JOB,
  type JobRunView,
} from './job-run.store.js';

/**
 * The ledger, against a store that really evaluates the guards.
 *
 * This is the half of the schedule that has to survive a Redis flush, a
 * failover and the person asking at 3am. Two of its behaviours cannot be
 * checked against a stub: that an abandoned run is closed out rather than left
 * `running`, and that retention keeps what it claims to keep. Both are below,
 * with a fake that applies `where` for real so a wrong bound fails here rather
 * than quietly growing a table in production.
 */

type Row = Record<string, unknown>;

const T0 = new Date('2026-10-06T09:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

function makeJobRunStore(initial: Row[] = []) {
  const rows = new Map(initial.map((r) => [r['id'] as string, { ...r }]));
  let nextId = 1;

  const prisma = {
    jobRun: {
      create: async ({ data }: { data: Row }) => {
        const row = {
          finishedAt: null,
          durationMs: null,
          outcome: 'running',
          affected: 0,
          detail: null,
          error: null,
          ...data,
          id: `run-${nextId++}`,
        };
        rows.set(row['id'] as string, row);
        return { ...row };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = rows.get(where.id);
        if (!row) throw new Error(`No run ${where.id}`);
        Object.assign(row, data);
        return { ...row };
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        for (const row of rows.values()) {
          if (where['jobName'] !== undefined && row['jobName'] !== where['jobName']) continue;
          if (where['outcome'] !== undefined && row['outcome'] !== where['outcome']) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
      findFirst: async ({ where }: { where: { jobName: string } }) => {
        const of = [...rows.values()]
          .filter((r) => r['jobName'] === where.jobName)
          .sort((a, b) => (b['startedAt'] as Date).getTime() - (a['startedAt'] as Date).getTime());
        return of[0] ? { ...of[0] } : null;
      },
      findMany: async (args: {
        where: { jobName: string; startedAt?: { lt: Date } };
        orderBy?: { startedAt: 'desc' | 'asc' };
        skip?: number;
        take?: number;
        select?: unknown;
      }) => {
        let out = [...rows.values()].filter((r) => r['jobName'] === args.where.jobName);
        const lt = args.where.startedAt?.lt;
        if (lt) out = out.filter((r) => (r['startedAt'] as Date) < lt);
        const dir = args.orderBy?.startedAt === 'asc' ? 1 : -1;
        out.sort((a, b) => dir * ((a['startedAt'] as Date).getTime() - (b['startedAt'] as Date).getTime()));
        if (args.skip) out = out.slice(args.skip);
        if (args.take !== undefined) out = out.slice(0, args.take);
        return out.map((r) => ({ ...r }));
      },
      deleteMany: async ({ where }: { where: { id: { in: string[] }; startedAt: { lt: Date } } }) => {
        let count = 0;
        for (const id of where.id.in) {
          const row = rows.get(id);
          // The age guard repeated on the delete, as in the idempotency purge.
          if (!row || !((row['startedAt'] as Date) < where.startedAt.lt)) continue;
          rows.delete(id);
          count += 1;
        }
        return { count };
      },
    },
  };

  return { prisma, rows };
}

const seed = (count: number, gapMs: number, jobName = 'test.job') =>
  Array.from({ length: count }, (_, i) => runRow(`r${i}`, at(-i * gapMs), jobName, { outcome: 'succeeded' }));

const runRow = (id: string, startedAt: Date, jobName = 'test.job', over: Row = {}): Row => ({
  id,
  jobName,
  instanceId: 'host:1',
  trigger: 'schedule',
  startedAt,
  finishedAt: null,
  durationMs: null,
  outcome: 'running',
  affected: 0,
  detail: null,
  error: null,
  ...over,
});

describe('JobRunStore', () => {
  describe('begin', () => {
    it('opens a run in `running`', async () => {
      const store = makeJobRunStore();
      const runs = new JobRunStore(store.prisma as never);

      const run = await runs.begin({ jobName: 'a.purge', instanceId: 'host:1', trigger: 'schedule', now: T0 });

      expect(run.outcome).toBe('running');
      expect(run.finishedAt).toBeNull();
      expect(run.jobName).toBe('a.purge');
      expect(run.instanceId).toBe('host:1');
    });

    it('closes out a run an earlier instance left open, because a dead process cannot', async () => {
      // The instance holding the lease stopped mid-run. Its row stays
      // `running` forever — the process that would have closed it is gone — so
      // the next holder writes the epitaph, and it is correct to do so
      // unconditionally because it holds the lease and nobody else is inside.
      const store = makeJobRunStore([runRow('orphan', at(-60_000), 'a.purge')]);
      const runs = new JobRunStore(store.prisma as never);

      await runs.begin({ jobName: 'a.purge', instanceId: 'host:2', trigger: 'schedule', now: T0 });

      const orphan = store.rows.get('orphan')!;
      expect(orphan['outcome']).toBe('abandoned');
      expect(orphan['finishedAt']).toEqual(T0);
      expect(String(orphan['error'])).toMatch(/stopped before it finished/i);
    });

    it('leaves another job\'s in-flight run alone', async () => {
      const store = makeJobRunStore([runRow('other', at(-60_000), 'b.other')]);
      const runs = new JobRunStore(store.prisma as never);

      await runs.begin({ jobName: 'a.purge', instanceId: 'host:2', trigger: 'schedule', now: T0 });

      expect(store.rows.get('other')!['outcome']).toBe('running');
    });
  });

  describe('finish', () => {
    it('computes the duration from the run\'s own timestamps, not the wall clock', async () => {
      const store = makeJobRunStore();
      const runs = new JobRunStore(store.prisma as never);
      const run = await runs.begin({ jobName: 'a.purge', instanceId: 'host:1', trigger: 'manual', now: T0 });

      const settled = await runs.finish({
        id: run.id,
        startedAt: T0,
        outcome: 'succeeded',
        affected: 7,
        // A test clock that moved by hand: a wall-clock implementation would
        // report ~0ms here and this assertion would be meaningless.
        finishedAt: at(4_500),
        detail: { batches: 3 },
      });

      expect(settled.durationMs).toBe(4_500);
      expect(settled.affected).toBe(7);
      expect(settled.trigger).toBe('manual');
      expect(settled.detail).toEqual({ batches: 3 });
    });

    it('redacts what a job wrote into its detail', async () => {
      // A provider error string is a payload from outside the trust boundary
      // and can carry an endpoint or a key in a query parameter. Redaction is
      // a second line of defence rather than a licence, and it is on write
      // because this is the one place a stray secret would survive on purpose.
      const store = makeJobRunStore();
      const runs = new JobRunStore(store.prisma as never);
      const run = await runs.begin({ jobName: 'a.purge', instanceId: 'host:1', trigger: 'schedule', now: T0 });

      const settled = await runs.finish({
        id: run.id,
        startedAt: T0,
        outcome: 'succeeded',
        affected: 1,
        finishedAt: T0,
        detail: {
          apiKey: 'super-secret-value',
          // `redactDeep` does not match this name — this is the extension the
          // sink adds, because a persisted operator-facing field is not a log
          // line and the names that reach it are not the ones a log line sees.
          authorization: 'Bearer live-key-material',
          nested: { password: 'hunter2', note: 'ok' },
          key: '0x' + 'ab'.repeat(32),
        },
      });

      expect(settled.detail).toEqual({
        apiKey: '[REDACTED]',
        authorization: '[REDACTED]',
        nested: { password: '[REDACTED]', note: 'ok' },
        key: expect.stringContaining('[REDACTED:HEX_KEY]'),
      });
    });

    it('truncates a failure reason so one run record is not a stack', async () => {
      const store = makeJobRunStore();
      const runs = new JobRunStore(store.prisma as never);
      const run = await runs.begin({ jobName: 'a.purge', instanceId: 'host:1', trigger: 'schedule', now: T0 });

      const settled = await runs.finish({
        id: run.id,
        startedAt: T0,
        outcome: 'failed',
        affected: 0,
        finishedAt: at(10),
        error: 'x'.repeat(5_000),
      });

      expect(settled.outcome).toBe('failed');
      expect(settled.error?.length).toBe(500);
    });

    it('never stores a run for a second time under a different outcome', async () => {
      const store = makeJobRunStore();
      const runs = new JobRunStore(store.prisma as never);
      const run = await runs.begin({ jobName: 'a.purge', instanceId: 'host:1', trigger: 'schedule', now: T0 });

      await runs.finish({ id: run.id, startedAt: T0, outcome: 'succeeded', affected: 1, finishedAt: at(1) });
      const second = await runs.finish({
        id: run.id,
        startedAt: T0,
        outcome: 'failed',
        affected: 9,
        finishedAt: at(2),
      });

      expect(store.rows.size).toBe(1);
      expect(second.outcome).toBe('failed');
    });
  });

  describe('prune', () => {
    it('keeps the newest runs and drops the rest on the count bound', async () => {
      // 30 runs a minute apart, well inside the age window. Only the count
      // bound can bite here — which is exactly the case the retention rule
      // exists for: a job that runs once a minute must not keep 40 000 rows.
      const store = makeJobRunStore(seed(30, 60_000));
      const runs = new JobRunStore(store.prisma as never);

      const deleted = await runs.prune({ jobName: 'test.job', now: T0, keep: 10, olderThanMs: RETAIN_RUNS_FOR_MS });

      expect(deleted).toBe(20);
      expect(store.rows.size).toBe(10);
      // The newest survive; the oldest go.
      expect(store.rows.has('r0')).toBe(true);
      expect(store.rows.has('r9')).toBe(true);
      expect(store.rows.has('r10')).toBe(false);
    });

    it('drops runs past the age bound even when there are few of them', async () => {
      const store = makeJobRunStore([
        runRow('old', at(-RETAIN_RUNS_FOR_MS - 1), 'test.job', { outcome: 'succeeded' }),
        runRow('recent', at(-1_000), 'test.job', { outcome: 'succeeded' }),
      ]);
      const runs = new JobRunStore(store.prisma as never);

      const deleted = await runs.prune({ jobName: 'test.job', now: T0 });

      expect(deleted).toBe(1);
      expect(store.rows.has('old')).toBe(false);
      expect(store.rows.has('recent')).toBe(true);
    });

    it('applies both bounds rather than whichever is more generous', async () => {
      // 40 runs, one a day, so the age bound alone would keep them all and the
      // count bound alone would keep 200. Retention has to honour the
      // stricter of the two, or one of them is decoration.
      const store = makeJobRunStore(seed(40, 24 * 3_600_000));
      const runs = new JobRunStore(store.prisma as never);

      const deleted = await runs.prune({ jobName: 'test.job', now: T0, keep: 10, olderThanMs: RETAIN_RUNS_FOR_MS });

      expect(deleted).toBe(30);
      expect(store.rows.size).toBe(10);
    });

    it('never deletes the run it was just called about', async () => {
      const store = makeJobRunStore([
        ...seed(3, 1_000),
        runRow('just-finished', T0, 'test.job', { outcome: 'succeeded' }),
      ]);
      const runs = new JobRunStore(store.prisma as never);

      await runs.prune({ jobName: 'test.job', now: T0, keep: 2 });

      expect(store.rows.has('just-finished')).toBe(true);
    });

    it('leaves another job\'s history alone', async () => {
      const store = makeJobRunStore([
        ...seed(5, 60_000, 'a.purge'),
        runRow('other-old', at(-RETAIN_RUNS_FOR_MS * 2), 'b.other', { outcome: 'succeeded' }),
      ]);
      const runs = new JobRunStore(store.prisma as never);

      await runs.prune({ jobName: 'a.purge', now: T0, keep: 2 });

      expect(store.rows.has('other-old')).toBe(true);
    });
  });

  describe('reads', () => {
    it('returns the newest run first and nothing that is not there', async () => {
      const store = makeJobRunStore([
        runRow('older', at(-60_000), 'test.job', { outcome: 'succeeded' }),
        runRow('newer', at(-1_000), 'test.job', { outcome: 'failed' }),
      ]);
      const runs = new JobRunStore(store.prisma as never);

      const latest = await runs.latestFor('test.job');
      const history = await runs.history('test.job', 10);

      expect(latest?.id).toBe('newer');
      expect(history.map((r) => r.id)).toEqual(['newer', 'older']);
      expect(await runs.latestFor('nope')).toBeNull();
    });

    it('caps what history returns', async () => {
      const store = makeJobRunStore(seed(20, 1_000));
      const runs = new JobRunStore(store.prisma as never);

      const history = await runs.history('test.job', 1_000);

      expect(history.length).toBe(20);
    });

    it('presents a run in the shape the wire contract declares', async () => {
      const store = makeJobRunStore([
        runRow('r1', T0, 'test.job', {
          outcome: 'succeeded',
          finishedAt: at(12),
          durationMs: 12,
          affected: 3,
          detail: { batches: 1 },
          error: null,
        }),
      ]);
      const runs = new JobRunStore(store.prisma as never);

      const view: JobRunView | null = await runs.latestFor('test.job');

      expect(view).toEqual({
        id: 'r1',
        jobName: 'test.job',
        instanceId: 'host:1',
        trigger: 'schedule',
        startedAt: T0.toISOString(),
        finishedAt: at(12).toISOString(),
        durationMs: 12,
        outcome: 'succeeded',
        affected: 3,
        detail: { batches: 1 },
        error: null,
      });
    });
  });

  it('declares retention as two bounds a reader can check', () => {
    // Defaults, named here so a change to either is a deliberate edit to a
    // test rather than a number drifting in a comment.
    expect(RETAIN_RUNS_PER_JOB).toBe(200);
    expect(RETAIN_RUNS_FOR_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
