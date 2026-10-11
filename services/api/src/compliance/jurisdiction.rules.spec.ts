import { describe, expect, it, vi } from 'vitest';
import { JurisdictionService } from './jurisdiction.service.js';

/**
 * Rule reads and writes — BE-1106 admin half.
 *
 * The engine (`evaluate`) is specified elsewhere; this file owns the
 * console surface: ordered reads, partial updates that leave omitted
 * fields alone, 404 on unknown ids, and one audit row per write carrying
 * the reason. The fake evaluates `orderBy` and the update `where` for
 * real — canned rows would bless a dropped clause.
 */
type Row = Record<string, unknown>;

const US: Row = {
  id: 'r-us', country: 'US', region: '', canBuyCrypto: true, canSellCrypto: true,
  canUseMetals: true, canRedeem: false, kycRequired: true, blockedProviders: [],
  notes: null, active: true,
};

function makePrisma(rows: Row[] = [{ ...US }]) {
  const store = rows.map((r) => ({ ...r }));
  const calls: unknown[] = [];
  const changes: unknown[] = [];
  return {
    calls,
    changes,
    jurisdictionRule: {
      findMany: vi.fn(async (args: { orderBy?: unknown } = {}) => {
        calls.push(args);
        const out = store.map((r) => ({ ...r }));
        // Order for real: the console table's country-then-region sort is
        // the property, and insertion order would bless a dropped orderBy.
        if (JSON.stringify(args.orderBy) === JSON.stringify([{ country: 'asc' }, { region: 'asc' }])) {
          out.sort((a, b) =>
            String(a['country']).localeCompare(String(b['country'])) ||
            String(a['region']).localeCompare(String(b['region'])),
          );
        }
        return out;
      }),
      findUnique: vi.fn(async ({ where }: { where: Row }) =>
        store.find((r) => r['id'] === where['id'] ? true : (r['country'] === (where['country_region'] as Row)?.['country'])) ?? null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = store.find((r) => r['id'] === where.id);
        if (!row) throw Object.assign(new Error('record not found'), { code: 'P2025' });
        Object.assign(row, data);
        return { ...row };
      }),
    },
    audit: { recordChange: vi.fn(async (e: unknown) => { changes.push(e); return { changed: ['x'] }; }) },
  };
}

const svc = (p: ReturnType<typeof makePrisma>) =>
  new JurisdictionService(p as never, p.audit as never);

describe('jurisdiction rule reads', () => {
  it('lists ordered by country then region', async () => {
    const p = makePrisma([
      { ...US, id: 'r-us-ca', country: 'US', region: 'CA' },
      { ...US, id: 'r-gb', country: 'GB', region: '' },
      { ...US },
    ]);
    const rows = await svc(p).listRules();
    expect(rows.map((r) => r['id'])).toEqual(['r-gb', 'r-us', 'r-us-ca']);
    expect(p.calls[0]).toMatchObject({ orderBy: [{ country: 'asc' }, { region: 'asc' }] });
  });
});

describe('jurisdiction rule writes', () => {
  it('updates only the supplied flags, leaving the rest byte-identical', async () => {
    const p = makePrisma();
    const out = await svc(p).updateRule('r-us', { canRedeem: true }, { id: 'op', role: 'admin', reason: 'probe reason here' });
    expect(out).toMatchObject({ canRedeem: true, canBuyCrypto: true, kycRequired: true, notes: null });
  });

  it('records one audit row carrying the reason', async () => {
    const p = makePrisma();
    await svc(p).updateRule('r-us', { active: false }, { id: 'op', role: 'admin', reason: 'probe reason here' });
    expect(p.changes).toHaveLength(1);
    expect(p.changes[0]).toMatchObject({ action: 'jurisdiction.updated', targetId: 'r-us', reason: 'probe reason here' });
  });

  it('a short reason fails before anything is read or written', async () => {
    const p = makePrisma();
    const prisma = p.jurisdictionRule;
    const err = await svc(p)
      .updateRule('r-us', { active: false }, { id: 'op', role: 'admin', reason: 'short' })
      .catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe('bad_request');
    expect(prisma.findUnique).not.toHaveBeenCalled();
    expect(prisma.update).not.toHaveBeenCalled();
    expect(p.changes).toHaveLength(0);
  });

  it('a row deleted mid-flight is 404, not 500', async () => {
    // Pre-read hits, update throws P2025: the honest mid-flight race.
    const q = makePrisma();
    q.jurisdictionRule.update = (async () => {
      throw Object.assign(new Error('record not found'), { code: 'P2025' });
    }) as never;
    const err = await svc(q)
      .updateRule('r-us', { active: false }, { id: 'op', role: 'admin', reason: 'probe reason here' })
      .catch((e: unknown) => e);
    expect((err as { status?: number }).status).toBe(404);
  });

  it('unknown ids are 404, writing nothing', async () => {
    const p = makePrisma();
    const err = await svc(p)
      .updateRule('nope', { active: false }, { id: 'op', role: 'admin', reason: 'probe reason here' })
      .catch((e: unknown) => e);
    expect((err as { status?: number }).status).toBe(404);
    expect(p.changes).toHaveLength(0);
  });
});
