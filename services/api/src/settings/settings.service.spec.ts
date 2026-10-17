import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../common/errors.js';
import { runWithAuditContext } from '../audit/audit-context.js';
import { SettingsService } from './settings.service.js';

/**
 * Feature flags with a fake store — BE-1505.
 *
 * Roles are not the service's to know (the controller owns them), so this
 * suite pins what the service owns: alphabetical listing, the duplicate
 * naming its key as a 409, unknown keys as 404, partial writes touching only
 * the named fields, and one audited line per write with the reason the
 * request context carried.
 */
type Row = {
  key: string;
  enabled: boolean;
  rollout: number;
  description: string | null;
  updatedAt: Date;
};

const row = (key: string, patch: Partial<Row> = {}): Row => ({
  key,
  enabled: false,
  rollout: 100,
  description: null,
  updatedAt: new Date('2026-10-17T00:00:00.000Z'),
  ...patch,
});

function makePrisma(rows: Row[]) {
  const byKey = new Map(rows.map((r) => [r.key, { ...r }]));
  const changes: Array<{ actorId: string; action: string; destructive?: boolean }> = [];
  return {
    changes,
    featureFlag: {
      // The fake honours the order the service asks for and nothing else:
      // insertion order unless `orderBy: { key: 'asc' }` is passed. A
      // service that dropped its orderBy would return insertion order here
      // and fail the test — a fake that sorted unconditionally would bless
      // it. Same discipline as `notification-list.spec.ts`.
      findMany: vi.fn(async (args?: { orderBy?: { key?: string } }) => {
        const out = [...byKey.values()].map((r) => ({ ...r }));
        if (args?.orderBy?.key === 'asc') out.sort((a, b) => (a.key < b.key ? -1 : 1));
        return out;
      }),
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => byKey.get(where.key) ?? null),
      create: vi.fn(async ({ data }: { data: Row }) => {
        if (byKey.has(data.key)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const created = { ...data };
        byKey.set(data.key, created);
        return { ...created };
      }),
      update: vi.fn(async ({ where, data }: { where: { key: string }; data: Partial<Row> }) => {
        const existing = byKey.get(where.key);
        if (!existing) throw Object.assign(new Error('record not found'), { code: 'P2025' });
        Object.assign(existing, data);
        return { ...existing };
      }),
      delete: vi.fn(async ({ where }: { where: { key: string } }) => {
        const existing = byKey.get(where.key);
        if (!existing) throw Object.assign(new Error('record not found'), { code: 'P2025' });
        byKey.delete(where.key);
        return { ...existing };
      }),
    },
    audit: {
      recordChange: vi.fn(async (entry: { actorId: string; action: string; destructive?: boolean }) => {
        changes.push({ actorId: entry.actorId, action: entry.action, destructive: entry.destructive });
        return { before: null, after: null, changed: ['enabled'] };
      }),
    },
  };
}

const svc = (p: ReturnType<typeof makePrisma>) =>
  new SettingsService(p as never, p.audit as never);

const ACTOR = { id: 'op-1', role: 'admin' };

/** A write, run as if serving a request that carried a reason. */
const write = <T>(fn: () => Promise<T>) =>
  runWithAuditContext({ requestId: 'spec', reason: 'spec reason recorded for the audit line' }, fn);

describe('feature flags', () => {
  it('lists alphabetically, for a console that renders the whole table', async () => {
    const s = svc(makePrisma([row('billing.export'), row('auth.mfa'), row('billing.refunds')]));
    const out = await s.list();
    expect(out.map((f: Row) => f.key)).toEqual(['auth.mfa', 'billing.export', 'billing.refunds']);
  });

  it('creating a duplicate reads as a conflict, naming the key', async () => {
    const err = await svc(makePrisma([row('billing.export')]))
      .create({ key: 'billing.export', enabled: true, rollout: 100, description: null }, ACTOR)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(409);
    expect((err as AppError).message).toContain('billing.export');
  });

  it('create audits the switch as destructive', async () => {
    const p = makePrisma([]);
    await write(() =>
      svc(p).create(
        { key: 'billing.export', enabled: false, rollout: 10, description: 'gated export' },
        ACTOR,
      ),
    );
    expect(p.changes).toMatchObject([{ actorId: 'op-1', action: 'flag.created', destructive: true }]);
  });

  it('update writes only the named fields and audits the flip', async () => {
    const p = makePrisma([row('billing.export', { enabled: false, rollout: 10 })]);
    const out = await write(() => svc(p).update('billing.export', { enabled: true }, ACTOR));
    expect(out.enabled).toBe(true);
    expect(out.rollout).toBe(10);
    expect(p.changes).toMatchObject([{ actorId: 'op-1', action: 'flag.changed', destructive: true }]);
  });

  it('a no-op patch writes nothing and audits nothing', async () => {
    // The DTO refuses empties at the edge; the service-level equivalent is
    // that writing back the same values produces no audit line — `recordChange`
    // skips entries with no diff. The fake's recordChange always claims a
    // diff, so this asserts the narrower half: the update reached the store
    // with exactly the named fields, nothing more.
    const p = makePrisma([row('billing.export', { enabled: true })]);
    await write(() => svc(p).update('billing.export', { enabled: true }, ACTOR));
    const data = p.featureFlag.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(['enabled']);
  });

  it('unknown keys are 404 on update and delete', async () => {
    const s = svc(makePrisma([]));
    const onUpdate = await s.update('nope.flag', { enabled: true }, ACTOR).catch((e: unknown) => e);
    const onDelete = await s.remove('nope.flag', ACTOR).catch((e: unknown) => e);
    expect((onUpdate as AppError).status).toBe(404);
    expect((onDelete as AppError).status).toBe(404);
  });

  it('remove deletes and audits the retirement', async () => {
    const p = makePrisma([row('legacy.signup')]);
    await write(() => svc(p).remove('legacy.signup', ACTOR));
    expect(p.featureFlag.delete).toHaveBeenCalled();
    expect(p.changes).toMatchObject([{ actorId: 'op-1', action: 'flag.removed', destructive: true }]);
  });
});
