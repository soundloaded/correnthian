import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../common/errors.js';
import { notionalUsd, parseUsd } from '../fees/money.js';
import { PortfolioService } from './portfolio.service.js';

/**
 * DEF-007 and DEF-008 — one file, two ways of being wrong.
 *
 * DEF-007: a missing wallet threw a bare `Error`, which `AllExceptionsFilter`
 * classifies as internal, so "you asked for something you cannot have" was a
 * 500 and looked like "we are broken".
 *
 * DEF-008: balances were converted with `Number(balanceRaw) / 10 ** decimals`
 * directly beneath a comment forbidding exactly that. `Number()` on an integer
 * above 2^53 silently drops digits — 18-decimal tokens reach that at 0.9 ETH —
 * and the error then multiplies.
 *
 * The extreme case below is deliberately not a realistic portfolio. It is here
 * because it is the smallest input at which the two paths are observably
 * different after rounding: proving exactness needs a value where inexactness
 * is visible, and a realistic balance rounds to the same 8 decimal places
 * either way, which would make a passing test prove nothing.
 */

interface Account {
  assetId: string; // surrogate FK, what PricingService keys on
  balanceRaw: string;
  asset: { assetId: string; symbol: string; name: string; category: string; decimals: number };
}

const prisma = {
  wallet: { findFirst: vi.fn(), findMany: vi.fn() },
  portfolioSnapshot: { create: vi.fn(), findMany: vi.fn() },
};
const pricing = { latestMap: vi.fn() };

const svc = new PortfolioService(prisma as never, pricing as never);

function account(overrides: Partial<Account> = {}): Account {
  return {
    assetId: 'surrogate-1',
    balanceRaw: '1000000',
    asset: { assetId: '1:0x0:gold', symbol: 'XAUT', name: 'Tokenised gold', category: 'metal', decimals: 6 },
    ...overrides,
  };
}

function wallet(accounts: Account[]) {
  return { id: 'wallet-1', accounts };
}

beforeEach(() => {
  prisma.wallet.findFirst.mockReset();
  pricing.latestMap.mockReset().mockResolvedValue({});
});

describe('DEF-007 — a missing wallet is a 404, not a 500', () => {
  it('throws AppError.notFound rather than a bare Error', async () => {
    prisma.wallet.findFirst.mockResolvedValue(null);

    const err = await svc.forWallet('user-1', 'nope').catch((e: unknown) => e);

    // A bare `Error` reaches AllExceptionsFilter as `internal` and maps to 500,
    // which tells an operator the service is broken when they asked for
    // something that is not there.
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
    expect((err as AppError).code).toBe('not_found');
    expect((err as Error).name).not.toBe('Error');
  });

  it('does not leak whether a wallet exists for another user', async () => {
    // findFirst scopes on `{ id, userId }`, so another user's wallet is the
    // same missing wallet — one message, one status, no oracle.
    prisma.wallet.findFirst.mockResolvedValue(null);
    const err = await svc.forWallet('someone-else', 'wallet-1').catch((e: unknown) => e);
    expect((err as AppError).status).toBe(404);
    expect((err as Error).message).toBe('Wallet not found');
  });
});

