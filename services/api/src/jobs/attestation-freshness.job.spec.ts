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
      findMany: vi.fn(async () => rows.map((r) => ({ ...r }))),
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
    expect(out.detail).toMatchObject({ checked: 2, stale: ['a-silent'] });
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
