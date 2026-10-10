import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../common/errors.js';
import { ProvidersService } from './providers.service.js';

/**
 * ProvidersService with a fake store — batch B gap.
 *
 * Status is a manual override that always stamps `lastCheckedAt`; the
 * scheduled probe owns health through a different service, so this suite
 * asserts the stamp is written here and nowhere else in this file's reach.
 * Unknown slugs are 404, and healthSummary counts by status.
 */
function makePrisma(providers: Record<string, unknown>[]) {
  const bySlug = new Map(providers.map((p) => [p['slug'], { ...p }]));
  const updates: Record<string, unknown>[] = [];
  return {
    updates,
    provider: {
      findMany: vi.fn(async () => [...bySlug.values()].map((p) => ({ ...p }))),
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => bySlug.get(where.slug) ?? null),
      update: vi.fn(async ({ where, data }: { where: { slug: string }; data: Record<string, unknown> }) => {
        const row = bySlug.get(where.slug);
        if (!row) throw Object.assign(new Error('record not found'), { code: 'P2025' });
        updates.push(data);
        Object.assign(row, data);
        return { ...row };
      }),
    },
  };
}

const svc = (p: ReturnType<typeof makePrisma>) => new ProvidersService(p as never);

describe('provider status override', () => {
  it('404s unknown slugs', async () => {
    const err = await svc(makePrisma([])).findBySlug('nope').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
  });

  it('writes status with a fresh lastCheckedAt', async () => {
    const p = makePrisma([{ slug: 'm', status: 'disabled', lastCheckedAt: null }]);
    const before = Date.now();
    const row = await svc(p).setStatus('m', 'active');
    expect(row['status']).toBe('active');
    expect((row['lastCheckedAt'] as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect(Object.keys(p.updates[0] ?? {}).sort()).toEqual(['lastCheckedAt', 'status']);
  });

  it('healthSummary counts by status', async () => {
    const out = await svc(
      makePrisma([
        { slug: 'a', status: 'active' },
        { slug: 'b', status: 'degraded' },
        { slug: 'c', status: 'disabled' },
      ]),
    ).healthSummary();
    expect(out.counts).toEqual({ active: 1, degraded: 1, disabled: 1 });
    expect(out.providers).toHaveLength(3);
  });
});
