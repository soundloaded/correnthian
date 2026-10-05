/**
 * Asset identity.
 *
 * INVARIANT: a symbol is never an identity. An asset is identified by the
 * triple (chain, contract, issuer). USDT on Ethereum (ERC-20), on BNB (BEP-20)
 * and on Tron (TRC-20) are three distinct assets and must never collapse into one.
 */
export type ChainId = number | string;
export type TokenStandard = 'native' | 'erc20' | 'bep20' | 'btrc20' | 'spl' | 'metal' | 'other';
export type AssetCategory = 'crypto' | 'stablecoin' | 'metal' | 'treasury' | 'fund' | 'other';
/** How the underlying asset is held on the issuer's side. */
export type CustodyModel = 
/** Each token is backed one-for-one by specific, identified metal. */
'allocated'
/** Backed in aggregate; no specific metal is reserved for the holder. */
 | 'unallocated'
/** No metal backing at all - price exposure only. */
 | 'synthetic';
export type VerifiedTier = 'issuer-verified' | 'community-verified' | 'unverified';
/** Which execution rails can quote and fill this asset. */
export type RailKind = 'provider' | 'dex' | 'cex' | 'otc';
export interface IssuerRef {
    readonly issuerId: string;
    readonly issuerName: string;
    readonly jurisdiction: string;
    readonly licenseRefs: readonly string[];
}
/**
 * The provenance payload. This is the product.
 *
 * It exists so the UI can make an honest claim about what a token represents
 * and who stands behind it. A registry that omits these fields cannot produce
 * the sentence that is Correnthian's entire differentiation in metals.
 */
export interface Backing {
    readonly custodyModel: CustodyModel;
    readonly custodian: string | null;
    readonly vaultLocation: readonly string[];
    readonly proofOfReserve: string | null;
    readonly attestationCadence: 'monthly' | 'quarterly' | 'annual' | 'none';
    readonly lastAttestation: string | null;
    /** grams of metal represented by one whole token, if fixed-denomination. */
    readonly gramsPerToken: number | null;
    /** troy ounces of metal represented by one whole token, if fixed-denomination. */
    readonly ouncesPerToken: number | null;
}
export interface Trust {
    readonly verifiedTier: VerifiedTier;
    readonly riskFlags: readonly string[];
}
export interface TradingCapabilities {
    readonly rails: readonly RailKind[];
    readonly transferSupported: boolean;
    readonly swapSupported: boolean;
    readonly redeemSupported: boolean;
}
export interface AssetDisplay {
    readonly iconSet: string | null;
    readonly accentColor: string | null;
    readonly category: AssetCategory;
}
/**
 * A tradable asset. `assetId` is derived, never hand-assigned, so that the
 * (chain, contract, issuer) triple is guaranteed unique.
 */
export interface Asset {
    readonly assetId: string;
    readonly chainId: ChainId;
    readonly contractAddress: string | null;
    readonly tokenStandard: TokenStandard;
    readonly symbol: string;
    readonly name: string;
    readonly decimals: number;
    readonly issuer: IssuerRef;
    readonly backing: Backing;
    readonly trust: Trust;
    readonly trading: TradingCapabilities;
    readonly display: AssetDisplay;
}
/** The minimum a caller needs to name an asset unambiguously. */
export interface AssetRef {
    readonly chainId: ChainId;
    readonly contractAddress: string | null;
    readonly issuerId: string;
}
//# sourceMappingURL=asset.d.ts.map