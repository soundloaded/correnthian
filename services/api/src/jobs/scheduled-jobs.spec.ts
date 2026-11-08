import { describe, expect, it, vi } from 'vitest';
import { PricingService } from '../pricing/pricing.service.js';
import { IdempotencyPurgeJob } from './idempotency-purge.job.js';
import { StalePriceFlagJob } from './stale-price-flag.job.js';
import { SwapQuoteExpiryJob } from './swap-quote-expiry.job.js';
import { TransactionIntentExpiryJob } from './transaction-intent-expiry.job.js';
import type { JobContext } from './job.js';

/**
 * The four sweeps, against stores that really apply the `where` clause.
 *
 * Every one of these jobs is safe to re-run only because its mutation repeats
 * the predicate it selected on. A `vi.fn().mockResolvedValue({ count: 1 })`
 * cannot fail that claim — it returns 1 whatever the clause says — so the fakes
 * below evaluate the guard for real, and each has a hook that lets a row change
 * between the read and the write. That is the race the guard exists for, and a
 * test that cannot produce it asserts nothing about it.
 *
 * Nothing here sleeps and nothing reads `new Date()` for a decision. `now` is
 * a value the test constructs, so "one second past the expiry" is a fact about
 * the data rather than about how long the machine took.
 */

type Row = Record<string, unknown>;

