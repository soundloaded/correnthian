import { EvmAdapter, type ChainDescriptor } from '@correnthian/blockchain';
import { describe, expect, it, vi } from 'vitest';
import { UniswapV3Quoter } from './uniswap-v3-quoter.js';

/**
 * The quoter address in this file is synthetic. The Ethereum QuoterV2
 * deployment is configuration, read at boot, and is not a literal here.
 */
const QUOTER = `0x${'c'.repeat(40)}` as const;
const TOKEN_IN = '0x1111111111111111111111111111111111111111' as const;
const TOKEN_OUT = '0x2222222222222222222222222222222222222222' as const;

const ethereum: ChainDescriptor = {
  chainId: '1',
  family: 'evm',
  nativeSymbol: 'ETH',
  decimals: 18,
  explorerUrl: null,
  enabled: true,
  isTestnet: false,
};

function harness(
  readContract: ReturnType<typeof vi.fn>,
  options: { quoterEthereum?: `0x${string}` } = { quoterEthereum: QUOTER },
) {
  const adapter = new EvmAdapter(ethereum, [{ url: 'http://127.0.0.1:1' }]);
  vi.spyOn(
    adapter as unknown as {
      read: (
        fn: (client: { readContract: typeof readContract }) => Promise<unknown>,
      ) => Promise<unknown>;
    },
    'read',
  ).mockImplementation(async (fn) => fn({ readContract }));

  const forChain = vi.fn(async () => adapter);
  const quoter = new UniswapV3Quoter(
    { value: { uniswap: { quoterEthereum: options.quoterEthereum } } } as never,
    { forChain } as never,
  );
  return { quoter, forChain, readContract };
}

describe('UniswapV3Quoter', () => {
  it('returns the largest tier and the fee that produced it', async () => {
    const readContract = vi.fn(
      async ({ args }: { args: [{ fee: number }] }) => {
        const fee = args[0]?.fee;
        if (fee === 500) throw new Error('pool missing');
        if (fee === 3000) return [50n, 0n, 0, 21_000n];
        if (fee === 10000) return [40n, 0n, 0, 21_000n];
        throw new Error(`unexpected fee ${fee}`);
      },
    );
    const { quoter, forChain } = harness(readContract);

    await expect(
      quoter.quote({
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        amountIn: 1_000_000n,
      }),
    ).resolves.toEqual({ amountOut: 50n, poolFee: 3000 });

    expect(quoter.configured).toBe(true);
    expect(forChain).toHaveBeenCalledWith('1');
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: QUOTER,
        functionName: 'quoteExactInputSingle',
        args: [
          expect.objectContaining({
            tokenIn: TOKEN_IN,
            tokenOut: TOKEN_OUT,
            amountIn: 1_000_000n,
            fee: 3000,
            sqrtPriceLimitX96: 0n,
          }),
        ],
      }),
    );
  });

  it('returns null when every tier reverts', async () => {
    const readContract = vi.fn(async () => {
      throw new Error('execution reverted');
    });
    const { quoter } = harness(readContract);
    await expect(
      quoter.quote({
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        amountIn: 1_000_000n,
      }),
    ).resolves.toBeNull();
  });

  it('does not call Ethereum when the quoter address is unset', async () => {
    const readContract = vi.fn();
    const { quoter, forChain } = harness(readContract, {});
    expect(quoter.configured).toBe(false);
    await expect(
      quoter.quote({
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        amountIn: 1_000_000n,
      }),
    ).resolves.toBeNull();
    expect(forChain).not.toHaveBeenCalled();
    expect(readContract).not.toHaveBeenCalled();
  });
});
