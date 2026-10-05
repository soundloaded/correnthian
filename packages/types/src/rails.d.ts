import type { AssetRef } from './asset.js';
/**
 * Why executionQuality and sizeCap exist.
 *
 * Tokenized gold liquidity is thin on-chain and deep only on custodial
 * venues. A quote engine that cannot say "this size is not available" will
 * happily quote a price it cannot fill. These two fields make honest failure
 * representable in the type, so the UI is forced to disclose it rather than
 * a marketing promise being trusted for it.
 */
export type ExecutionQuality = 
/** Full size quoted and fillable. */
'deep'
/** Fillable, but above this size quality degrades - UI must say so. */
 | 'thin'
/** No two-sided liquidity. */
 | 'none';
export interface QuoteFee {
    readonly label: string;
    /** Always explicit. Correnthian never earns by mispricing an asset. */
    readonly amountUsd: number;
    readonly kind: 'provider' | 'network' | 'correnthian';
}
export interface SwapQuote {
    readonly quoteId: string;
    readonly from: AssetRef;
    readonly to: AssetRef;
    readonly fromAmount: string;
    readonly toAmount: string;
    readonly priceImpactBps: number;
    readonly slippageBps: number;
    readonly minimumReceived: string;
    readonly fees: readonly QuoteFee[];
    readonly executionQuality: ExecutionQuality;
    /** Largest amount this rail can fill at this price, in USD notional. */
    readonly sizeCapUsd: number | null;
    readonly expiresAt: string;
    readonly railKind: 'provider' | 'dex' | 'cex' | 'otc';
}
export interface SwapStatus {
    readonly quoteId: string;
    readonly state: 'quoted' | 'awaiting-payment' | 'broadcast' | 'settled' | 'failed';
    readonly txHash: string | null;
    readonly failureReason: string | null;
}
//# sourceMappingURL=rails.d.ts.map