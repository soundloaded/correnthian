import { describe, expect, it, vi } from 'vitest';
import { DeliveryService } from './delivery.service.js';
import { DeliveryUnavailableError } from './email-transport.js';

/**
 * The claim-and-dispatch discipline — DEF-009.
 *
 * Two workers must not send the same row, and a dead worker must not hold a
 * row forever. The fakes below evaluate the guard for real — `updateMany`
 * claims only rows that are unsent, unfailed, unheld and unexpired — and
 * each has a hook that lets the row change between the read and the write,
 * which is the race the guard exists for.
 */

type Row = {
  id: string;
  userId: string;
  channel: string;
  template: string;
  payload: Record<string, unknown>;
  sentAt: Date | null;
  failedAt: Date | null;
  claimedBy: string | null;
  claimedUntil: Date | null;
};

const T0 = new Date('2026-10-22T09:00:00.000Z');

const row = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  userId: 'u1',
  channel: 'email',
  template: 'kyc.approved',
  payload: {},
  sentAt: null,
  failedAt: null,
  claimedBy: null,
  claimedUntil: null,
  ...over,
});

function makePrisma(initial: Row[]) {
  const rows = new Map(initial.map((r) => [r.id, { ...r }]));
  const logs: Array<{ notificationId: string; status: string; attempt: number }> = [];
  /** Runs once, after the read and before the claim. The race. */
  let between: (() => void) | null = null;

  const visible = (r: Row) =>
    r.sentAt === null &&
    r.failedAt === null &&
    (r.claimedUntil === null || r.claimedUntil < T0);

  const prisma = {
    notification: {
      findMany: vi.fn(
        async (args: {
          where?: { id?: { in: string[] }; claimedBy?: string };
          orderBy?: unknown;
          take?: number;
          select: unknown;
        }) => {
          // The re-read after a claim: rows this holder actually holds.
          if (args.where?.claimedBy !== undefined) {
            return [...rows.values()]
              .filter((r) => args.where!.id!.in.includes(r.id) && r.claimedBy === args.where!.claimedBy)
              .map((r) => ({ ...r }));
          }
          return [...rows.values()]
            .filter(visible)
            .sort((a, b) => a.id.localeCompare(b.id))
            .slice(0, 50)
            .map((r) => ({ id: r.id }));
        },
      ),
      updateMany: vi.fn(
        async (args: {
          where: { id: { in: string[] }; OR: Array<{ claimedBy?: null; claimedUntil?: null | { lt: Date } }> };
          data: { claimedBy: string; claimedUntil: Date };
        }) => {
          between?.();
          between = null;
          const now = T0;
          let count = 0;
          for (const id of args.where.id.in) {
            const r = rows.get(id);
            if (!r || r.sentAt !== null || r.failedAt !== null) continue;
            // The guard repeated on the claim, as `OR` arms: untouched, or
            // held under a lease that has lapsed. Anything else — sent,
            // failed, or held under a live lease — matches zero.
            const untouched = r.claimedBy === null && r.claimedUntil === null;
            const lapsed = r.claimedUntil !== null && r.claimedUntil < now;
            if (!untouched && !lapsed) continue;
            r.claimedBy = args.data.claimedBy;
            r.claimedUntil = args.data.claimedUntil;
            count += 1;
          }
          return { count };
        },
      ),
    },
    deliveryLog: {
      count: vi.fn(async (args: { where: { notificationId: string } }) =>
        logs.filter((l) => l.notificationId === args.where.notificationId).length,
      ),
      create: vi.fn(async (args: { data: { notificationId: string; status: string; attempt: number } }) => {
        logs.push({ notificationId: args.data.notificationId, status: args.data.status, attempt: args.data.attempt });
        return args.data;
      }),
    },
    user: {
      findUnique: vi.fn(async () => ({ email: 'ada@example.com', displayName: 'Ada' })),
    },
  };

  return { prisma, rows, logs, race: (fn: () => void) => { between = fn; } };
}

