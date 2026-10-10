import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../common/errors.js';
import { ChainsService } from './chains.service.js';

/**
 * ChainsService with a fake store — batch B gap.
 *
 * The one property that matters here is structural: no read may select
 * `rpcUrls`, and the suite asserts on the select keys themselves rather
 * than on data that happens to lack the field. Unknown chains are 404;
 * setEnabled writes the flag and returns the row through the same
 * projection as a read.
 */
const SELECT_KEYS = ['id', 'name', 'family', 'nativeSymbol', 'decimals', 'explorerUrl', 'enabled', 'isTestnet'];

function makePrisma(seed: Record<string, unknown> | null) {
  const calls: Record<string, unknown>[] = [];
  let current = seed ? { ...seed } : null;
  return {
    calls,
    chain: {
      findMany: vi.fn(async (args: Record<string, unknown>) => {
        calls.push(args);
        return [];
      }),
      // Reads see prior writes, like the real row: setEnabled's findById
      // must observe the update or the fake would lie about the write.
      findUnique: vi.fn(async () => (current ? { ...current } : null)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        current = { ...current, ...data };
        return { ...current };
      }),
    },
  };
}

const svc = (p: ReturnType<typeof makePrisma>) => new ChainsService(p as never);

describe('chain reads never project rpcUrls', () => {
  it('list selects without rpcUrls', async () => {
    const p = makePrisma(null);
    await svc(p).list();
    const select = (p.calls[0]?.['select'] ?? {}) as Record<string, unknown>;
    expect(Object.keys(select).sort()).toEqual([...SELECT_KEYS, '_count'].sort());
    expect(select).not.toHaveProperty('rpcUrls');
  });

  it('findById 404s unknown chains', async () => {
    const err = await svc(makePrisma(null)).findById('999').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
  });

  it('setEnabled writes the flag and returns the projected row', async () => {
    const p = makePrisma({ id: '1', enabled: false });
    const row = await svc(p).setEnabled('1', true);
    expect(row).toMatchObject({ id: '1', enabled: true });
    expect(row).not.toHaveProperty('rpcUrls');
  });
});
