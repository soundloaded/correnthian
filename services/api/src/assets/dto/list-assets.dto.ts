import { z } from 'zod';

export const listAssetsSchema = z.object({
  category: z.enum(['crypto', 'stablecoin', 'metal', 'treasury', 'fund', 'other']).optional(),
  chainId: z.string().max(32).optional(),
  issuerId: z.string().max(64).optional(),
  enabled: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListAssetsDto = z.infer<typeof listAssetsSchema>;

export const createAssetSchema = z.object({
  chainId: z.string().min(1).max(32),
  contractAddress: z.string().max(128).nullable().default(null),
  tokenStandard: z.enum(['native', 'erc20', 'bep20', 'btrc20', 'spl', 'other']).default('erc20'),
  symbol: z.string().min(1).max(16),
  name: z.string().min(1).max(120),
  decimals: z.number().int().min(0).max(36),
  category: z.enum(['crypto', 'stablecoin', 'metal', 'treasury', 'fund', 'other']),
  issuerId: z.string().min(1).max(64),

  custodyModel: z.enum(['allocated', 'unallocated', 'synthetic']),
  custodian: z.string().max(160).nullable().default(null),
  vaultLocations: z.array(z.string().max(120)).max(20).default([]),
  proofOfReserveUrl: z.string().url().max(500).nullable().default(null),
  attestationCadence: z.enum(['monthly', 'quarterly', 'annual', 'none']).default('none'),
  lastAttestedAt: z.coerce.date().nullable().default(null),
  ouncesPerToken: z.number().positive().max(1_000_000).nullable().default(null),
  gramsPerToken: z.number().positive().max(1_000_000).nullable().default(null),

  rails: z.array(z.enum(['provider', 'dex', 'cex', 'otc'])).default([]),
  swapSupported: z.boolean().default(false),
  redeemSupported: z.boolean().default(false),
  verifiedTier: z.enum(['issuer_verified', 'community_verified', 'unverified']).default('unverified'),
  accentColor: z.string().max(32).nullable().default(null),
  iconUrl: z.string().url().max(500).nullable().default(null),
});

export type CreateAssetDto = z.infer<typeof createAssetSchema>;
