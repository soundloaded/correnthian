import { describe, expect, it, vi, beforeEach } from 'vitest';
import { deriveAssetId } from '@correnthian/assets';
import { AppError } from '../common/errors.js';
import { SwapsService } from './swaps.service.js';
import { settingDefinition } from '../settings/registry.js';

/**
 * SwapsService with a fake store — batch B gap.
 *
 * Pins the three refusals that make a quote honest (same asset, unknown
 * asset, disabled asset/chain) and the owner-or-operator scoping on detail,
 * including the null-owner fail-closed rule. The fees engine is a stub that
 * returns a fixed breakdown: what is under test is the refusal order and
 * the scoping, not fee math (which has its own specs).
 */
type Row = Record<string, unknown>;

const ASSET_A = { id: 'surr-a', assetId: '1:0xaaa:AAA', symbol: 'AAA', chainId: '1', decimals: 18, enabled: true };
const ASSET_B = { id: 'surr-b', assetId: '1:0xbbb:BBB', symbol: 'BBB', chainId: '1', decimals: 18, enabled: true };

function makePrisma(overrides: { assets?: Row[]; chainEnabled?: boolean; quotes?: Row[] } = {}) {
  const assets = new Map((overrides.assets ?? [ASSET_A, ASSET_B]).map((a) => [a['assetId'], a]));
  const quotes = new Map((overrides.quotes ?? []).map((q) => [q['id'], q]));
  const created: Row[] = [];
  return {
    created,
    asset: {
      findUnique: vi.fn(async ({ where }: { where: { assetId: string } }) => assets.get(where.assetId) ?? null),
    },
    chain: {
      findUnique: vi.fn(async () => ({ id: '1', enabled: overrides.chainEnabled ?? true })),
    },
    assetPrice: {
      findFirst: vi.fn(async () => null),
    },
    swapQuote: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => quotes.get(where.id) ?? null),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { ...data, id: `q${created.length + 1}`, createdAt: new Date() };
        created.push(row);
        return row;
      }),
    },
  };
}

const fees = {
  breakdown: vi.fn(async () => ({
    operation: 'swap', notionalUsd: null, lines: [], totalUsd: '0.00000000',
    knownSubtotalUsd: '0.00000000', complete: true, unknown: [], rulesetVersion: 'test',
  })),
};

/**
 * The settings the service reads. The fake serves the declared default for
 * every key, so this suite exercises the service at the values the platform
 * ships with.
 */
const settings = {
  get: async (key: string) => settingDefinition(key)!.default,
} as never;

beforeEach(() => {
  fees.breakdown.mockClear();
});

const idleQuoter = { configured: false, quote: vi.fn(async () => null) };

/** prepare's dependencies. These tests never call it. */
const prepareDeps = [
  { value: { uniswap: {} } } as never,
  { allowance: async () => 0n } as never,
  {} as never,
] as const;

const svc = (
  p: ReturnType<typeof makePrisma>,
  uniswap: { configured: boolean; quote: ReturnType<typeof vi.fn> } = idleQuoter,
) => new SwapsService(p as never, fees as never, settings, uniswap as never, ...prepareDeps);

const USDC = {
  id: 'surr-usdc',
  assetId: '1:0x1111111111111111111111111111111111111111:circle',
  symbol: 'USDC',
  chainId: '1',
  decimals: 6,
  enabled: true,
  rails: ['dex'],
  contractAddress: '0x1111111111111111111111111111111111111111',
};
const GOLD = {
  id: 'surr-gold',
  assetId: '1:0x2222222222222222222222222222222222222222:paxos',
  symbol: 'PAXG',
  chainId: '1',
  decimals: 18,
  enabled: true,
  rails: ['dex'],
  contractAddress: '0x2222222222222222222222222222222222222222',
};

