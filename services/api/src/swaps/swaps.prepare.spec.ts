import { decodeFunctionData } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../common/errors.js';
import { settingDefinition } from '../settings/registry.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { SwapsService } from './swaps.service.js';

/**
 * Preparing a thin Uniswap quote files the calls the device will sign.
 *
 * Allowance is a port. This suite stubs it, so the test never reads a node
 * and never learns an RPC URL. The server does not sign: the only chain
 * call is `buildTransaction`, which returns an unsigned payload.
 */

const WALLET_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TOKEN_IN = '0x1111111111111111111111111111111111111111';
const TOKEN_OUT = '0x2222222222222222222222222222222222222222';
const ROUTER = '0x3333333333333333333333333333333333333333';

const USDC = {
  id: 'asset-usdc',
  assetId: '1:0x1111111111111111111111111111111111111111:circle',
  symbol: 'USDC',
  chainId: '1',
  decimals: 6,
  enabled: true,
  transferSupported: true,
  contractAddress: TOKEN_IN,
};
const GOLD = {
  id: 'asset-gold',
  assetId: '1:0x2222222222222222222222222222222222222222:paxos',
  symbol: 'PAXG',
  chainId: '1',
  decimals: 18,
  enabled: true,
  transferSupported: true,
  contractAddress: TOKEN_OUT,
};

const WALLET = {
  id: 'w1',
  userId: 'u1',
  address: WALLET_ADDRESS,
  chainId: '1',
  chain: { id: '1', family: 'evm' as const, enabled: true, nativeSymbol: 'ETH' },
};

const EXACT_INPUT_SINGLE = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

const APPROVE = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

function quote(over: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    userId: 'u1',
    railKind: 'dex',
    railId: 'uniswap-v3',
    chainId: '1',
    fromAssetId: USDC.id,
    toAssetId: GOLD.id,
    fromAmountRaw: '1000000',
    toAmountRaw: '50',
    minReceivedRaw: '49',
    executionQuality: 'thin',
    poolFee: 3000,
    expiresAt: new Date(Date.now() + 60_000),
    fromAsset: USDC,
    toAsset: GOLD,
    ...over,
  };
}

function makePrisma(rows: Record<string, unknown>[]) {
  const quotes = new Map(rows.map((row) => [row['id'] as string, row]));
  const txs = new Map<string, Record<string, unknown>>();
  let n = 0;
  const assets = new Map<string, typeof USDC>();
  for (const asset of [USDC, GOLD]) {
    assets.set(asset.id, asset);
    assets.set(asset.assetId, asset);
  }
  return {
    txs,
    swapQuote: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => quotes.get(where.id) ?? null),
    },
    wallet: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === WALLET.id ? WALLET : null,
      ),
    },
    asset: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; assetId?: string } }) => {
        if (where.id) return assets.get(where.id) ?? null;
        if (where.assetId) return assets.get(where.assetId) ?? null;
        return null;
      }),
    },
    transaction: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        n += 1;
        const row = {
          txHash: null,
          blockNumber: null,
          state: 'created',
          userId: 'u1',
          ...data,
          id: `tx${n}`,
        };
        txs.set(row.id, row);
        return { ...row };
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = txs.get(where.id);
        return row ? { ...row } : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = txs.get(where.id);
        if (!row) throw new Error('record not found');
        Object.assign(row, data);
        return { ...row };
      }),
      deleteMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
        for (const id of where.id.in) txs.delete(id);
        return { count: where.id.in.length };
      }),
      findMany: vi.fn(async (args?: {
        where?: { userId?: string; walletId?: string; state?: string; metadata?: { equals?: string } };
      }) => {
        const quoteId = args?.where?.metadata?.equals;
        return [...txs.values()].filter((row) => {
          const meta = row['metadata'] as { quoteId?: string } | undefined;
          if (args?.where?.userId && row['userId'] !== args.where.userId) return false;
          if (args?.where?.walletId && row['walletId'] !== args.where.walletId) return false;
          if (args?.where?.state && row['state'] !== args.where.state) return false;
          if (quoteId && meta?.quoteId !== quoteId) return false;
          return true;
        });
      }),
    },
  };
}

const settings = {
  get: async (key: string) => settingDefinition(key)!.default,
} as never;

const audit = {
  record: vi.fn().mockResolvedValue(undefined),
  recordChange: vi.fn().mockResolvedValue({ before: {}, after: {}, changed: [] }),
};

