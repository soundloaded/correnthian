import { describe, expect, it, vi } from 'vitest';
import { AttestationFreshnessJob } from './attestation-freshness.job.js';
import type { JobContext } from './job.js';

/**
 * The attestation freshness sweep — Task 2.5 Step 2.
 *
 * Verification, not validation: it reports which enabled assets stand past
 * their own attestation cadence without a fresh attestation, and writes
 * nothing. Three properties: cadence `none` never flags (no promise was
 * made), a never-attested asset with a real cadence always flags (silence
 * is not freshness), and per-asset windows come from the cadence, not from
 * the 90-day approximation the stats counter uses.
 */

const NOW = new Date('2026-10-10T10:00:00.000Z');
const DAY = 24 * 3_600_000;

function ctx(): JobContext {
  const controller = new AbortController();
  return { now: NOW, deadline: new Date(NOW.getTime() + 60_000), signal: controller.signal, trigger: 'schedule' };
}

type Row = Record<string, unknown>;

function makePrisma(rows: Row[]) {
  return {
    asset: {
      // The paged fake below owns cursor coverage; this one owns the
      // predicates: enabled and a real cadence. A fake returning canned
      // rows would bless a dropped filter.
      findMany: vi.fn(async (args: { where?: Row } = {}) => {
        const where = args.where ?? {};
        return rows
          .filter((r) => where['enabled'] === undefined || r['enabled'] !== false)
          .filter((r) => {
            const not = (where['attestationCadence'] as Row | undefined)?.['not'];
            return not === undefined || r['attestationCadence'] !== not;
          })
          .map((r) => ({ ...r }));
      }),
    },
  };
}

const svc = (rows: Row[]) => new AttestationFreshnessJob(makePrisma(rows) as never);

describe('attestation freshness flags by cadence', () => {
  it('flags a monthly asset attested 31 days ago, keeps one attested yesterday', async () => {
    const out = await svc([
      { assetId: 'a-old', attestationCadence: 'monthly', lastAttestedAt: new Date(NOW.getTime() - 31 * DAY) },
      { assetId: 'a-fresh', attestationCadence: 'monthly', lastAttestedAt: new Date(NOW.getTime() - DAY) },
    ]).run(ctx());
    expect(out.affected).toBe(1);
    expect(out.detail).toMatchObject({ checked: 2, stale: ['a-old'] });
  });

  it('a never-attested asset with a real cadence is stale; cadence none never flags', async () => {
    const out = await svc([
      { assetId: 'a-silent', attestationCadence: 'quarterly', lastAttestedAt: null },
      { assetId: 'a-none', attestationCadence: 'none', lastAttestedAt: null },
    ]).run(ctx());
    // The `none` row never leaves the store: the cadence predicate filters
    // it, so `checked` counts only rows carrying a real promise.
    expect(out.detail).toMatchObject({ checked: 1, stale: ['a-silent'] });
  });

  it('a disabled asset is never checked, however stale', async () => {
    const out = await svc([
      { assetId: 'a-off', attestationCadence: 'monthly', lastAttestedAt: null, enabled: false },
    ]).run(ctx());
    expect(out.detail).toMatchObject({ checked: 0, stale: [] });
  });

  it('quarterly and annual windows are their own, not the stats 90-day rule', async () => {
    const out = await svc([
      // 60 days past a quarterly attestation: fresh by its own cadence,
      // stale by the stats counter's approximation. The job reports its own.
      { assetId: 'a-q', attestationCadence: 'quarterly', lastAttestedAt: new Date(NOW.getTime() - 60 * DAY) },
      { assetId: 'a-y', attestationCadence: 'annual', lastAttestedAt: new Date(NOW.getTime() - 400 * DAY) },
    ]).run(ctx());
    expect(out.detail).toMatchObject({ checked: 2, stale: ['a-y'] });
  });
});

describe('attestation freshness paginates deterministically', () => {
  function pagedPrisma(rows: Row[]) {
    const calls: Array<{ where?: Row; orderBy?: unknown; take?: number }> = [];
    const sorted = [...rows].sort((a, b) => String(a['assetId']).localeCompare(String(b['assetId'])));
    return {
      calls,
      asset: {
        findMany: vi.fn(async (args: { where?: Row; orderBy?: unknown; take?: number } = {}) => {
          calls.push(args);
          let out = sorted;
          const gt = ((args.where ?? {}) as Row)['assetId'] as { gt?: string } | undefined;
          if (gt && typeof gt === 'object' && typeof gt.gt === 'string') {
            out = out.filter((r) => String(r['assetId']) > gt.gt!);
          }
          if (args.take) out = out.slice(0, args.take);
          return out.map((r) => ({ ...r }));
        }),
      },
    };
  }

  it('pages past the batch in assetId order and checks every row', async () => {
    const rows: Row[] = Array.from({ length: 201 }, (_, i) => ({
      assetId: `a-${String(i).padStart(4, '0')}`,
      attestationCadence: 'monthly',
      lastAttestedAt: null,
    }));
    const fake = pagedPrisma(rows);
    const job = new AttestationFreshnessJob(fake as never);
    const out = await job.run(ctx());

    expect(out.detail).toMatchObject({ checked: 201 });
    expect(out.affected).toBe(201);
    expect(fake.calls.length).toBeGreaterThanOrEqual(2);
    expect(fake.calls[0]).toMatchObject({ orderBy: [{ assetId: 'asc' }] });
  });
});