const T0 = new Date('2026-10-06T09:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

/** A `JobContext` for a run anchored at `now`. `aborted` models a blown budget. */
function ctx(now: Date, aborted = false): JobContext {
  const controller = new AbortController();
  if (aborted) controller.abort();
  return {
    now,
    deadline: new Date(now.getTime() + 60_000),
    signal: controller.signal,
    trigger: 'schedule',
  };
}

// ---------------------------------------------------------------------------
// Idempotency purge
// ---------------------------------------------------------------------------

/**
 * `IdempotencyRecord` with the two guards the purge relies on evaluated for
 * real: the selection is `expiresAt < now`, and the delete repeats it.
 */
function makeIdempotencyStore(initial: Row[]) {
  const rows = new Map(initial.map((r) => [r['id'] as string, { ...r }]));
  /** Runs once, after the job has read and before it deletes. The race. */
  let beforeDelete: (() => void) | null = null;
  let findCalls = 0;

  const prisma = {
    idempotencyRecord: {
      findMany: async (args: {
        where: { expiresAt: { lt: Date } };
        orderBy: unknown;
        take: number;
        select: unknown;
      }) => {
        findCalls += 1;
        const before = args.where.expiresAt.lt;
        return [...rows.values()]
          .filter((r) => (r['expiresAt'] as Date) < before)
          .sort((a, b) => (a['expiresAt'] as Date).getTime() - (b['expiresAt'] as Date).getTime())
          .slice(0, args.take)
          .map((r) => ({ id: r['id'] }));
      },
      deleteMany: async (args: { where: { id: { in: string[] }; expiresAt: { lt: Date } } }) => {
        beforeDelete?.();
        beforeDelete = null;
        const before = args.where.expiresAt.lt;
        let count = 0;
        for (const id of args.where.id.in) {
          const row = rows.get(id);
          // The guard repeated on the delete. This is the whole safety
          // argument: a row whose `expiresAt` moved into the future since the
          // read — because a request took the key over — must survive.
          if (!row || !((row['expiresAt'] as Date) < before)) continue;
          rows.delete(id);
          count += 1;
        }
        return { count };
      },
    },
  };

  return {
    prisma,
    rows,
    get findCalls() {
      return findCalls;
    },
    set beforeDelete(fn: (() => void) | null) {
      beforeDelete = fn;
    },
  };
}

const record = (id: string, expiresAt: Date, state = 'completed'): Row => ({
  id,
  keyHash: `hash-${id}`,
  state,
  expiresAt,
});

describe('IdempotencyPurgeJob', () => {
  it('purges what is expired and leaves what is not', async () => {
    const store = makeIdempotencyStore([
      record('live', at(60_000)),
      record('dead', at(-1)),
      record('also-live', at(3_600_000)),
    ]);
    const purge = new IdempotencyPurgeJob(store.prisma as never);

    const outcome = await purge.run(ctx(T0));

    expect(outcome.affected).toBe(1);
    expect([...store.rows.keys()]).toEqual(['live', 'also-live']);
    expect(outcome.detail).toMatchObject({ stoppedEarly: 'complete' });
  });

  it('purges an expired in_progress claim too — it is already refused as abandoned', async () => {
    // `IdempotencyStore.resolveExisting` answers `abandoned` for any
    // `in_progress` row whose `lockedUntil` has passed, and `lockedUntil` is
    // always before `expiresAt`. So a row past `expiresAt` in this state can
    // never be reused, and leaving it is pure growth.
    const store = makeIdempotencyStore([record('orphan', at(-1), 'in_progress')]);
    const purge = new IdempotencyPurgeJob(store.prisma as never);

    const outcome = await purge.run(ctx(T0));

    expect(outcome.affected).toBe(1);
    expect(store.rows.size).toBe(0);
  });

  it('is safe to re-run: the second pass finds nothing the first did not take', async () => {
    const store = makeIdempotencyStore([record('dead', at(-1)), record('live', at(60_000))]);
    const purge = new IdempotencyPurgeJob(store.prisma as never);

    const first = await purge.run(ctx(T0));
    const second = await purge.run(ctx(T0));

    expect(first.affected).toBe(1);
    expect(second.affected).toBe(0);
    expect(second.detail).toMatchObject({ stoppedEarly: 'complete' });
  });

  it('keeps a record a request took over between the read and the delete', async () => {
    // The load-bearing guard. `IdempotencyStore.claim` can take over an
    // expired *completed* record and give it a fresh 24-hour life; deleting by
    // id alone would remove a record that is, at this instant, an active claim
    // — reopening a key a request is running under, which is the double
    // purchase this whole mechanism exists to prevent.
    const store = makeIdempotencyStore([record('taken-over', at(-1))]);
    const purge = new IdempotencyPurgeJob(store.prisma as never);

    store.beforeDelete = () => {
      const row = store.rows.get('taken-over')!;
      row['expiresAt'] = at(24 * 3_600_000);
      row['state'] = 'in_progress';
    };

    const outcome = await purge.run(ctx(T0));

    expect(outcome.affected).toBe(0);
    expect(store.rows.has('taken-over')).toBe(true);
    expect(store.rows.get('taken-over')!['state']).toBe('in_progress');
  });

  it('drains a backlog and reports completion', async () => {
    const many = Array.from({ length: 2_000 }, (_, i) => record(`r${i}`, at(-1_000 - i)));
    const store = makeIdempotencyStore(many);
    const purge = new IdempotencyPurgeJob(store.prisma as never);

    const outcome = await purge.run(ctx(T0));

    expect(outcome.affected).toBe(2_000);
    expect(outcome.detail).toMatchObject({ stoppedEarly: 'complete' });
  });

  it('stops at the batch cap rather than spending the whole budget', async () => {
    // One batch more than the cap, so the cap is what ends the run. A huge
    // backlog is drained over several runs, which is what an interval is for.
    const many = Array.from({ length: 500 * 41 }, (_, i) => record(`r${i}`, at(-1_000 - i)));
    const store = makeIdempotencyStore(many);
    const purge = new IdempotencyPurgeJob(store.prisma as never);

    const outcome = await purge.run(ctx(T0));

    expect(outcome.affected).toBe(500 * 40);
    expect(outcome.detail).toMatchObject({ stoppedEarly: 'batch_cap' });
  });

  it('stops when the budget is blown, and says so', async () => {
    const store = makeIdempotencyStore([record('dead', at(-1))]);
    const purge = new IdempotencyPurgeJob(store.prisma as never);

    const outcome = await purge.run(ctx(T0, true));

    expect(outcome.affected).toBe(0);
    expect(store.rows.size).toBe(1);
    expect(outcome.detail).toMatchObject({ stoppedEarly: 'budget' });
    // Nothing was even selected: the abort is checked before the read.
    expect(store.findCalls).toBe(0);
  });

  it('reports a zero that means "nothing was waiting", not "the job was idle"', async () => {
    const store = makeIdempotencyStore([]);
    const purge = new IdempotencyPurgeJob(store.prisma as never);

    const outcome = await purge.run(ctx(T0));

    expect(outcome.affected).toBe(0);
    expect(outcome.detail).toMatchObject({ batches: 0, expiredBefore: T0.toISOString() });
  });
});

// ---------------------------------------------------------------------------
// Swap quote expiry
// ---------------------------------------------------------------------------

function makeQuoteStore(initial: Row[]) {
  const rows = new Map(initial.map((r) => [r['id'] as string, { ...r }]));
  let beforeUpdate: (() => void) | null = null;

  const prisma = {
    swapQuote: {
      findMany: async (args: {
        where: { state: { in: string[] }; expiresAt: { lt: Date } };
        take: number;
      }) => {
        const before = args.where.expiresAt.lt;
        return [...rows.values()]
          .filter(
            (r) =>
              args.where.state.in.includes(r['state'] as string) && (r['expiresAt'] as Date) < before,
          )
          .sort((a, b) => (a['expiresAt'] as Date).getTime() - (b['expiresAt'] as Date).getTime())
          .slice(0, args.take)
          .map((r) => ({ id: r['id'] }));
      },
      updateMany: async (args: {
        where: { id: { in: string[] }; state: { in: string[] }; expiresAt: { lt: Date } };
        data: Row;
      }) => {
        beforeUpdate?.();
        beforeUpdate = null;
        const before = args.where.expiresAt.lt;
        let count = 0;
        for (const id of args.where.id.in) {
          const row = rows.get(id);
          if (!row) continue;
          // Both guards, on the write as well as the read.
          if (!args.where.state.in.includes(row['state'] as string)) continue;
          if (!((row['expiresAt'] as Date) < before)) continue;
          Object.assign(row, args.data);
          count += 1;
        }
        return { count };
      },
    },
  };

  return {
    prisma,
    rows,
    set beforeUpdate(fn: (() => void) | null) {
      beforeUpdate = fn;
    },
  };
}

const quote = (id: string, state: string, expiresAt: Date): Row => ({ id, state, expiresAt });

describe('SwapQuoteExpiryJob', () => {
  it('moves a quoted quote past its expiry to expired', async () => {
    const store = makeQuoteStore([quote('q1', 'quoted', at(-1))]);
    const sweep = new SwapQuoteExpiryJob(store.prisma as never);

    const outcome = await sweep.run(ctx(T0));

    expect(outcome.affected).toBe(1);
    expect(store.rows.get('q1')!['state']).toBe('expired');
  });

  it('leaves a quote that is not past its expiry', async () => {
    const store = makeQuoteStore([quote('q1', 'quoted', at(1_000))]);
    const sweep = new SwapQuoteExpiryJob(store.prisma as never);

    expect((await sweep.run(ctx(T0))).affected).toBe(0);
    expect(store.rows.get('q1')!['state']).toBe('quoted');
  });

  it('leaves a quote with a payment or a transaction already against it', async () => {
    // Expiring one of these is not a bookkeeping decision — it is a claim that
    // money which may still be moving is not. If those states need a timeout
    // they need one with a policy attached, decided by whoever owns the rail.
    const store = makeQuoteStore([
      quote('pay', 'awaiting_payment', at(-1)),
      quote('bc', 'broadcast', at(-1)),
      quote('set', 'settled', at(-1)),
      quote('fail', 'failed', at(-1)),
      quote('open', 'quoted', at(-1)),
    ]);
    const sweep = new SwapQuoteExpiryJob(store.prisma as never);

    const outcome = await sweep.run(ctx(T0));

    expect(outcome.affected).toBe(1);
    expect(store.rows.get('pay')!['state']).toBe('awaiting_payment');
    expect(store.rows.get('bc')!['state']).toBe('broadcast');
    expect(store.rows.get('open')!['state']).toBe('expired');
  });

  it('is safe to re-run: a quote already expired does not match again', async () => {
    const store = makeQuoteStore([quote('q1', 'quoted', at(-1))]);
    const sweep = new SwapQuoteExpiryJob(store.prisma as never);

    expect((await sweep.run(ctx(T0))).affected).toBe(1);
    expect((await sweep.run(ctx(T0))).affected).toBe(0);
    expect(store.rows.get('q1')!['state']).toBe('expired');
  });

  it('keeps a quote that moved on between the read and the write', async () => {
    const store = makeQuoteStore([quote('q1', 'quoted', at(-1))]);
    const sweep = new SwapQuoteExpiryJob(store.prisma as never);

    // Somebody acted on it: a payment arrived and the state advanced.
    store.beforeUpdate = () => {
      store.rows.get('q1')!['state'] = 'awaiting_payment';
    };

    expect((await sweep.run(ctx(T0))).affected).toBe(0);
    expect(store.rows.get('q1')!['state']).toBe('awaiting_payment');
  });

  it('stops when the budget is blown', async () => {
    const store = makeQuoteStore([quote('q1', 'quoted', at(-1))]);
    const sweep = new SwapQuoteExpiryJob(store.prisma as never);

    const outcome = await sweep.run(ctx(T0, true));

    expect(outcome.affected).toBe(0);
    expect(outcome.detail).toMatchObject({ stoppedEarly: 'budget' });
    expect(store.rows.get('q1')!['state']).toBe('quoted');
  });
});

// ---------------------------------------------------------------------------
// Stale price flag
// ---------------------------------------------------------------------------

/**
 * `Asset` and `AssetPrice`, including the `distinct: ['assetId']` the job
 * relies on to get one newest price per asset.
 */
function makePriceStore(assets: Row[], prices: Row[]) {
  const assetRows = assets.map((r) => ({ ...r }));
  const priceRows = prices.map((r) => ({ ...r }));
  /** Every call made. A write would show up here as `create`/`update`/`delete`. */
  const calls: string[] = [];

  const prisma = {
    asset: {
      findMany: async (args: { where: { enabled: boolean }; take: number }) => {
        calls.push('asset.findMany');
        return assetRows.filter((r) => r['enabled'] === args.where.enabled).slice(0, args.take);
      },
    },
    assetPrice: {
      findMany: async (args: { where: { assetId: { in: string[] } } }) => {
        calls.push('assetPrice.findMany');
        const byAsset = new Map<string, Row>();
        for (const row of priceRows) {
          if (!args.where.assetId.in.includes(row['assetId'] as string)) continue;
          const existing = byAsset.get(row['assetId'] as string);
          if (!existing || (row['capturedAt'] as Date) > (existing['capturedAt'] as Date)) {
            byAsset.set(row['assetId'] as string, row);
          }
        }
        return [...byAsset.values()].map((r) => ({
          assetId: r['assetId'],
          source: r['source'],
          capturedAt: r['capturedAt'],
        }));
      },
    },
  };

  return { prisma, assetRows, priceRows, calls };
}

describe('StalePriceFlagJob', () => {
  const asset = (id: string, symbol: string): Row => ({
    id,
    assetId: `1:0x${id}:c1`,
    symbol,
    enabled: true,
  });

  it('flags a price older than the freshness threshold the API applies', async () => {
    const store = makePriceStore(
      [asset('a1', 'XAU')],
      [{ assetId: 'a1', source: 'test', capturedAt: at(-(PricingService.MAX_AGE_SECONDS + 1) * 1000) }],
    );
    const sweep = new StalePriceFlagJob(store.prisma as never);

    const outcome = await sweep.run(ctx(T0));

    expect(outcome.affected).toBe(1);
    expect(outcome.detail).toMatchObject({
      staleCount: 1,
      neverPricedCount: 0,
      thresholdSeconds: PricingService.MAX_AGE_SECONDS,
      wroteNothing: true,
    });
    expect((outcome.detail?.['staleness'] as Row[])[0]).toMatchObject({
      symbol: 'XAU',
      reason: 'stale',
    });
  });

  it('does not flag a Chainlink round that is still inside the heartbeat', async () => {
    const store = makePriceStore(
      [asset('a1', 'XAU')],
      [{ assetId: 'a1', source: 'chainlink:xau-usd', capturedAt: at(-301_000) }],
    );
    const sweep = new StalePriceFlagJob(store.prisma as never);
    expect((await sweep.run(ctx(T0))).affected).toBe(0);
  });

  it('flags a Chainlink round older than the 86400-second heartbeat', async () => {
    const store = makePriceStore(
      [asset('a1', 'XAU')],
      [{ assetId: 'a1', source: 'chainlink:xau-usd', capturedAt: at(-86_401_000) }],
    );
    const sweep = new StalePriceFlagJob(store.prisma as never);
    const outcome = await sweep.run(ctx(T0));
    expect(outcome.affected).toBe(1);
    expect((outcome.detail?.['staleness'] as Row[])[0]).toMatchObject({
      symbol: 'XAU',
      reason: 'stale',
      source: 'chainlink:xau-usd',
    });
  });

  it('treats a price exactly on the threshold as fresh', async () => {
    // Non-Chainlink sources use `age <= MAX_AGE_SECONDS`, the same line as
    // `latest()`. A Chainlink row uses the 86400-second heartbeat instead.
    const store = makePriceStore(
      [asset('a1', 'XAU')],
      [{ assetId: 'a1', source: 'test', capturedAt: at(-PricingService.MAX_AGE_SECONDS * 1000) }],
    );
    const sweep = new StalePriceFlagJob(store.prisma as never);

    expect((await sweep.run(ctx(T0))).affected).toBe(0);
  });

  it('separates never-priced from stale', async () => {
    const store = makePriceStore(
      [asset('a1', 'XAU'), asset('a2', 'XAG')],
      [{ assetId: 'a1', source: 'test', capturedAt: at(-10 * PricingService.MAX_AGE_SECONDS * 1000) }],
    );
    const sweep = new StalePriceFlagJob(store.prisma as never);

    const outcome = await sweep.run(ctx(T0));

    expect(outcome.affected).toBe(2);
    expect(outcome.detail).toMatchObject({ staleCount: 1, neverPricedCount: 1 });
    expect(outcome.detail?.['neverPriced']).toEqual(['XAG']);
  });

  it('takes the newest price per asset, not an arbitrary one', async () => {
    const store = makePriceStore(
      [asset('a1', 'XAU')],
      [
        { assetId: 'a1', source: 'old', capturedAt: at(-86_400_000) },
        { assetId: 'a1', source: 'fresh', capturedAt: at(-1_000) },
      ],
    );
    const sweep = new StalePriceFlagJob(store.prisma as never);

    const outcome = await sweep.run(ctx(T0));

    expect(outcome.affected).toBe(0);
  });

  it('writes nothing — price history is never pruned', async () => {
    // Flag, never prune. A price history is the record of what a user was
    // shown when they were shown it — the only evidence if a fill is later
    // disputed. Deleting it to save space trades the thing that makes the
    // product's central claim checkable for disk.
    const store = makePriceStore(
      [asset('a1', 'XAU'), asset('a2', 'XAG')],
      [{ assetId: 'a1', source: 'test', capturedAt: at(-86_400_000) }],
    );
    const sweep = new StalePriceFlagJob(store.prisma as never);

    await sweep.run(ctx(T0));

    expect(store.calls).toEqual(['asset.findMany', 'assetPrice.findMany']);
  });

  it('measures age against the run clock, not the wall clock', async () => {
    // The same rows, two different run instants, two different answers. A
    // wall-clock implementation could not produce the second one.
    const store = makePriceStore(
      [asset('a1', 'XAU')],
      [{ assetId: 'a1', source: 'test', capturedAt: at(-200_000) }],
    );
    const sweep = new StalePriceFlagJob(store.prisma as never);

    // 200s old: inside the 300s window.
    expect((await sweep.run(ctx(T0))).affected).toBe(0);
    // The same row, 200s later: outside it.
    expect((await sweep.run(ctx(at(200_000)))).affected).toBe(1);
  });

  it('ignores an asset the registry has disabled', async () => {
    const store = makePriceStore([{ ...asset('a1', 'XAU'), enabled: false }], []);
    const sweep = new StalePriceFlagJob(store.prisma as never);

    const outcome = await sweep.run(ctx(T0));

    expect(outcome.affected).toBe(0);
    expect(outcome.detail).toMatchObject({ assets: 0 });
  });
});

// ---------------------------------------------------------------------------
// Transaction intent expiry
// ---------------------------------------------------------------------------

describe('TransactionIntentExpiryJob', () => {
  it('delegates to the lifecycle sweep with the run clock and reports what it did', async () => {
    const expireStale = vi.fn().mockResolvedValue({
      expired: 2,
      ids: ['tx1', 'tx2'],
      at: T0.toISOString(),
    });
    const job = new TransactionIntentExpiryJob({ expireStale } as never);

    const outcome = await job.run(ctx(T0));

    // The run's instant, not the service's `new Date()` default.
    expect(expireStale).toHaveBeenCalledWith(T0);
    expect(outcome.affected).toBe(2);
    expect(outcome.detail).toMatchObject({ expired: 2, at: T0.toISOString(), truncated: false });
  });

  it('caps the ids it stores so one run record is not a log', async () => {
    const ids = Array.from({ length: 80 }, (_, i) => `tx${i}`);
    const job = new TransactionIntentExpiryJob(
      { expireStale: vi.fn().mockResolvedValue({ expired: 80, ids, at: T0.toISOString() }) } as never,
    );

    const outcome = await job.run(ctx(T0));

    expect((outcome.detail?.['ids'] as string[]).length).toBe(50);
    expect(outcome.detail).toMatchObject({ truncated: true });
    expect(outcome.affected).toBe(80);
  });
});
