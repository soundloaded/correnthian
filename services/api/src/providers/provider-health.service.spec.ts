import { describe, expect, it } from 'vitest';
import { ProviderHealthService } from './provider-health.service.js';
import type { ProbeResult, ProviderProbe, ProviderSubject } from './provider-probe.js';

/**
 * What a probe result is allowed to do to the registry.
 *
 * The requirement is one sentence — *a probe that cannot reach a provider must
 * not mark it `active`* — and the interesting question is whether it is
 * enforced by structure or by care. So every case below drives the real
 * `ProviderHealthService` with probes that genuinely answer, and the assertion
 * is on the row that was written, not on what the caller intended.
 *
 * The registry fake applies `where` for real and records every write, so
 * "disabled is never touched" is a fact about the calls made rather than a
 * comment.
 */

type Row = Record<string, unknown>;

const T0 = new Date('2026-10-06T09:00:00.000Z');

function makeProviderStore(initial: Row[]) {
  const rows = new Map(initial.map((r) => [r['id'] as string, { ...r }]));
  const writes: Array<{ id: string; data: Row }> = [];

  const prisma = {
    provider: {
      findMany: async () =>
        [...rows.values()]
          .sort((a, b) => String(a['slug']).localeCompare(String(b['slug'])))
          .map((r) => ({
            id: r['id'],
            slug: r['slug'],
            name: r['name'],
            category: r['category'],
            capabilities: r['capabilities'],
            status: r['status'],
          })),
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = rows.get(where.id);
        if (!row) throw new Error(`No provider ${where.id}`);
        writes.push({ id: where.id, data });
        Object.assign(row, data);
        return { ...row };
      },
    },
  };

  return { prisma, rows, writes };
}

const provider = (id: string, slug: string, over: Row = {}): Row => ({
  id,
  slug,
  name: slug,
  category: 'metals',
  capabilities: ['buy'],
  status: 'active',
  lastHealth: null,
  lastCheckedAt: null,
  ...over,
});

/** A probe that answers with whatever it is told to, and records what it was asked. */
function fakeProbe(category: ProviderSubject['category'], result: ProbeResult | (() => ProbeResult)) {
  const seen: ProviderSubject[] = [];
  const probe: ProviderProbe = {
    category,
    description: `the ${category} probe under test`,
    async probe(subject: ProviderSubject) {
      seen.push(subject);
      return typeof result === 'function' ? result() : result;
    },
  };
  return { probe, seen };
}