function harness(options: {
  rows?: Record<string, unknown>[];
  allowance?: bigint;
  router?: `0x${string}`;
} = {}) {
  const prisma = makePrisma(options.rows ?? [quote()]);
  const allowance = {
    allowance: vi.fn(async () => options.allowance ?? 0n),
  };
  const adapter = {
    assemblePayload: vi.fn(),
    buildTransaction: vi.fn(async (req: { to: string; value?: string; data?: string; nonce?: number }) => ({
      to: req.to,
      value: req.value ?? '0',
      data: req.data ?? '0x',
      chainId: 1,
      gas: '100000',
      // Pending count when the server does not assign one. A supplied nonce
      // is the next call in the same prepare, which the node has not seen.
      nonce: req.nonce ?? 7,
      maxFeePerGas: '2',
      maxPriorityFeePerGas: '1',
    })),
    broadcastTransaction: vi.fn(async () => {
      throw new Error('the server must not broadcast from prepare');
    }),
    decodeSignedTransaction: vi.fn(async () => {
      throw new Error('the server must not decode a signature from prepare');
    }),
    signTransaction: vi.fn(async () => {
      throw new Error('the server must not sign');
    }),
  };
  const blockchain = { forChain: vi.fn(async () => adapter) };
  const transactions = new TransactionsService(
    prisma as never,
    audit as never,
    blockchain as never,
    settings,
  );
  const config = {
    value: { uniswap: { routerEthereum: options.router } },
  };
  const swaps = new SwapsService(
    prisma as never,
    {} as never,
    settings,
    { configured: true, quote: vi.fn() } as never,
    config as never,
    allowance as never,
    transactions as never,
  );
  return { prisma, allowance, adapter, swaps };
}

