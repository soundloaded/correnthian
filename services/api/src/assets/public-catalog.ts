import { deriveAssetId } from '@correnthian/assets';
import type { CreateAssetDto } from './dto/list-assets.dto.js';

/**
 * Public mainnet assets the registry may store without a contracted issuer.
 *
 * Every row stays `unverified` and not redeemable. No fee percentage, proof
 * URL, or `issuer_verified` tier is recorded here. Contract, decimals, and
 * issuer names are the public-facts table; `gramsPerToken` on the metals is
 * one fine troy ounce.
 */
export interface PublicCatalogEntry {
  readonly issuer: { readonly slug: string; readonly name: string };
  readonly asset: CreateAssetDto;
}

/** One fine troy ounce, in grams. Shared by PAXG and XAUT. */
const FINE_TROY_OUNCE_GRAMS = 31.1034768;

const publicAsset = {
  chainId: '1',
  tokenStandard: 'erc20',
  custodian: null,
  vaultLocations: [],
  proofOfReserveUrl: null,
  attestationCadence: 'none',
  lastAttestedAt: null,
  rails: ['dex'],
  swapSupported: true,
  redeemSupported: false,
  verifiedTier: 'unverified',
  accentColor: null,
  iconUrl: null,
} as const satisfies Partial<CreateAssetDto>;

export const PUBLIC_CATALOG: readonly PublicCatalogEntry[] = [
  {
    issuer: { slug: 'paxos', name: 'Paxos Trust Company, LLC' },
    asset: {
      ...publicAsset,
      contractAddress: '0x45804880De22913dAFE09f4980848ECE6EcbAf78',
      symbol: 'PAXG',
      name: 'PAX Gold',
      decimals: 18,
      category: 'metal',
      issuerId: 'paxos',
      custodyModel: 'allocated',
      ouncesPerToken: 1,
      gramsPerToken: FINE_TROY_OUNCE_GRAMS,
    },
  },
  {
    issuer: { slug: 'tg-commodities', name: 'TG Commodities Limited' },
    asset: {
      ...publicAsset,
      contractAddress: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
      symbol: 'XAUT',
      name: 'Tether Gold',
      decimals: 6,
      category: 'metal',
      issuerId: 'tg-commodities',
      custodyModel: 'allocated',
      ouncesPerToken: 1,
      gramsPerToken: FINE_TROY_OUNCE_GRAMS,
    },
  },
  {
    issuer: { slug: 'circle', name: 'Circle' },
    asset: {
      ...publicAsset,
      contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      category: 'stablecoin',
      issuerId: 'circle',
      // Not allocated metal. Aggregate dollar reserves, and not a verification.
      custodyModel: 'unallocated',
      ouncesPerToken: null,
      gramsPerToken: null,
    },
  },
];

/** Canonical id: chain, lowercase contract, issuer slug. */
export function catalogAssetId(entry: PublicCatalogEntry): string {
  return deriveAssetId({
    chainId: entry.asset.chainId,
    contractAddress: entry.asset.contractAddress,
    issuerId: entry.issuer.slug,
  });
}
