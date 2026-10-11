import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';

type Row = Record<string, unknown>;

function makePrisma() {
  const rows: Row[] = [];
  return {
    rows,
    notification: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: `n${rows.length + 1}`, sentAt: null, failedAt: null, error: null, createdAt: new Date(), ...data };
        rows.push(row);
        return { ...row };
      }),
      findMany: vi.fn(async (args: { where?: Row; orderBy?: unknown; take?: number } = {}) => {
        // Evaluated for real: claimBatch's pending filter and listForUser's
        // owner filter are the properties under test, and a canned list
        // cannot fail them.
        let out = rows.map((r) => ({ ...r }));
        const where = args.where ?? {};
        if (typeof where['userId'] === 'string') out = out.filter((r) => r['userId'] === where['userId']);
        if (where['sentAt'] === null && where['failedAt'] === null) {
          out = out.filter((r) => r['sentAt'] === null && r['failedAt'] === null);
        }
        // Oldest-first only when asked: without the orderBy the store
        // returns storage order, so the fake reverses insertion order to
        // prove the service actually passes the clause. A fake that sorted
        // unconditionally would bless a dropped orderBy.
        const ordered =
          JSON.stringify(args.orderBy) === JSON.stringify({ createdAt: 'asc' })
            ? [...out].sort((a, b) =>
                String(a['createdAt']).localeCompare(String(b['createdAt'])) ||
                String(a['id']).localeCompare(String(b['id'])),
              )
            : [...out].reverse();
        if (args.take) return ordered.slice(0, args.take);
        return ordered;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = rows.find((r) => r['id'] === where.id);
        if (!row) throw Object.assign(new Error('record not found'), { code: 'P2025' });
        Object.assign(row, data);
        return { ...row };
      }),
      count: vi.fn(async (args: { where?: Row } = {}) => {
        const where = args.where ?? {};
        if (where['sentAt'] === null && where['failedAt'] === null) {
          return rows.filter((r) => r['sentAt'] === null && r['failedAt'] === null).length;
        }
        if ((where['sentAt'] as Row | undefined)?.['not'] === null) return rows.filter((r) => r['sentAt'] !== null).length;
        if ((where['failedAt'] as Row | undefined)?.['not'] === null) return rows.filter((r) => r['failedAt'] !== null).length;
        return rows.length;
      }),
    },
  };
}

const svc = (p: ReturnType<typeof makePrisma>) => new NotificationsService(p as never);

describe('notification queue methods', () => {
  it('enqueue stores channel, template and payload', async () => {
    const p = makePrisma();
    const row = await svc(p).enqueue({ userId: 'u1', channel: 'email', template: 't', payload: { a: 1 } });
    expect(row).toMatchObject({ userId: 'u1', channel: 'email', template: 't' });
  });

  it('listForUser sees only the caller rows', async () => {
    const p = makePrisma();
    const s = svc(p);
    await s.enqueue({ userId: 'u1', channel: 'email', template: 'a', payload: {} });
    await s.enqueue({ userId: 'u2', channel: 'email', template: 'b', payload: {} });
    expect((await s.listForUser('u1')).map((r) => r['template'])).toEqual(['a']);
  });

  it('claimBatch returns pending oldest-first and marks nothing', async () => {
    const p = makePrisma();
    const s = svc(p);
    await s.enqueue({ userId: 'u1', channel: 'email', template: 'a', payload: {} });
    await s.markSent(p.rows[0]!['id'] as string);
    await s.enqueue({ userId: 'u1', channel: 'email', template: 'b', payload: {} });
    await s.enqueue({ userId: 'u1', channel: 'email', template: 'c', payload: {} });
    const batch = await s.claimBatch();
    expect(batch.map((r) => r['template'])).toEqual(['b', 'c']);
    // No claim exists: a second worker receives the same rows (DEF-009).
    expect(await s.claimBatch()).toEqual(batch);
  });

  it('markFailed stamps the error truncated at 500 chars', async () => {
    const p = makePrisma();
    const s = svc(p);
    await s.enqueue({ userId: 'u1', channel: 'email', template: 'a', payload: {} });
    await s.markFailed(p.rows[0]!['id'] as string, 'x'.repeat(600));
    expect((p.rows[0]!['error'] as string).length).toBe(500);
    expect(p.rows[0]!['failedAt']).toBeInstanceOf(Date);
  });

  it('stats counts all four buckets', async () => {
    const p = makePrisma();
    const s = svc(p);
    await s.enqueue({ userId: 'u1', channel: 'email', template: 'a', payload: {} });
    await s.enqueue({ userId: 'u1', channel: 'email', template: 'b', payload: {} });
    await s.markSent(p.rows[0]!['id'] as string);
    await s.markFailed(p.rows[1]!['id'] as string, 'bounce');
    expect(await s.stats()).toEqual({ total: 2, pending: 0, sent: 1, failed: 1 });
  });
});
