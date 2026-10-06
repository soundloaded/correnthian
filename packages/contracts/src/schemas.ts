import { z } from 'zod';

/**
 * Wire-format contracts.
 *
 * These exist because of a specific, repeated failure: the admin declared its
 * own TypeScript interfaces for API responses, nothing compared the two, and
 * every mismatch surfaced as a runtime bug in a browser rather than a build
 * failure. It cost three separate incidents — portfolio valuation reading
 * zero, the assets page 500ing on `issuerName`, and the disable button
 * rendering with an inverted label because `enabled` was never returned.
 *
 * The schema is the single source of truth for what goes over the wire. The
 * API validates its responses against it; clients infer their types from it.
 * If either side drifts, a test fails instead of a page breaking.
 *
 * Response envelopes are modelled exactly as the API returns them — including
 * wrappers like `{ asset, disclosure }`, which is where the drift hid.
 */

// --- shared primitives -----------------------------------------------------

export const kycStatusSchema = z.enum(['not_started', 'pending', 'approved', 'rejected', 'expired']);
export const userRoleSchema = z.enum(['user', 'support', 'compliance', 'admin', 'owner']);
export const custodyModelSchema = z.enum(['allocated', 'unallocated', 'synthetic']);
export const verifiedTierSchema = z.enum(['issuer-verified', 'community-verified', 'unverified']);

export const disclosureSchema = z.string().min(1);

// --- assets ----------------------------------------------------------------

export const assetSummarySchema = z.object({
  asset: z.object({
    assetId: z.string().min(1),
    chainId: z.union([z.string(), z.number()]),
    contractAddress: z.string().nullable(),
    symbol: z.string().min(1),
    name: z.string(),
    decimals: z.number().int().min(0),
    issuer: z.object({
      issuerId: z.string(),
      issuerName: z.string(),
      jurisdiction: z.string(),
      licenseRefs: z.array(z.string()),
    }),
    backing: z.object({
      custodyModel: custodyModelSchema,
      custodian: z.string().nullable(),
      vaultLocation: z.array(z.string()),
      proofOfReserve: z.string().nullable(),
      attestationCadence: z.enum(['monthly', 'quarterly', 'annual', 'none']),
      lastAttestation: z.string().nullable(),
      gramsPerToken: z.number().nullable(),
      ouncesPerToken: z.number().nullable(),
    }),
    trust: z.object({
      verifiedTier: verifiedTierSchema,
      riskFlags: z.array(z.string()),
    }),
    trading: z.object({
      rails: z.array(z.enum(['provider', 'dex', 'cex', 'otc'])),
      transferSupported: z.boolean(),
      swapSupported: z.boolean(),
      redeemSupported: z.boolean(),
    }),
    display: z.object({
      iconSet: z.string().nullable(),
      accentColor: z.string().nullable(),
      category: z.string(),
    }),
    /** Required: the admin toggles it, and its absence inverts a destructive button. */
    enabled: z.boolean(),
  }),
  disclosure: disclosureSchema,
});

export const assetListSchema = z.array(assetSummarySchema);

export const assetStatsSchema = z.object({
  total: z.number(),
  enabled: z.number(),
  enabledMetals: z.number(),
  staleAttestations: z.number(),
  byTier: z.record(z.string(), z.number()),
});

// --- users -----------------------------------------------------------------

export const userSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  role: userRoleSchema,
  status: z.string(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  kycStatus: kycStatusSchema,
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
  _count: z.object({ wallets: z.number(), devices: z.number() }),
});

export const userListSchema = z.object({
  items: z.array(userSummarySchema),
  nextCursor: z.string().nullable(),
});

export const userStatsSchema = z.object({
  total: z.number(),
  newLast7d: z.number(),
  byKyc: z.record(z.string(), z.number()),
  byRole: z.record(z.string(), z.number()),
});

