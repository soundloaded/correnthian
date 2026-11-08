import {
  EvmAdapter,
  QUOTER_V2_ABI,
  amountOutOf,
  bestQuote,
  type UniswapV3FeeTier,
} from '@correnthian/blockchain';
import { Inject, Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service.js';
import { ConfigService } from '../config/config.service.js';

/**
 * What a USDC-to-gold quote is allowed to record: the quoter's `amountOut`
 * and the fee tier that produced it. A reference price does not belong here.
 */
export interface DexQuoteResult {
  amountOut: bigint;
  poolFee: UniswapV3FeeTier;
}

/**
 * QuoterV2 on Ethereum, through `EvmAdapter.readContract` (`eth_call`).
 *
 * The address is `UNISWAP_V3_QUOTER_ETHEREUM`. Unset means this quoter is
 * not configured and `createQuote` keeps the unassigned refusal. A revert
 * on a tier is a skipped tier. Every tier skipped is `null`, which the
 * swap service stores as `executionQuality: 'none'` and a received amount
 * of zero. This class holds no signer.
 */
@Injectable()
export class UniswapV3Quoter {
  readonly configured: boolean;
  private readonly quoterEthereum: `0x${string}` | undefined;

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(BlockchainService) private readonly chains: BlockchainService,
  ) {
    this.quoterEthereum = config.value.uniswap.quoterEthereum;
    this.configured = this.quoterEthereum !== undefined;
  }

  async quote(input: {
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
    amountIn: bigint;
  }): Promise<DexQuoteResult | null> {
    const quoter = this.quoterEthereum;
    if (quoter === undefined) return null;

    try {
      const adapter = await this.chains.forChain('1');
      if (!(adapter instanceof EvmAdapter)) return null;

      const best = await bestQuote(
        {
          quote: async ({ tokenIn, tokenOut, amountIn, fee }) => {
            try {
              const raw = await adapter.readContract({
                address: quoter,
                abi: QUOTER_V2_ABI,
                functionName: 'quoteExactInputSingle',
                args: [
                  {
                    tokenIn,
                    tokenOut,
                    amountIn,
                    fee,
                    sqrtPriceLimitX96: 0n,
                  },
                ],
              });
              return amountOutOf(raw);
            } catch {
              return null;
            }
          },
        },
        input,
      );
      if (best === null) return null;
      return { amountOut: best.amountOut, poolFee: best.fee };
    } catch {
      return null;
    }
  }
}
