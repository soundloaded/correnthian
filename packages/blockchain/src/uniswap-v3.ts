import { encodeFunctionData, erc20Abi } from 'viem';

/**
 * Uniswap v3 fee tiers, in the order they are tried. A quote keeps the
 * tier that returned the largest positive `amountOut`.
 */
export const UNISWAP_V3_FEE_TIERS = [500, 3000, 10000] as const;

export type UniswapV3FeeTier = (typeof UNISWAP_V3_FEE_TIERS)[number];

/**
 * QuoterV2.`quoteExactInputSingle`, as published in IQuoterV2.
 *
 * The function is not `view`. It simulates a swap and reverts that inner
 * call, then returns the decoded amounts. An `eth_call` still receives the
 * outer return. The deployment address is configuration, not a literal:
 * an operator sets `UNISWAP_V3_QUOTER_ETHEREUM`.
 */
export const QUOTER_V2_ABI = [
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

export function encodeQuoteExactInputSingle(args: {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  fee: number;
  amountIn: bigint;
  sqrtPriceLimitX96: 0n;
}): `0x${string}` {
  return encodeFunctionData({
    abi: QUOTER_V2_ABI,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        tokenIn: args.tokenIn,
        tokenOut: args.tokenOut,
        amountIn: args.amountIn,
        fee: args.fee,
        sqrtPriceLimitX96: args.sqrtPriceLimitX96,
      },
    ],
  });
}

export interface QuoteExactInput {
  quote(input: {
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
    amountIn: bigint;
    fee: number;
  }): Promise<bigint | null>;
}

/**
 * The winning tier, not only its amount. `bestAmountOut` is the amount
 * half of this. Callers that must store `poolFee` use the pair, so the
 * tier is not discovered a second time.
 */
export async function bestQuote(
  quoter: QuoteExactInput,
  input: { tokenIn: `0x${string}`; tokenOut: `0x${string}`; amountIn: bigint },
): Promise<{ amountOut: bigint; fee: UniswapV3FeeTier } | null> {
  let best: { amountOut: bigint; fee: UniswapV3FeeTier } | null = null;
  for (const fee of UNISWAP_V3_FEE_TIERS) {
    const amountOut = await quoter.quote({ ...input, fee });
    if (amountOut === null || amountOut <= 0n) continue;
    if (best === null || amountOut > best.amountOut) best = { amountOut, fee };
  }
  return best;
}

export async function bestAmountOut(
  quoter: QuoteExactInput,
  input: { tokenIn: `0x${string}`; tokenOut: `0x${string}`; amountIn: bigint },
): Promise<bigint | null> {
  const best = await bestQuote(quoter, input);
  return best === null ? null : best.amountOut;
}

/**
 * SwapRouter02 `exactInputSingle`. The struct has no deadline; that field
 * belongs to the older SwapRouter. The deployment address is configuration
 * (`UNISWAP_V3_ROUTER_ETHEREUM`), not a literal in this package.
 */
export const SWAP_ROUTER_02_EXACT_INPUT_ABI = [
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

export function encodeExactInputSingle(args: {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  fee: UniswapV3FeeTier;
  recipient: `0x${string}`;
  amountIn: bigint;
  amountOutMinimum: bigint;
  sqrtPriceLimitX96: 0n;
}): `0x${string}` {
  return encodeFunctionData({
    abi: SWAP_ROUTER_02_EXACT_INPUT_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: args.tokenIn,
        tokenOut: args.tokenOut,
        fee: args.fee,
        recipient: args.recipient,
        amountIn: args.amountIn,
        amountOutMinimum: args.amountOutMinimum,
        sqrtPriceLimitX96: args.sqrtPriceLimitX96,
      },
    ],
  });
}

/** ERC-20 `approve`. The spender for a swap is the router, from configuration. */
export function encodeErc20Approve(spender: `0x${string}`, amount: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
  });
}

/**
 * `amountOut` from a QuoterV2 return. viem hands back a named tuple; a
 * bare array is the same four words. Zero is not a quote.
 */
export function amountOutOf(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value > 0n ? value : null;
  if (Array.isArray(value)) return amountOutOf(value[0]);
  if (typeof value === 'object' && value !== null && 'amountOut' in value) {
    return amountOutOf((value as { amountOut: unknown }).amountOut);
  }
  return null;
}
