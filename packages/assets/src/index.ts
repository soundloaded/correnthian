import type { Asset, AssetRef, ChainId } from '@correnthian/types';

/**
 * Derive the canonical asset identifier.
 *
 * Identity is the (chain, contract, issuer) triple. Deriving it in exactly
 * one place is what prevents the same class of bug twice: "we added USDT" and
 * now balances are wrong on one of five networks.
 */
export function deriveAssetId(ref: AssetRef): string {
  const contract = ref.contractAddress?.toLowerCase() ?? 'native';
  return `${ref.chainId}:${contract}:${ref.issuerId}`;
}

export function assetsEqual(a: AssetRef, b: AssetRef): boolean {
  return deriveAssetId(a) === deriveAssetId(b);
}

export function findAsset(registry: readonly Asset[], ref: AssetRef): Asset | undefined {
  const id = deriveAssetId(ref);
  return registry.find((a) => a.assetId === id);
}

/**
 * A tokenized metal must be able to answer "what am I actually holding?"
 * before it is shown to a user as gold. Anything that cannot is a display
 * risk, not a missing field.
 */
export function describeBacking(asset: Asset): string | null {
  const { backing } = asset;
  const metal = asset.display.category === 'metal';
  if (backing.custodyModel === 'synthetic') {
    // Metal keeps the existing sentence. A non-metal must not be called metal.
    return metal
      ? `Price exposure only. No physical metal is held for this token.`
      : `Price exposure only. No physical asset is held for this token.`;
  }
  if (backing.custodyModel === 'unallocated') {
    return metal
      ? 'Backed in aggregate. No specific metal is reserved for the holder.'
      : 'Backed in aggregate. No specific asset is reserved for the holder.';
  }
  const parts: string[] = ['Allocated'];
  if (backing.gramsPerToken) {
    parts.push(metal ? `${backing.gramsPerToken}g of metal per token` : `${backing.gramsPerToken}g per token`);
  }
  if (backing.ouncesPerToken) parts.push(`${backing.ouncesPerToken} troy oz per token`);
  if (backing.custodian) parts.push(`custodied by ${backing.custodian}`);
  if (backing.vaultLocation.length) parts.push(`vaults: ${backing.vaultLocation.join(', ')}`);
  if (backing.lastAttestation) parts.push(`last attested ${backing.lastAttestation}`);
  else parts.push('never attested');
  return parts.join('; ') + '.';
}

/** Guard against registering a chain that was never configured. */
export function assertKnownChain(known: readonly ChainId[], chainId: ChainId): void {
  if (!known.includes(chainId)) {
    throw new Error(`Unconfigured chainId: ${String(chainId)}`);
  }
}
