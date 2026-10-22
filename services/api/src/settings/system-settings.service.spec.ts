import { describe, expect, it, vi } from 'vitest';
import { AppError, ValidationError } from '../common/errors.js';
import { runWithAuditContext } from '../audit/audit-context.js';
import { SystemSettingsService } from './system-settings.service.js';
import { SETTING_DEFINITIONS } from './registry.js';

/**
 * System settings with a fake store — BE-1507.
 *
 * Roles are not the service's to know (the controller owns them), so this
 * suite pins what the service does own: the effective value is the override
 * when there is one and the declared default when there is not, a stored
 * value that no longer validates falls back to the default rather than
 * wedging the platform, an unknown key is a 404 rather than a new setting,
 * and every write leaves one audited line with the reason the request
 * context carried.
 */
type Row = {
  key: string;
  value: unknown;
  updatedAt: Date;
};

const row = (key: string, value: unknown): Row => ({
  key,
  value,
  updatedAt: new Date('2026-10-21T00:00:00.000Z'),
});

function makePrisma(rows: Row[]) {
  const byKey = new Map(rows.map((r) => [r.key, { ...r }]));
  const changes: Array<{
    actorId: string;
    action: string;
    destructive?: boolean;
    before?: unknown;
    after?: unknown;
  }> = [];
  return {
    changes,
    systemSetting: {
      findMany: vi.fn(async () => [...byKey.values()].map((r) => ({ ...r }))),
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
        const found = byKey.get(where.key);
        return found ? { ...found } : null;
      }),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { key: string };
          create: { key: string; value: unknown };
          update: { value: unknown };
        }) => {
          const existing = byKey.get(where.key);
          const next = existing
            ? { ...existing, value: update.value }
            : { key: create.key, value: create.value, updatedAt: new Date('2026-10-21T00:00:00.000Z') };
          byKey.set(where.key, next);
          return { ...next };
        },
      ),
      delete: vi.fn(async ({ where }: { where: { key: string } }) => {
        const existing = byKey.get(where.key);
        if (!existing) throw Object.assign(new Error('record not found'), { code: 'P2025' });
        byKey.delete(where.key);
        return { ...existing };
      }),
    },
    audit: {
      recordChange: vi.fn(
        async (entry: {
          actorId: string;
          action: string;
          destructive?: boolean;
          before?: unknown;
          after?: unknown;
        }) => {
          changes.push({
            actorId: entry.actorId,
            action: entry.action,
            destructive: entry.destructive,
            before: entry.before,
            after: entry.after,
          });
          return { before: null, after: null, changed: ['value'] };
        },
      ),
    },
  };
}

const svc = (p: ReturnType<typeof makePrisma>) =>
  new SystemSettingsService(p as never, p.audit as never);

const ACTOR = { id: 'op-1', role: 'admin' };

const withReason = <T>(fn: () => T): T =>
  runWithAuditContext({ requestId: 'spec', reason: 'spec reason recorded for the audit line' }, fn);

describe('system settings', () => {
  it('serves the declared default when nothing has overridden it', async () => {
    const s = svc(makePrisma([]));
    expect(await s.get('transactions.intent-ttl-minutes')).toBe(15);
    expect(await s.get('compliance.sanctions-rescreen-hours')).toBe(24);
    expect(await s.get('swaps.quote-ttl-minutes')).toBe(1);
    expect(await s.get('platform.maintenance-mode')).toBe(false);
  });

  it('serves the override when there is one', async () => {
    const s = svc(makePrisma([row('transactions.intent-ttl-minutes', 45)]));
    expect(await s.get('transactions.intent-ttl-minutes')).toBe(45);
  });

  it('falls back to the default when the stored value no longer validates', async () => {
    // A code change tightened the bounds under a stored value. Serving the
    // stale value would apply a rule the code no longer has; refusing to
    // serve would turn a configuration mistake into an outage.
    const s = svc(makePrisma([row('transactions.intent-ttl-minutes', 99999)]));
    expect(await s.get('transactions.intent-ttl-minutes')).toBe(15);
  });

  it('refuses a key nobody declared', async () => {
    const s = svc(makePrisma([]));
    const err = await s.get('nope.notAKey' as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
  });

  it('lists every declared setting, and says which are overridden', async () => {
    const s = svc(makePrisma([row('platform.maintenance-mode', true)]));
    const list = await s.list();

    expect(list).toHaveLength(SETTING_DEFINITIONS.length);
    const byKey = new Map(list.map((entry) => [entry.key, entry]));
    expect(byKey.get('platform.maintenance-mode')).toMatchObject({
      value: true,
      source: 'override',
    });
    expect(byKey.get('transactions.intent-ttl-minutes')).toMatchObject({
      value: 15,
      source: 'default',
    });
  });

  it('writes an override and records what it replaced', async () => {
    const p = makePrisma([]);
    const s = svc(p);

    const view = await withReason(() => s.set('transactions.intent-ttl-minutes', 30, ACTOR));

    expect(view).toMatchObject({ value: 30, source: 'override' });
    expect(p.changes).toMatchObject([
      {
        actorId: 'op-1',
        action: 'setting.changed',
        destructive: true,
        before: { value: 15, source: 'default' },
        after: { value: 30, source: 'override' },
      },
    ]);
  });

  it('refuses a value the key\'s schema rejects', async () => {
    const s = svc(makePrisma([]));
    const err = await withReason(() =>
      s.set('transactions.intent-ttl-minutes', 0, ACTOR).catch((e: unknown) => e),
    );
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).status).toBe(422);
  });

  it('refuses a value of the wrong shape outright', async () => {
    const s = svc(makePrisma([]));
    const err = await withReason(() =>
      s.set('platform.maintenance-mode', 'yes' as never, ACTOR).catch((e: unknown) => e),
    );
    expect(err).toBeInstanceOf(ValidationError);
  });

  it('clearing an override puts the declared default back, and says so', async () => {
    const p = makePrisma([row('transactions.intent-ttl-minutes', 30)]);
    const s = svc(p);

    await withReason(() => s.clear('transactions.intent-ttl-minutes', ACTOR));

    expect(await s.get('transactions.intent-ttl-minutes')).toBe(15);
    expect(p.changes).toMatchObject([
      {
        action: 'setting.reset',
        destructive: true,
        before: { value: 30, source: 'override' },
        after: { value: 15, source: 'default' },
      },
    ]);
  });

  it('clearing a setting that is already at its default has nothing to clear', async () => {
    const s = svc(makePrisma([]));
    const err = await withReason(() =>
      s.clear('transactions.intent-ttl-minutes', ACTOR).catch((e: unknown) => e),
    );
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
  });
});