describe('DEF-008 — balances and totals are exact', () => {
  it('values an 18-decimal balance without going through a float', async () => {
    const balanceRaw = '123456789012345678901234567890'; // > 2^53 raw digits
    prisma.wallet.findFirst.mockResolvedValue(
      wallet([account({ balanceRaw, asset: { ...account().asset, decimals: 18 } })]),
    );
    pricing.latestMap.mockResolvedValue({ 'surrogate-1': 10000 });

    const portfolio = await svc.forWallet('user-1', 'wallet-1');

    // Reference computed with the same integers the fees engine uses, so the
    // assertion is the formula and not a hand-copied literal.
    const expected = notionalUsd(balanceRaw, 18, parseUsd('10000.00000000'));
    expect(portfolio.holdings[0]?.valueUsd).toBe(format(expected));
    expect(portfolio.totalUsd).toBe(format(expected));

    // The float path, for contrast: it disagrees with the formula above.
    const viaFloat = (Number(balanceRaw) / 10 ** 18) * 10000;
    expect(viaFloat.toFixed(8)).not.toBe(format(expected));
  });

  it('reports money as a decimal string, never a JS number', async () => {
    prisma.wallet.findFirst.mockResolvedValue(wallet([account()]));
    pricing.latestMap.mockResolvedValue({ 'surrogate-1': 1234.5678 });

    const portfolio = await svc.forWallet('user-1', 'wallet-1');

    expect(typeof portfolio.totalUsd).toBe('string');
    expect(portfolio.totalUsd).toMatch(/^\d+\.\d{8}$/);
    expect(portfolio.holdings[0]?.valueUsd).toMatch(/^\d+\.\d{8}$/);
    expect(portfolio.holdings[0]?.priceUsd).toBe('1234.56780000');
    expect(Number(portfolio.totalUsd)).toBeCloseTo(1234.5678, 4);
  });

  it('excludes unpriced holdings and counts them rather than zeroing them', async () => {
    prisma.wallet.findFirst.mockResolvedValue(
      wallet([account({ assetId: 'priced' }), account({ assetId: 'stale', balanceRaw: '9999999' })]),
    );
    pricing.latestMap.mockResolvedValue({ priced: 100 }); // 'stale' absent -> unpriced

    const portfolio = await svc.forWallet('user-1', 'wallet-1');

    expect(portfolio.unpricedCount).toBe(1);
    expect(portfolio.holdings).toHaveLength(2);
    // 1 token at $100. The unpriced sibling adds nothing and is counted, not
    // zeroed — a zero would be an assertion that it is worth nothing.
    expect(portfolio.totalUsd).toBe('100.00000000');
    // Both fixtures share a symbol, so select on the value rather than the
    // label: exactly one holding must be unpriced, and it must say so.
    const unpriced = portfolio.holdings.filter((h) => h.valueUsd === null);
    expect(unpriced).toHaveLength(1);
    expect(unpriced[0]?.unpriced).toBe(true);
    expect(unpriced[0]?.balanceRaw).toBe('9999999');
  });

  it('sums combined value exactly rather than reducing floats', async () => {
    prisma.wallet.findMany.mockResolvedValue([{ id: 'w1' }, { id: 'w2' }]);
    prisma.wallet.findFirst.mockImplementation((_args: unknown) => {
      const where = (_args as { where: { id: string } }).where;
      return Promise.resolve(wallet([account({ balanceRaw: where.id === 'w1' ? '333333' : '666667' })]));
    });
    pricing.latestMap.mockResolvedValue({ 'surrogate-1': 1 });

    const combined = await svc.forUser('user-1');

    // 0.333333 + 0.666667 = 1.000000 exactly at a price of $1. Summed as
    // floats the two roundings do not land on a clean boundary, which is the
    // point of adding in Usd instead.
    expect(combined.combinedUsd).toBe('1.00000000');
    expect(combined.wallets).toHaveLength(2);
  });

  it('treats an unrepresentable price as unpriced instead of failing the page', async () => {
    prisma.wallet.findFirst.mockResolvedValue(wallet([account()]));
    pricing.latestMap.mockResolvedValue({ 'surrogate-1': Number.NaN });

    const portfolio = await svc.forWallet('user-1', 'wallet-1');

    expect(portfolio.unpricedCount).toBe(1);
    expect(portfolio.totalUsd).toBe('0.00000000');
    expect(portfolio.holdings[0]?.valueUsd).toBeNull();
  });
});

/** `Usd` is a count of 10^-8; the wire wants the decimal string. */
function format(units: bigint): string {
  const digits = units.toString().padStart(9, '0');
  return `${digits.slice(0, -8)}.${digits.slice(-8)}`;
}