describe('prepare a device-signed swap', () => {
  beforeEach(() => {
    audit.record.mockClear();
  });

  it('returns approve then swap when the allowance is zero, and does not sign', async () => {
    const { swaps, allowance, adapter, prisma } = harness({ allowance: 0n, router: ROUTER });
    const prepared = await swaps.prepare('q1', 'u1', 'w1');

    expect(prepared.quoteId).toBe('q1');
    expect(prepared.transactions.map((tx) => tx.kind)).toEqual(['approve', 'swap']);
    expect(allowance.allowance).toHaveBeenCalledWith(TOKEN_IN, WALLET_ADDRESS, ROUTER);
    expect(adapter.broadcastTransaction).not.toHaveBeenCalled();
    expect(adapter.decodeSignedTransaction).not.toHaveBeenCalled();
    expect(adapter.signTransaction).not.toHaveBeenCalled();

    const approve = prepared.transactions[0]!;
    const swap = prepared.transactions[1]!;
    expect(approve.unsigned.value).toBe('0');
    expect(swap.unsigned.value).toBe('0');
    expect(swap.unsigned.to.toLowerCase()).toBe(ROUTER);

    const approved = decodeFunctionData({ abi: APPROVE, data: approve.unsigned.data as `0x${string}` });
    expect(approved.functionName).toBe('approve');
    expect(approved.args[0].toLowerCase()).toBe(ROUTER);
    expect(approved.args[1]).toBe(1_000_000n);

    const decoded = decodeFunctionData({
      abi: EXACT_INPUT_SINGLE,
      data: swap.unsigned.data as `0x${string}`,
    });
    expect(decoded.functionName).toBe('exactInputSingle');
    expect(decoded.args[0]).toMatchObject({
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      fee: 3000,
      amountIn: 1_000_000n,
      amountOutMinimum: 49n,
      sqrtPriceLimitX96: 0n,
    });
    expect(decoded.args[0].recipient.toLowerCase()).toBe(WALLET_ADDRESS);

    const stored = prisma.txs.get(swap.id)?.['metadata'] as {
      build?: { payload?: { to: string; value: string; data: string } };
    };
    expect(stored.build?.payload).toEqual({
      to: swap.unsigned.to,
      value: '0',
      data: swap.unsigned.data,
    });
  });

  it('the approve nonce and the swap nonce differ by one, and the client does not supply the nonce', async () => {
    const { swaps, adapter } = harness({ allowance: 0n, router: ROUTER });
    const prepared = await swaps.prepare('q1', 'u1', 'w1');
    const approve = prepared.transactions[0]!;
    const swap = prepared.transactions[1]!;

    expect(approve.unsigned.nonce).toBe(7);
    expect(swap.unsigned.nonce).toBe(approve.unsigned.nonce! + 1);

    const calls = adapter.buildTransaction.mock.calls.map(
      (call) => call[0] as { nonce?: number },
    );
    expect(calls[0]?.nonce).toBeUndefined();
    expect(calls[1]?.nonce).toBe(approve.unsigned.nonce! + 1);
  });

  it('estimates the swap against the approve, and writes nothing when that estimate fails', async () => {
    const { swaps, adapter, prisma } = harness({ allowance: 0n, router: ROUTER });
    const prepared = await swaps.prepare('q1', 'u1', 'w1');
    const approve = prepared.transactions[0]!;
    const swap = prepared.transactions[1]!;

    expect(approve.unsigned.nonce).toBe(7);
    expect(swap.unsigned.nonce).toBe(approve.unsigned.nonce! + 1);

    const calls = adapter.buildTransaction.mock.calls.map(
      (call) => call[0] as { to: string; data: string; nonce?: number; priorCalls?: Array<{ to: string; data: string; value?: string }> },
    );
    expect(calls[0]?.nonce).toBeUndefined();
    expect(calls[1]?.nonce).toBe(8);
    expect(calls[1]?.priorCalls).toEqual([
      { to: calls[0]?.to, data: calls[0]?.data, value: '0' },
    ]);
    const approved = decodeFunctionData({
      abi: APPROVE,
      data: calls[1]!.priorCalls![0]!.data as `0x${string}`,
    });
    expect(approved.functionName).toBe('approve');
    expect(approved.args[1]).toBe(1_000_000n);

    adapter.buildTransaction.mockImplementation(async (req: { priorCalls?: unknown; nonce?: number; to: string; value?: string; data?: string }) => {
      if (req.priorCalls) throw new Error('execution reverted');
      return {
        to: req.to,
        value: req.value ?? '0',
        data: req.data ?? '0x',
        chainId: 1,
        gas: '100000',
        nonce: req.nonce ?? 7,
        maxFeePerGas: '2',
        maxPriorityFeePerGas: '1',
      };
    });
    prisma.txs.clear();
    prisma.transaction.create.mockClear();

    const err = await swaps.prepare('q1', 'u1', 'w1').catch((caught: unknown) => caught);
    expect(err).toBeInstanceOf(AppError);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.txs.size).toBe(0);
  });

  it('refuses a quote that has already expired and writes no transaction', async () => {
    const { swaps, prisma } = harness({
      router: ROUTER,
      rows: [quote({ expiresAt: new Date(Date.now() - 1_000) })],
    });
    const err = await swaps.prepare('q1', 'u1', 'w1').catch((caught: unknown) => caught);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 400, message: 'This quote is not executable' });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.txs.size).toBe(0);
  });

  it('does not write a transaction when the quote is not executable', async () => {
    const { swaps, prisma } = harness({
      router: ROUTER,
      rows: [quote({ id: 'q-none', executionQuality: 'none', toAmountRaw: '0', minReceivedRaw: '0', poolFee: null })],
    });
    const err = await swaps.prepare('q-none', 'u1', 'w1').catch((caught: unknown) => caught);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).message).toMatch(/not executable/i);
    expect(prisma.txs.size).toBe(0);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('refuses to prepare when the router is unset, and the message has no URL', async () => {
    const { swaps, prisma } = harness({ router: undefined });
    const err = await swaps.prepare('q1', 'u1', 'w1').catch((caught: unknown) => caught);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 503, code: 'provider_unavailable' });
    expect((err as AppError).message).not.toMatch(/https?:|www\./i);
    expect(prisma.txs.size).toBe(0);
  });

  it('returns the same unsigned pair when prepare is repeated, and does not estimate again', async () => {
    const { swaps, adapter, prisma } = harness({ allowance: 0n, router: ROUTER });
    const first = await swaps.prepare('q1', 'u1', 'w1');
    const estimates = adapter.buildTransaction.mock.calls.length;
    const writes = prisma.transaction.create.mock.calls.length;

    const second = await swaps.prepare('q1', 'u1', 'w1');

    expect(second.transactions.map((tx) => tx.id)).toEqual(first.transactions.map((tx) => tx.id));
    expect(second.transactions.map((tx) => tx.kind)).toEqual(['approve', 'swap']);
    expect(second.transactions.map((tx) => tx.unsigned)).toEqual(first.transactions.map((tx) => tx.unsigned));
    expect(adapter.buildTransaction.mock.calls.length).toBe(estimates);
    expect(prisma.transaction.create.mock.calls.length).toBe(writes);
    expect(prisma.txs.size).toBe(2);
  });

  it('refuses a second prepare after the pair has been signed, and files nothing new', async () => {
    const { swaps, prisma } = harness({ allowance: 0n, router: ROUTER });
    const first = await swaps.prepare('q1', 'u1', 'w1');
    for (const tx of first.transactions) {
      const row = prisma.txs.get(tx.id);
      if (row) row['state'] = 'signed';
    }
    const writes = prisma.transaction.create.mock.calls.length;

    const err = await swaps.prepare('q1', 'u1', 'w1').catch((caught: unknown) => caught);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 409, code: 'conflict' });
    expect(prisma.transaction.create.mock.calls.length).toBe(writes);
    expect(prisma.txs.size).toBe(2);
  });

  it('returns only the swap when the wallet already allowed the router', async () => {
    const { swaps, adapter } = harness({ allowance: 1_000_000n, router: ROUTER });
    const prepared = await swaps.prepare('q1', 'u1', 'w1');
    expect(prepared.transactions.map((tx) => tx.kind)).toEqual(['swap']);
    expect(adapter.signTransaction).not.toHaveBeenCalled();
  });

  it('tells a stranger nothing and writes no transaction', async () => {
    const { swaps, prisma } = harness({ router: ROUTER });
    const err = await swaps.prepare('q1', 'u2', 'w1').catch((caught: unknown) => caught);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
    expect(prisma.txs.size).toBe(0);
  });
});