describe('createQuote refusals', () => {
  it('refuses a conversion to the same asset', async () => {
    const err = await svc(makePrisma()).createQuote({
      userId: 'u1', fromAssetId: ASSET_A.assetId, toAssetId: ASSET_A.assetId, fromAmountRaw: '100',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(400);
  });

  it('refuses unknown assets before touching fees', async () => {
    const p = makePrisma();
    const err = await svc(p).createQuote({
      userId: 'u1', fromAssetId: '9:0x0:NOPE', toAssetId: ASSET_B.assetId, fromAmountRaw: '100',
    }).catch((e: unknown) => e);
    expect((err as AppError).status).toBe(404);
    expect(fees.breakdown).not.toHaveBeenCalled();
  });

  it('refuses disabled assets and disabled chains', async () => {
    const off = { ...ASSET_A, enabled: false };
    const p = makePrisma({ assets: [off, ASSET_B] });
    const err = await svc(p).createQuote({
      userId: 'u1', fromAssetId: off.assetId, toAssetId: ASSET_B.assetId, fromAmountRaw: '100',
    }).catch((e: unknown) => e);
    expect((err as AppError).status).toBe(400);

    const p2 = makePrisma({ chainEnabled: false });
    const err2 = await svc(p2).createQuote({
      userId: 'u1', fromAssetId: ASSET_A.assetId, toAssetId: ASSET_B.assetId, fromAmountRaw: '100',
    }).catch((e: unknown) => e);
    expect((err2 as AppError).status).toBe(400);
  });

  it("takes the quote's lifetime from the setting", async () => {
    // Seven minutes against the one-minute default. The quote is stamped
    // with `expiresAt` at creation, and the expiry sweep reads that stored
    // value.
    const p = makePrisma();
    const longer = new SwapsService(
      p as never,
      fees as never,
      {
        get: async (key: string) =>
          key === 'swaps.quote-ttl-minutes' ? 7 : settingDefinition(key)!.default,
      } as never,
      idleQuoter as never,
      ...prepareDeps,
    );
    const before = Date.now();
    await longer.createQuote({
      userId: 'u1', fromAssetId: ASSET_A.assetId, toAssetId: ASSET_B.assetId, fromAmountRaw: '100',
    });
    const expiresAt = p.created[0]?.['expiresAt'] as Date;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 7 * 60_000);
    expect(expiresAt.getTime()).toBeLessThan(Date.now() + 8 * 60_000);
  });

  it('stores the quote unexecuted with the fee breakdown attached', async () => {
    const p = makePrisma();
    const quote = await svc(p).createQuote({
      userId: 'u1', fromAssetId: ASSET_A.assetId, toAssetId: ASSET_B.assetId, fromAmountRaw: '100',
    });
    expect(p.created).toHaveLength(1);
    expect(p.created[0]?.['toAmountRaw']).toBe('0');
    expect(p.created[0]?.['state']).toBe('quoted');
    expect(quote.id).toBe('q1');
  });
});

describe('Uniswap v3 quotes', () => {
  const request = {
    userId: 'u1',
    fromAssetId: USDC.assetId,
    toAssetId: GOLD.assetId,
    fromAmountRaw: '1000000',
    slippageBps: 50,
  };

  it('stores none with a zero received amount when every tier fails', async () => {
    const quoteFn = vi.fn(async () => null);
    const p = makePrisma({ assets: [USDC, GOLD] });
    const quote = await svc(p, { configured: true, quote: quoteFn }).createQuote(request);
    expect(quote.executionQuality).toBe('none');
    expect(quote.toAmountRaw).toBe('0');
    expect(quote.priceImpactMeasured).toBe(false);
    expect(p.created[0]?.['poolFee']).toBeNull();
    expect(quoteFn).toHaveBeenCalledOnce();
  });

  it('stores a thin quote at the winning fee without claiming a measured impact', async () => {
    const quoteFn = vi.fn(async () => ({ amountOut: 50n, poolFee: 3000 }));
    const p = makePrisma({ assets: [USDC, GOLD] });
    const quote = await svc(p, { configured: true, quote: quoteFn }).createQuote(request);
    expect(quote.executionQuality).toBe('thin');
    expect(quote.priceImpactMeasured).toBe(false);
    expect(quote.priceImpactBps).toBe(0);
    expect(quote.toAmountRaw).toBe('50');
    expect(quote.minReceivedRaw).toBe('49');
    expect(p.created[0]?.['poolFee']).toBe(3000);
    expect(p.created[0]?.['railKind']).toBe('dex');
    expect(p.created[0]?.['railId']).toBe('uniswap-v3');
    expect(quote.executable).toBe(true);
  });

  it('does not call the quoter for a fractional fromAmountRaw', async () => {
    const quoteFn = vi.fn(async () => ({ amountOut: 50n, poolFee: 3000 }));
    const p = makePrisma({ assets: [USDC, GOLD] });
    const quote = await svc(p, { configured: true, quote: quoteFn }).createQuote({
      ...request,
      fromAmountRaw: '1.5',
    });
    expect(quoteFn).not.toHaveBeenCalled();
    expect(quote.executionQuality).toBe('none');
    expect(quote.toAmountRaw).toBe('0');
    expect(quote.priceImpactMeasured).toBe(false);
    expect(p.created[0]?.['poolFee']).toBeNull();
  });
});

describe('findById scoping', () => {
  const QUOTE = {
    id: 'q1', userId: 'u1', railKind: 'provider', railId: 'unassigned',
    fromAmountRaw: '100', toAmountRaw: '0', slippageBps: 50, priceImpactBps: 0,
    minReceivedRaw: '0', fees: {}, executionQuality: 'none', sizeCapUsd: null,
    state: 'quoted', expiresAt: new Date(),
  };
  it('returns the caller own quote', async () => {
    const q = await svc(makePrisma({ quotes: [QUOTE] })).findById('q1', { id: 'u1', role: 'user' });
    expect(q.id).toBe('q1');
  });
  it('a foreign non-operator reads 404, an operator reads fine', async () => {
    const s = svc(makePrisma({ quotes: [QUOTE] }));
    const err = await s.findById('q1', { id: 'u2', role: 'user' }).catch((e: unknown) => e);
    expect((err as AppError).status).toBe(404);
    expect(await s.findById('q1', { id: 'u2', role: 'support' })).toMatchObject({ id: 'q1' });
  });
  it('a null-owner quote is operators-only', async () => {
    const s = svc(makePrisma({ quotes: [{ ...QUOTE, userId: null }] }));
    const err = await s.findById('q1', { id: 'u1', role: 'user' }).catch((e: unknown) => e);
    expect((err as AppError).status).toBe(404);
    expect(await s.findById('q1', { id: 'u1', role: 'admin' })).toMatchObject({ id: 'q1' });
  });
  it('uses the derived asset identity helper consistently', () => {
    // A canary that the suite means the same assetId the service derives:
    // if deriveAssetId changes shape, fixtures must change with it.
    expect(deriveAssetId({ chainId: '1', contractAddress: '0xABC', issuerId: 'mint' })).toBe('1:0xabc:mint');
  });
});
