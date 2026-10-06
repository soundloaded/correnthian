import type {
  Asset,
  AssetCategory,
  CustodyModel,
  TokenStandard,
  VerifiedTier,
} from '@correnthian/types';
import { Prisma } from '../generated/prisma/client.js';
import {
  AssetCategory as PrismaAssetCategory,
  CustodyModel as PrismaCustodyModel,
  TokenStandard as PrismaTokenStandard,
  VerifiedTier as PrismaVerifiedTier,
} from '../generated/prisma/enums.js';

/**
 * Prisma enum values and domain type values are deliberately not identical.
 *
 * Prisma uses snake_case; the domain types use kebab-case and additionally
 * carry a `metal` token standard that has no database equivalent. Mapping in
 * one place — and failing loudly on an unknown value — is what keeps an
 * unrecognised trust tier from silently becoming "verified" upstream.
 */

const VERIFIED_TIER: Record<PrismaVerifiedTier, VerifiedTier> = {
  issuer_verified: 'issuer-verified',
  community_verified: 'community-verified',
  unverified: 'unverified',
};

const TOKEN_STANDARD: Record<PrismaTokenStandard, TokenStandard> = {
  native: 'native',
  erc20: 'erc20',
  bep20: 'bep20',
  btrc20: 'btrc20',
  spl: 'spl',
  other: 'other',
};

const CATEGORY: Record<PrismaAssetCategory, AssetCategory> = {
  crypto: 'crypto',
  stablecoin: 'stablecoin',
  metal: 'metal',
  treasury: 'treasury',
  fund: 'fund',
  other: 'other',
};

/** Decimal columns arrive as Decimal|null; the domain uses number|null. */
const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

export function toDomainAsset(row: Prisma.AssetGetPayload<{ include: { issuer: true } }>): Asset {
  return {
    assetId: row.assetId,
    chainId: row.chainId,
    // '' is the storage sentinel for a native asset; the domain uses null.
    contractAddress: row.contractAddress || null,
    tokenStandard: TOKEN_STANDARD[row.tokenStandard],
    symbol: row.symbol,
    name: row.name,
    decimals: row.decimals,
    issuer: {
      issuerId: row.issuer.slug,
      issuerName: row.issuer.name,
      jurisdiction: row.issuer.jurisdiction,
      licenseRefs: row.issuer.licenseRefs,
    },
    backing: {
      custodyModel: row.custodyModel as unknown as CustodyModel,
      custodian: row.custodian,
      vaultLocation: row.vaultLocations,
      proofOfReserve: row.proofOfReserveUrl,
      attestationCadence: row.attestationCadence,
      lastAttestation: row.lastAttestedAt?.toISOString() ?? null,
      gramsPerToken: num(row.gramsPerToken),
      ouncesPerToken: num(row.ouncesPerToken),
    },
    trust: {
      verifiedTier: VERIFIED_TIER[row.verifiedTier],
      riskFlags: row.riskFlags,
    },
    trading: {
      rails: row.rails,
      transferSupported: row.transferSupported,
      swapSupported: row.swapSupported,
      redeemSupported: row.redeemSupported,
    },
    display: {
      iconSet: row.iconUrl,
      accentColor: row.accentColor,
      category: CATEGORY[row.category],
    },
    enabled: row.enabled,
  };
}
