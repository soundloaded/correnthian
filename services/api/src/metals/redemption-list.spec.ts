import { describe, expect, it, vi } from 'vitest';
import { RedemptionService } from './redemption.service.js';

/**
 * The operator's redemption table — Task 3.1's missing endpoint.
 *
 * Keyset on `requestedAt`, tie-broken by `id`, with an optional state
 * filter spread inside `where` (never beside an OR). The fake evaluates
 * the filter and the keyset predicate for real: a stub returning canned
 * rows could not catch a filter that silently drops or a cursor that
 * repeats.
 */
type Row = Record<string, unknown>;

function makePrisma(rows: Row[]) {
  const seen: Record<string, unknown>[] = [];
  return {
    seen,
    redemptionRequest: {
      findMany: vi.fn(async (args: { where?: Row; orderBy?: unknown; take?: number }) => {
        seen.push(args);
        let out = rows.map((r) => ({ ...r }));
        const where = args?.where ?? {};
        if (typeof where['state'] === 'string') out = out.filter((r) => r['state'] === where['state']);
        // The keyset predicate for real: strictly before (at, id) under
        // desc ordering. A fake that skipped this would bless any
        // pagination, including one that repeats the boundary row.
        const and = (where['AND'] ?? []) as Row[];
        for (const clause of and) {
          const branches = (clause['OR'] ?? []) as Row[];
          out = out.filter((r) =>
            branches.some((b) => {
              const ts = b['requestedAt'] as { lt?: Date } | Date | undefined;
              if (ts && typeof ts === 'object' && 'lt' in ts) {
                return (r['requestedAt'] as Date) < (ts as { lt: Date }).lt;
              }
              return (
                (r['requestedAt'] as Date).getTime() === (ts as Date).getTime() &&
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

const row = (id: string, state: string, at: string): Row => ({
  id, state, requestedAt: new Date(at), amountRaw: '100',
  asset: { assetId: '1:0x0:g', symbol: 'G' },
  provider: { slug: 'p', name: 'P' },
});

const svc = (rows: Row[]) =>
  new RedemptionService(makePrisma(rows) as never, {} as never, {} as never, {} as never);

describe('operator redemption list', () => {
  it('filters by state inside where', async () => {
    const p = makePrisma([row('1', 'requested', '2026-10-09T00:00:00.000Z'), row('2', 'shipped', '2026-10-09T01:00:00.000Z')]);
    const s = new RedemptionService(p as never, {} as never, {} as never, {} as never);
    const out = await s.listAll({ state: 'shipped' });
    expect(out.items.map((i: { id: string }) => i.id)).toEqual(['2']);
    const where = (p.seen[0]?.['where'] ?? {}) as Row;
    expect(where['state']).toBe('shipped');
    expect(out.nextCursor).toBeNull();
  });

  it('paginates by keyset without repeating the boundary row', async () => {
    const rows = [
      row('3', 'requested', '2026-10-09T02:00:00.000Z'),
      row('2', 'requested', '2026-10-09T01:00:00.000Z'),
      row('1', 'requested', '2026-10-09T00:00:00.000Z'),
    ];
    const s = svc(rows);
    const first = await s.listAll({ limit: 2 });
    expect(first.items.map((i: { id: string }) => i.id)).toEqual(['3', '2']);
    expect(first.nextCursor).not.toBeNull();
    const second = await s.listAll({ limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((i: { id: string }) => i.id)).toEqual(['1']);
    expect(second.nextCursor).toBeNull();
  });
});
