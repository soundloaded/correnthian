import { describe, expect, it } from 'vitest';
import {
  decodeFunctionData,
  decodeFunctionResult,
  encodeFunctionResult,
} from 'viem';
import {
  QUOTER_V2_ABI,
  amountOutOf,
  bestAmountOut,
  encodeErc20Approve,
  encodeExactInputSingle,
  encodeQuoteExactInputSingle,
  type QuoteExactInput,
} from '../uniswap-v3.js';

/**
 * QuoterV2 `quoteExactInputSingle` takes one struct. The fee sits after
 * `amountIn` in that struct — the older flat Quoter signature does not.
 * Decoding with the published struct is what would fail if those two were
 * swapped. The selector below is viem's, pinned after this test printed it.
 */
const QUOTER_V2_SINGLE = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

const TOKEN_IN = '0x1111111111111111111111111111111111111111' as const;
const TOKEN_OUT = '0x2222222222222222222222222222222222222222' as const;

const INPUT = {
  tokenIn: TOKEN_IN,
  tokenOut: TOKEN_OUT,
  amountIn: 1_000_000n,
};

describe('encodeQuoteExactInputSingle', () => {
  it('encodes quoteExactInputSingle for a fixed pair and is stable', () => {
    const args = {
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      fee: 3000,
      amountIn: 1_000_000n,
      sqrtPriceLimitX96: 0n as const,
    };
    const first = encodeQuoteExactInputSingle(args);
    const second = encodeQuoteExactInputSingle(args);
    expect(first).toBe(second);

    // Pinned from viem's encoding of QuoterV2.quoteExactInputSingle, printed
    // by this test as 0xc6a5026a before the literal was asserted.
    expect(first.slice(0, 10)).toBe('0xc6a5026a');

    const decoded = decodeFunctionData({ abi: QUOTER_V2_SINGLE, data: first });
    expect(decoded.functionName).toBe('quoteExactInputSingle');
    expect(decoded.args[0]).toMatchObject({
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      amountIn: 1_000_000n,
      fee: 3000,
      sqrtPriceLimitX96: 0n,
    });
  });
});

describe('amountOutOf', () => {
  it('reads amountOut from the decoded QuoterV2 return and drops zero', () => {
    const data = encodeFunctionResult({
      abi: QUOTER_V2_ABI,
      functionName: 'quoteExactInputSingle',
      result: [50n, 1n, 2, 3n],
    });
    const decoded = decodeFunctionResult({
      abi: QUOTER_V2_ABI,
      functionName: 'quoteExactInputSingle',
      data,
    });
    expect(amountOutOf(decoded)).toBe(50n);

    const zero = encodeFunctionResult({
      abi: QUOTER_V2_ABI,
      functionName: 'quoteExactInputSingle',
      result: [0n, 1n, 0, 0n],
    });
    expect(
      amountOutOf(
        decodeFunctionResult({
          abi: QUOTER_V2_ABI,
          functionName: 'quoteExactInputSingle',
          data: zero,
        }),
      ),
    ).toBe(null);
  });
});

describe('bestAmountOut', () => {
  it('picks the largest tier and ignores reverts', async () => {
    const quoter: QuoteExactInput = {
      quote: async ({ fee }) => (fee === 500 ? null : fee === 3000 ? 10n : 4n),
    };
    expect(await bestAmountOut(quoter, INPUT)).toBe(10n);
  });

  it('returns null when every tier fails', async () => {
    const quoter: QuoteExactInput = { quote: async () => null };
    expect(await bestAmountOut(quoter, INPUT)).toBe(null);
  });

  it('skips a zero amountOut', async () => {
    const quoter: QuoteExactInput = {
      quote: async ({ fee }) => (fee === 3000 ? 0n : fee === 10000 ? 4n : null),
    };
    expect(await bestAmountOut(quoter, INPUT)).toBe(4n);
  });
});

/**
 * SwapRouter02 `exactInputSingle` takes one struct and has no deadline.
 * That field belongs to the older SwapRouter. Decoding with this struct is
 * what fails if the fee and the minimum are swapped.
 */
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

const ROUTER = '0x3333333333333333333333333333333333333333' as const;
const RECIPIENT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;

describe('encodeExactInputSingle', () => {
  it('encodes SwapRouter02 exactInputSingle for the quote fee and minimum', () => {
    const data = encodeExactInputSingle({
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      fee: 3000,
      recipient: RECIPIENT,
      amountIn: 1_000_000n,
      amountOutMinimum: 49n,
      sqrtPriceLimitX96: 0n,
    });
    expect(data).toBe(encodeExactInputSingle({
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      fee: 3000,
      recipient: RECIPIENT,
      amountIn: 1_000_000n,
      amountOutMinimum: 49n,
      sqrtPriceLimitX96: 0n,
    }));
    const decoded = decodeFunctionData({ abi: EXACT_INPUT_SINGLE, data });
    expect(decoded.functionName).toBe('exactInputSingle');
    const params = decoded.args[0];
    expect(params.tokenIn.toLowerCase()).toBe(TOKEN_IN);
    expect(params.tokenOut.toLowerCase()).toBe(TOKEN_OUT);
    expect(params.recipient.toLowerCase()).toBe(RECIPIENT);
    expect(params.fee).toBe(3000);
    expect(params.amountIn).toBe(1_000_000n);
    expect(params.amountOutMinimum).toBe(49n);
    expect(params.sqrtPriceLimitX96).toBe(0n);
  });
});

describe('encodeErc20Approve', () => {
  it('encodes approve for the router and the amount', () => {
    const data = encodeErc20Approve(ROUTER, 1_000_000n);
    const decoded = decodeFunctionData({ abi: APPROVE, data });
    expect(decoded.functionName).toBe('approve');
    expect(decoded.args[0].toLowerCase()).toBe(ROUTER);
    expect(decoded.args[1]).toBe(1_000_000n);
  });
});