describe('DeliveryService.claim', () => {
  it('claims each row once across racing workers', async () => {
    const a = makePrisma([row('a'), row('b')]);
    const svc = new DeliveryService(a.prisma as never, { send: vi.fn() } as never);

    // The second worker's read happens after the first worker's claim.
    const first = await svc.claim(50, 'worker-1', T0);
    a.prisma.notification.findMany.mockImplementationOnce(async () => [{ id: 'a' }, { id: 'b' }].slice(first.length));
    const second = await svc.claim(50, 'worker-2', T0);

    const all = [...first.map((r) => r.id), ...second.map((r) => r.id)];
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(2);
  });

  it('loses the race cleanly when the row moves between read and claim', async () => {
    const store = makePrisma([row('a')]);
    const svc = new DeliveryService(store.prisma as never, { send: vi.fn() } as never);

    store.race(() => {
      store.rows.get('a')!.sentAt = T0;
    });
    const claimed = await svc.claim(50, 'worker-1', T0);

    expect(claimed).toHaveLength(0);
  });

  it('treats a lapsed lease as unclaimed, and a live one as held', async () => {
    const store = makePrisma([
      row('lapsed', { claimedBy: 'dead-worker', claimedUntil: new Date(T0.getTime() - 1) }),
      row('held', { claimedBy: 'live-worker', claimedUntil: new Date(T0.getTime() + 60_000) }),
    ]);
    const svc = new DeliveryService(store.prisma as never, { send: vi.fn() } as never);

    const claimed = await svc.claim(50, 'worker-2', T0);

    expect(claimed.map((r) => r.id)).toEqual(['lapsed']);
  });
});

describe('DeliveryService.dispatch', () => {
  const wireUpdates = (store: ReturnType<typeof makePrisma>) => {
    (store.prisma.notification as { update?: unknown }).update = vi.fn(
      async (args: { where: { id: string }; data: Partial<Row> }) => {
        Object.assign(store.rows.get(args.where.id)!, args.data);
        return args.data;
      },
    );
  };

  it('sends through the transport and records the attempt', async () => {
    const store = makePrisma([row('a')]);
    const send = vi.fn(async () => ({ providerMsgId: 'msg-1' }));
    const svc = new DeliveryService(store.prisma as never, { send } as never);
    wireUpdates(store);

    const claimed = await svc.claim(50, 'worker-1', T0);
    expect(claimed).toHaveLength(1);

    const outcome = await svc.dispatch(claimed[0] as (typeof claimed)[number], T0);

    expect(outcome).toBe('sent');
    expect(send).toHaveBeenCalledOnce();
    const firstCall = send.mock.calls[0] as [{ to: string }] | undefined;
    expect(firstCall?.[0]).toMatchObject({ to: 'ada@example.com' });
    expect(store.logs).toMatchObject([{ notificationId: 'a', status: 'sent', attempt: 1 }]);
    const target = store.rows.get('a')!;
    expect(target.sentAt).toEqual(T0);
    expect(target.claimedBy).toBeNull();
  });

  it('retries a transient provider failure, and fails it after five attempts', async () => {
    const store = makePrisma([row('a')]);
    const send = vi.fn(async () => {
      throw new DeliveryUnavailableError('down');
    });
    const svc = new DeliveryService(store.prisma as never, { send } as never);
    wireUpdates(store);

    const target = store.rows.get('a')!;
    const asClaimed = { id: 'a', userId: 'u1', channel: 'email', template: 'kyc.approved', payload: {} };

    expect(await svc.dispatch(asClaimed, T0)).toBe('retrying');
    expect(target.sentAt).toBeNull();
    expect(target.failedAt).toBeNull();
    expect(target.claimedBy).toBeNull();

    // Four more attempts: the fifth is terminal, not another retry.
    for (let i = 2; i <= 4; i += 1) {
      expect(await svc.dispatch(asClaimed, T0)).toBe('retrying');
    }
    expect(await svc.dispatch(asClaimed, T0)).toBe('failed');
    expect(target.failedAt).toEqual(T0);
  });

  it('fails an unknown template loudly rather than retrying it', async () => {
    const store = makePrisma([row('a', { template: 'billing.invoice' })]);
    const send = vi.fn(async () => ({ providerMsgId: 'msg-1' }));
    const svc = new DeliveryService(store.prisma as never, { send } as never);
    wireUpdates(store);

    const outcome = await svc.dispatch(
      { id: 'a', userId: 'u1', channel: 'email', template: 'billing.invoice', payload: {} },
      T0,
    );

    expect(outcome).toBe('failed');
    expect(send).not.toHaveBeenCalled();
  });
});
