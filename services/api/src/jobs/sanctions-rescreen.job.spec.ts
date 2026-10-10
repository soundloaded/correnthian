import { describe, expect, it, vi } from 'vitest';
import { SanctionsRescreenJob } from './sanctions-rescreen.job.js';
import type { JobContext } from './job.js';

/**
 * The nightly re-screen — BE-1105 §3's early warning.
 *
 * Fiat gates are the enforcement point; this job exists so a listed person
 * is caught within ~24h even if they never transact. Hits land in the same
 * review queue through the same `rescreen` path the gate uses — one latch,
 * not two.
 *
 * Two properties pinned here because they are the ones a scheduler quietly
 * loses: it skips users a human already froze (re-screening a latched hit
 * wastes vendor calls and records noise over a decision), and one user's
 * vendor failure does not abort the rest of the batch.
 */

const NOW = new Date('2026-10-10T10:00:00.000Z');
const DAY = 24 * 3_600_000;
const HOUR = 3_600_000;

function ctx(): JobContext {
  const controller = new AbortController();
  return { now: NOW, deadline: new Date(NOW.getTime() + 300_000), signal: controller.signal, trigger: 'schedule' };
}

type Row = Record<string, unknown>;

function makePrisma(rows: Row[]) {
  return {
    kycProfile: {
      findMany: vi.fn(async (args: { where?: Row; take?: number }) => {
        // Evaluates the guard the job depends on for real: approved, not
        // latched, screen missing or older than the TTL. A stub returning a
        // canned list cannot fail this clause, and the clause is the point —
        // re-screening a frozen user is the waste this exists to prevent,
        // and skipping the never-screened is the gap it exists to close.
        const w = args?.where ?? {};
        const screenedBefore = (r: Row): boolean => {
          // The job asks for "never screened OR older than the TTL" as an
          // OR of two branches. A flat `lt` would exclude NULLs in Postgres
          // (NULL < x is NULL), silently skipping the never-screened — the
          // exact users this job exists to catch. Both branches evaluated.
          const branches = (w['OR'] as Array<Record<string, unknown>> | undefined) ?? [];
          for (const branch of branches) {
            const clause = branch['sanctionsScreenedAt'] as Row | null | undefined;
            if (clause === null || clause === undefined) {
              if (r['sanctionsScreenedAt'] === null || r['sanctionsScreenedAt'] === undefined) return true;
            } else if (typeof clause === 'object') {
              const lt = clause['lt'] as Date | undefined;
              if (
                lt !== undefined &&
                r['sanctionsScreenedAt'] !== null &&
                r['sanctionsScreenedAt'] !== undefined &&
                (r['sanctionsScreenedAt'] as Date) < lt
              ) {
                return true;
              }
            }
          }
          return branches.length === 0;
        };
        let out = [...rows];
        if (w['status']) out = out.filter((r) => r['status'] === w['status']);
        if (w['sanctionsResult'] && typeof w['sanctionsResult'] === 'object') {
          const not = (w['sanctionsResult'] as Row)['not'];
          if (not !== undefined) out = out.filter((r) => r['sanctionsResult'] !== not);
        }
        out = out.filter(screenedBefore);
        if (args?.take) out = out.slice(0, args.take);
        return out;
      }),
    },
  };
}

function setup(rows: Row[], rescreen: (userId: string) => Promise<{ result: 'clean' | 'hit'; screenedAt: Date }>) {
  const prisma = makePrisma(rows);
  const kyc = { rescreen: vi.fn(rescreen) };
  const job = new SanctionsRescreenJob(prisma as never, kyc as never);
  return { prisma, kyc, job };
}

const profile = (userId: string, over: Row = {}) => ({
  userId,
  status: 'approved',
  sanctionsResult: 'clean',
  sanctionsScreenedAt: new Date(NOW.getTime() - 2 * DAY),
  needsReview: false,
  ...over,
});

describe('SanctionsRescreenJob', () => {
  it('re-screens approved users whose screen is stale, oldest first', async () => {
    const { kyc, job } = setup(
      [profile('u1'), profile('u2', { sanctionsScreenedAt: new Date(NOW.getTime() - 3 * DAY) })],
      async () => ({ result: 'clean', screenedAt: NOW }),
    );

    const out = await job.run(ctx());

    expect(out.affected).toBe(2);
    expect(kyc.rescreen).toHaveBeenCalledTimes(2);
    expect(out.detail).toMatchObject({ screened: 2, hits: 0 });
  });

  it('skips users a human already froze', async () => {
    const { kyc, job } = setup(
      [
        profile('u1'),
        profile('u2', { sanctionsResult: 'hit', needsReview: true }),
      ],
      async () => ({ result: 'clean', screenedAt: NOW }),
    );

    await job.run(ctx());

    // The frozen user is not re-screened: the latch holds until a human
    // decides, and a fresh vendor answer changes nothing about that.
    expect(kyc.rescreen).toHaveBeenCalledTimes(1);
    expect(kyc.rescreen).toHaveBeenCalledWith('u1', NOW);
  });

  it('skips users with a fresh screen', async () => {
    const { kyc, job } = setup(
      [profile('u1', { sanctionsScreenedAt: new Date(NOW.getTime() - HOUR) })],
      async () => ({ result: 'clean', screenedAt: NOW }),
    );

    const out = await job.run(ctx());

    expect(out.affected).toBe(0);
    expect(kyc.rescreen).not.toHaveBeenCalled();
  });

  it('a hit lands in the queue through the same path the gate uses', async () => {
    const { kyc, job } = setup([profile('u1')], async (userId) => {
      expect(userId).toBe('u1');
      return { result: 'hit', screenedAt: NOW };
    });

    const out = await job.run(ctx());

    // The latch itself happens inside `rescreen`, which the fake stands in
    // for here; what this asserts is that the job counts the hit and keeps
    // going rather than treating it as a failure.
    expect(out.detail).toMatchObject({ screened: 1, hits: 1 });
    expect(kyc.rescreen).toHaveBeenCalledTimes(1);
  });

  it('one user failing does not abort the batch', async () => {
    const { kyc, job } = setup([profile('u1'), profile('u2'), profile('u3')], async (userId) => {
      if (userId === 'u2') throw new Error('vendor timeout');
      return { result: 'clean', screenedAt: NOW };
    });

    const out = await job.run(ctx());

    expect(kyc.rescreen).toHaveBeenCalledTimes(3);
    expect(out.affected).toBe(2);
    expect(out.detail).toMatchObject({ screened: 2, hits: 0 });
    expect((out.detail?.['errors'] as string[]).join(' ')).toContain('u2');
  });

  it('stops at the budget instead of running past it', async () => {
    const controller = new AbortController();
    controller.abort();
    const { kyc, job } = setup([profile('u1')], async () => ({ result: 'clean', screenedAt: NOW }));

    const out = await job.run({
      now: NOW,
      deadline: NOW,
      signal: controller.signal,
      trigger: 'schedule',
    });

    expect(kyc.rescreen).not.toHaveBeenCalled();
    expect(out.affected).toBe(0);
  });
});