describe('ProviderHealthService', () => {
  it('marks a provider active only when a probe reached it', async () => {
    const store = makeProviderStore([provider('p1', 'kinesis')]);
    const { probe, seen } = fakeProbe('metals', { outcome: 'reachable', detail: { latencyMs: 40 } });
    const health = new ProviderHealthService(store.prisma as never, [probe]);

    const report = await health.probeAll(T0);

    expect(report.affected).toBe(1);
    expect(store.rows.get('p1')!['status']).toBe('active');
    // The probe is given the fields it needs and not the whole row.
    expect(seen[0]).toEqual({
      id: 'p1',
      slug: 'kinesis',
      name: 'kinesis',
      category: 'metals',
      capabilities: ['buy'],
      status: 'active',
    });
  });

  it('never marks a provider active when the probe could not reach it', async () => {
    // The requirement, stated bluntly. `unreachable` is evidence about the
    // provider and it is not health.
    const store = makeProviderStore([provider('p1', 'kinesis')]);
    const { probe } = fakeProbe('metals', { outcome: 'unreachable', reason: 'connection refused' });
    const health = new ProviderHealthService(store.prisma as never, [probe]);

    await health.probeAll(T0);

    expect(store.rows.get('p1')!['status']).toBe('degraded');
    expect(store.rows.get('p1')!['status']).not.toBe('active');
  });

  it('demotes a provider sitting at active with nothing that can verify it', async () => {
    // `active` is a claim that we checked. A job whose purpose is to keep the
    // registry honest cannot leave that claim standing on the strength of
    // never having looked. A provider can be unreachable for days while the
    // registry reads `active`, and every consumer takes that as a yes.
    const store = makeProviderStore([provider('p1', 'kinesis')]);
    const health = new ProviderHealthService(store.prisma as never, []);

    const report = await health.probeAll(T0);

    expect(store.rows.get('p1')!['status']).toBe('degraded');
    expect(report.detail).toMatchObject({ demoted: ['kinesis'] });
    expect(report.detail).toMatchObject({ unprobedCategories: ['metals'] });
  });

  it('says there is nothing to probe rather than blaming the provider for our gap', async () => {
    // "I asked and the provider said no" and "there is nothing to ask" are
    // different facts. Turning the second into `unreachable` would blame a
    // provider for our own missing integration.
    const store = makeProviderStore([provider('p1', 'kinesis', { status: 'degraded' })]);
    const health = new ProviderHealthService(store.prisma as never, []);

    await health.probeAll(T0);

    const lastHealth = store.rows.get('p1')!['lastHealth'] as { probe: Row };
    expect(lastHealth.probe['outcome']).toBe('unavailable');
    expect(String(lastHealth.probe['reason'])).toMatch(/No health probe is registered/i);
  });

  it('treats a throwing probe as a gap on our side, and finishes the sweep', async () => {
    // Evidence that our own probe is broken, not about the provider. And one
    // broken probe must not abandon the rest of the sweep.
    const store = makeProviderStore([
      provider('p1', 'broken'),
      provider('p2', 'fine', { category: 'pricing' }),
    ]);
    const throwing: ProviderProbe = {
      category: 'metals',
      description: 'throws',
      async probe() {
        throw new Error('the adapter is not wired up');
      },
    };
    const { probe: working } = fakeProbe('pricing', { outcome: 'reachable' });
    const health = new ProviderHealthService(store.prisma as never, [throwing, working]);

    const report = await health.probeAll(T0);

    expect(store.rows.get('p1')!['status']).toBe('degraded');
    expect(store.rows.get('p2')!['status']).toBe('active');
    expect(report.affected).toBe(2);
    const first = (report.detail['results'] as Row[])[0]!;
    expect(first).toMatchObject({ slug: 'broken', outcome: 'unavailable' });
    expect(String(first['reason'])).toMatch(/probe threw/i);
  });

  it('never touches a provider an operator disabled', async () => {
    // Disabling is a human act with a reason. A scheduled job that could
    // re-enable one would undo an operator's decision on a timer.
    const store = makeProviderStore([
      provider('p1', 'off', { status: 'disabled' }),
      provider('p2', 'on'),
    ]);
    const { probe } = fakeProbe('metals', { outcome: 'reachable' });
    const health = new ProviderHealthService(store.prisma as never, [probe]);

    const report = await health.probeAll(T0);

    expect(store.writes.map((w) => w.id)).toEqual(['p2']);
    expect(store.rows.get('p1')!['status']).toBe('disabled');
    expect(store.rows.get('p1')!['lastCheckedAt']).toBeNull();
    expect(report.detail).toMatchObject({ skippedDisabled: ['off'] });
  });

  it('moves lastCheckedAt on every sweep, including one that changed nothing', async () => {
    // A `lastCheckedAt` that only moves when a human looks is the state this
    // job exists to fix. A check that confirmed what we already believed is
    // still news.
    const store = makeProviderStore([
      provider('p1', 'kinesis', { lastCheckedAt: new Date('2026-01-01T00:00:00.000Z') }),
    ]);
    const { probe } = fakeProbe('metals', { outcome: 'reachable' });
    const health = new ProviderHealthService(store.prisma as never, [probe]);

    await health.probeAll(T0);

    expect(store.rows.get('p1')!['lastCheckedAt']).toEqual(T0);
  });

  it('records why a provider is not healthy, and names the sweep', async () => {
    const store = makeProviderStore([provider('p1', 'kinesis')]);
    const { probe } = fakeProbe('metals', {
      outcome: 'unreachable',
      reason: 'HTTP 503 from the quote endpoint',
      detail: { status: 503 },
    });
    const health = new ProviderHealthService(store.prisma as never, [probe]);

    await health.probeAll(T0);

    const lastHealth = store.rows.get('p1')!['lastHealth'] as { probe: Row };
    expect(lastHealth.probe).toMatchObject({
      outcome: 'unreachable',
      reason: 'HTTP 503 from the quote endpoint',
      category: 'metals',
      at: T0.toISOString(),
    });
  });

  it('redacts a reason a provider or an adapter handed us', async () => {
    // A provider error string is a payload from outside the trust boundary and
    // can carry an endpoint or a key in a query parameter.
    const store = makeProviderStore([provider('p1', 'kinesis')]);
    const { probe } = fakeProbe('metals', {
      outcome: 'unreachable',
      reason: 'refused for key 0x' + 'ab'.repeat(32),
    });
    const health = new ProviderHealthService(store.prisma as never, [probe]);

    const report = await health.probeAll(T0);

    const listed = (report.detail['results'] as Row[])[0]!;
    expect(String(listed['reason'])).toContain('[REDACTED:HEX_KEY]');
    // The stored copy too — `lastHealth` is what the admin renders, and it
    // outlives the run record.
    const stored = store.rows.get('p1')!['lastHealth'] as { probe: Row };
    expect(String(stored.probe['reason'])).toContain('[REDACTED:HEX_KEY]');
  });

  it('reports what it activated and demoted, so a status change is never silent', async () => {
    const store = makeProviderStore([
      provider('p1', 'down', { status: 'active' }),
      provider('p2', 'up', { status: 'degraded', category: 'pricing' }),
    ]);
    const down = fakeProbe('metals', { outcome: 'unreachable', reason: 'timeout' });
    const up = fakeProbe('pricing', { outcome: 'reachable' });
    const health = new ProviderHealthService(store.prisma as never, [down.probe, up.probe]);

    const report = await health.probeAll(T0);

    expect(report.detail).toMatchObject({
      providers: 2,
      written: 2,
      activated: ['up'],
      demoted: ['down'],
    });
  });

  it('gives every provider the same sweep instant, not one per row', async () => {
    const store = makeProviderStore([provider('p1', 'a'), provider('p2', 'b')]);
    const { probe } = fakeProbe('metals', { outcome: 'reachable' });
    const health = new ProviderHealthService(store.prisma as never, [probe]);

    await health.probeAll(T0);

    expect(store.rows.get('p1')!['lastCheckedAt']).toEqual(T0);
    expect(store.rows.get('p2')!['lastCheckedAt']).toEqual(T0);
  });

  it('matches a probe by category and ignores a provider in a category it cannot check', async () => {
    const store = makeProviderStore([
      provider('p1', 'metals-one'),
      provider('p2', 'kyc-one', { category: 'kyc' }),
    ]);
    const metals = fakeProbe('metals', { outcome: 'reachable' });
    const health = new ProviderHealthService(store.prisma as never, [metals.probe]);

    const report = await health.probeAll(T0);

    expect(metals.seen.map((s) => s.slug)).toEqual(['metals-one']);
    expect(report.detail).toMatchObject({ unprobedCategories: ['kyc'] });
    expect(store.rows.get('p2')!['status']).toBe('degraded');
    expect(store.rows.get('p2')!['lastCheckedAt']).toEqual(T0);
  });
});

describe('ProbeResult — the shape of a conclusion', () => {
  it('has no value that means "healthy but I did not check"', async () => {
    // The type is the enforcement. `reachable` is the only outcome
    // `ProviderHealthService` writes `active` for, and there is no variant
    // that a failed check can be dressed up as.
    const outcomes = new Set<string>();
    const collect = (r: ProbeResult) => outcomes.add(r.outcome);
    collect({ outcome: 'reachable' });
    collect({ outcome: 'unreachable', reason: 'x' });
    collect({ outcome: 'unavailable', reason: 'x' });

    expect([...outcomes].sort()).toEqual(['reachable', 'unavailable', 'unreachable']);
  });
});
