import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';

/**
 * The operator's notification table — Task 3.6's missing endpoint.
 *
 * State is derived, not stored: pending means neither sent nor failed.
 * The fake evaluates the state filter and the keyset predicate for real,
 * so a filter that misclassifies or a cursor that repeats fails here
 * rather than in front of an operator.
 */
type Row = Record<string, unknown>;

const row = (id: string, state: 'pending' | 'sent' | 'failed', at: string): Row => ({
  id,
  createdAt: new Date(at),
  channel: 'email',
  template: 't',
  sentAt: state === 'sent' ? new Date(at) : null,
  failedAt: state === 'failed' ? new Date(at) : null,
  error: state === 'failed' ? 'bounce' : null,
  user: { id: 'u1', email: 'u@example.test' },
});

function makePrisma(rows: Row[]) {
  const seen: Record<string, unknown>[] = [];
  const isPending = (r: Row) => r['sentAt'] === null && r['failedAt'] === null;
  const isSent = (r: Row) => r['sentAt'] !== null;
  const isFailed = (r: Row) => r['failedAt'] !== null;
  return {
    seen,
    user: {
      findMany: vi.fn(async () => [{ id: 'u1', email: 'u@example.test' }]),
    },
    notification: {
      findMany: vi.fn(async (args: { where?: Row; take?: number }) => {
        seen.push(args);
        let out: Row[] = rows.map((r) => ({ ...r, userId: 'u1' }));
        const where = args?.where ?? {};
        // The state filter is timestamp predicates, not a column: pending
        // is the conjunction, sent/failed are non-null checks. The fake
        // reads the same shapes the service writes.
        if (where['sentAt'] === null && where['failedAt'] === null) {
          out = out.filter(isPending);
        } else if ((where['sentAt'] as Row | undefined)?.['not'] === null) {
          out = out.filter(isSent);
        } else if ((where['failedAt'] as Row | undefined)?.['not'] === null) {
          out = out.filter(isFailed);
        }
        // Branches of one OR are a union: a row passes when ANY branch
        // holds. Filtering per branch in sequence would intersect them and
        // bless a predicate that drops rows at the page boundary.
        const and = (where['AND'] ?? []) as Row[];
        for (const clause of and) {
          const branches = (clause['OR'] ?? []) as Row[];
          out = out.filter((r) =>
            branches.some((b) => {
              const ts = b['createdAt'] as { lt?: Date } | Date | undefined;
              if (ts && typeof ts === 'object' && 'lt' in ts) {
                return (r['createdAt'] as Date) < (ts as { lt: Date }).lt;
              }
              return (
                ts !== undefined &&
                (r['createdAt'] as Date).getTime() === (ts as Date).getTime() &&
                (r['id'] as string) < ((b['id'] as { lt: string }).lt as string)
              );
            }),
          );
        }
        if (args?.take) out = out.slice(0, args.take);
        return out;
      }),
    },
  };
}

const svc = (rows: Row[]) => new NotificationsService(makePrisma(rows) as never);

describe('operator notification list', () => {
  it('derives state and filters inside where', async () => {
    const p = makePrisma([
      row('1', 'pending', '2026-10-09T00:00:00.000Z'),
      row('2', 'sent', '2026-10-09T01:00:00.000Z'),
      row('3', 'failed', '2026-10-09T02:00:00.000Z'),
    ]);
    const s = new NotificationsService(p as never);
    const out = await s.listAll({ state: 'failed' });
    expect(out.items.map((i: { id: string }) => i.id)).toEqual(['3']);
    expect(out.items[0]).toMatchObject({
      state: 'failed',
      error: 'bounce',
      user: { id: 'u1', email: 'u@example.test' },
    });
    expect((p.seen[0]?.['where'] ?? {}) as Row).toMatchObject({ failedAt: { not: null } });
    expect(out.nextCursor).toBeNull();
  });

  it('paginates by keyset without repeating the boundary row', async () => {
    const s = svc([
      row('3', 'pending', '2026-10-09T02:00:00.000Z'),
      row('2', 'pending', '2026-10-09T01:00:00.000Z'),
      row('1', 'pending', '2026-10-09T00:00:00.000Z'),
    ]);
    const first = await s.listAll({ limit: 2 });
    expect(first.items.map((i: { id: string }) => i.id)).toEqual(['3', '2']);
    expect(first.nextCursor).not.toBeNull();
    const second = await s.listAll({ limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((i: { id: string }) => i.id)).toEqual(['1']);
  });
});