const userDetailBase = userSummarySchema.omit({ _count: true }).extend({
  displayName: z.string().nullable(),
  emailVerifiedAt: z.string().nullable(),
  wallets: z.array(z.object({
    id: z.string(), address: z.string(), chainId: z.string(), kind: z.string(),
    label: z.string().nullable(), deployed: z.boolean(), isPrimary: z.boolean(),
    createdAt: z.string(),
  })),
  devices: z.array(z.object({
    id: z.string(), platform: z.string(), label: z.string(),
    trustedAt: z.string(), lastSeenAt: z.string(),
  })),
  kyc: z.object({
    status: kycStatusSchema, provider: z.string().nullable(), providerRef: z.string().nullable(),
    jurisdiction: z.string().nullable(), reviewedAt: z.string().nullable(),
  }).nullable(),
});

/** The detail projection counts sessions too; the list does not. */
export const userDetailSchema = userDetailBase.extend({
  _count: z.object({ wallets: z.number(), devices: z.number(), sessions: z.number() }),
});

// --- devices ---------------------------------------------------------------

export const deviceRowSchema = z.object({
  id: z.string(),
  platform: z.enum(['ios', 'android', 'web']),
  label: z.string(),
  trustedAt: z.string(),
  lastSeenAt: z.string(),
  revokedAt: z.string().nullable(),
  user: z.object({
    id: z.string(), email: z.string(), role: z.string(), kycStatus: kycStatusSchema,
  }),
});

export const deviceListSchema = z.object({
  items: z.array(deviceRowSchema),
  nextCursor: z.string().nullable(),
});

export const deviceStatsSchema = z.object({
  total: z.number(),
  revoked: z.number(),
  stale: z.number(),
  byPlatform: z.record(z.string(), z.number()),
});

// --- registry --------------------------------------------------------------

export const issuerSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  jurisdiction: z.string(),
  licenseTypes: z.array(z.string()),
  licenseRefs: z.array(z.string()),
  website: z.string().nullable(),
  verifiedTier: z.enum(['issuer_verified', 'community_verified', 'unverified']),
  riskFlags: z.array(z.string()),
  notes: z.string().nullable(),
  createdAt: z.string(),
  _count: z.object({ assets: z.number() }),
});

export const issuerListSchema = z.array(issuerSchema);

export const chainSchema = z.object({
  id: z.string(),
  name: z.string(),
  family: z.string(),
  nativeSymbol: z.string(),
  decimals: z.number().int(),
  explorerUrl: z.string().nullable(),
  enabled: z.boolean(),
  isTestnet: z.boolean(),
  _count: z.object({ assets: z.number(), wallets: z.number() }),
});

export const chainListSchema = z.array(chainSchema);

export const providerSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  status: z.enum(['active', 'degraded', 'disabled']),
  capabilities: z.array(z.string()),
  lastCheckedAt: z.string().nullable(),
  notes: z.string().nullable(),
  _count: z.object({ quotes: z.number(), redemptions: z.number() }),
});

export const providerListSchema = z.array(providerSchema);

// --- misc ------------------------------------------------------------------

export const quoteStatsSchema = z.object({
  total: z.number(),
  byState: z.record(z.string(), z.number()),
  byRail: z.record(z.string(), z.number()),
});

export const auditRowSchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  actorRole: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  outcome: z.enum(['success', 'failure', 'denied']),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
});

export const auditListSchema = z.array(auditRowSchema);

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    detail: z.unknown().optional(),
  }),
  path: z.string(),
  timestamp: z.string(),
});

/** The standard error envelope every failure path must produce. */
export const apiErrorSchema = errorSchema;

export const CONTRACT_REGISTRY = {
  'GET /assets': assetListSchema,
  'GET /assets/stats': assetStatsSchema,
  'GET /users': userListSchema,
  'GET /users/stats': userStatsSchema,
  'GET /users/:id': userDetailSchema,
  'GET /devices/all': deviceListSchema,
  'GET /devices/stats': deviceStatsSchema,
  'GET /issuers': issuerListSchema,
  'GET /chains': chainListSchema,
  'GET /providers': providerListSchema,
  'GET /swaps/quotes/stats': quoteStatsSchema,
  'GET /audit': auditListSchema,
} as const;
