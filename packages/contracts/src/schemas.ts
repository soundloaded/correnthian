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

// --- swaps -----------------------------------------------------------------

/** Mirrors the Prisma enums. A quote in a state the UI cannot colour is a bug. */
export const quoteStateSchema = z.enum([
  'quoted', 'awaiting_payment', 'broadcast', 'settled', 'failed', 'expired',
]);
export const railKindSchema = z.enum(['provider', 'dex', 'cex', 'otc']);
export const executionQualitySchema = z.enum(['deep', 'thin', 'none']);

export const quoteStatsSchema = z.object({
  total: z.number(),
  byState: z.record(z.string(), z.number()),
  byRail: z.record(z.string(), z.number()),
});

/**
 * One row of the operator's quote table.
 *
 * The asset symbols and the provider name travel with the row on purpose. A
 * console that has to join three tables to render one table renders the wrong
 * join the first time one of them is empty, and the operator has no way to tell
 * "no provider" from "we forgot to look".
 */
export const quoteRowSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  state: quoteStateSchema,
  railKind: railKindSchema,
  railId: z.string(),
  provider: z.object({ slug: z.string(), name: z.string() }).nullable(),
  fromAsset: z.object({ assetId: z.string(), symbol: z.string() }),
  toAsset: z.object({ assetId: z.string(), symbol: z.string() }),
  fromAmountRaw: z.string(),
  toAmountRaw: z.string(),
  notionalUsd: z.number().nullable(),
  priceImpactBps: z.number().int(),
  slippageBps: z.number().int(),
  /**
   * These two are why a quote is or is not fillable. A thin-market quote that
   * does not disclose its own limit is how a user is filled materially worse
   * than the price they were shown, so the operator has to see both.
   */
  sizeCapUsd: z.number().nullable(),
  executionQuality: executionQualitySchema,
  /** The honest read of the two fields above, not a third opinion. */
  executable: z.boolean(),
  expiresAt: z.string(),
});

export const quoteListSchema = z.object({
  items: z.array(quoteRowSchema),
  nextCursor: z.string().nullable(),
});

/** The single-quote projection, which deliberately differs from the list row. */
export const quoteDetailSchema = z.object({
  id: z.string(),
  rail: z.object({ kind: railKindSchema, id: z.string() }),
  fromAmountRaw: z.string(),
  toAmountRaw: z.string(),
  slippageBps: z.number().int(),
  priceImpactBps: z.number().int(),
  minReceivedRaw: z.string(),
  fees: z.unknown(),
  executionQuality: executionQualitySchema,
  sizeCapUsd: z.number().nullable(),
  state: quoteStateSchema,
  expiresAt: z.string(),
  executable: z.boolean(),
});

// --- audit -----------------------------------------------------------------

export const auditOutcomeSchema = z.enum(['success', 'failure', 'denied']);

export const auditRowSchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  /**
   * Resolved server-side. `actorId` alone is a cuid, and an operator looking at
   * a denied action cannot act on a cuid.
   */
  actorEmail: z.string().nullable(),
  actorRole: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  outcome: auditOutcomeSchema,
  /**
   * §55's `reason`. In the list rather than only in the detail because it is a
   * short string and it is the answer to the question an operator opens the
   * trail with — "why was this disabled" — which they should not have to click
   * through a row to find.
   */
  reason: z.string().nullable(),
  ipAddress: z.string().nullable(),
  /** §55's `device`. */
  deviceId: z.string().nullable(),
  /** §55's `requestId`. Everything one HTTP request did. */
  requestId: z.string().nullable(),
  createdAt: z.string(),
});

export const auditListSchema = z.array(auditRowSchema);

/**
 * The detail view adds what the list deliberately withholds.
 *
 * `before`/`after` are §55's pair: the state of the resource either side of a
 * state-changing operation. They are objects rather than strings so a console
 * can render the change rather than print a blob, and `null` is meaningful —
 * null `before` is a create, null `after` is a delete.
 */
export const auditDetailSchema = auditRowSchema.extend({
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

// --- transactions ----------------------------------------------------------

/** Mirrors the Prisma `TxLifecycle` enum — the §21/§62 lifecycle, not a status flag. */
export const txStateSchema = z.enum([
  'created', 'signed', 'broadcast', 'pending', 'confirmed', 'failed', 'cancelled', 'expired',
]);
export const txDirectionSchema = z.enum(['in', 'out', 'internal']);

/**
 * One row of the operator's transaction table.
 *
 * Every relation is resolved server-side, for the same reason the quote table
 * resolves its own: a console that joins four tables to render one row cannot
 * tell "this transaction has no provider" from "we forgot to look".
 */
export const transactionRowSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  state: txStateSchema,
  direction: txDirectionSchema,
  user: z.object({ id: z.string(), email: z.string() }),
  wallet: z.object({ id: z.string(), address: z.string() }),
  chain: z.object({
    id: z.string(), name: z.string(), family: z.string(), explorerUrl: z.string().nullable(),
  }),
  asset: z.object({ assetId: z.string(), symbol: z.string(), name: z.string() }),
  provider: z.object({ slug: z.string(), name: z.string() }).nullable(),

  amountRaw: z.string(),
  amountUsd: z.number().nullable(),
  destination: z.string().nullable(),
  txHash: z.string().nullable(),
  feeRaw: z.string().nullable(),

  confirmations: z.number().int(),
  /** The depth at which this is treated as final, stored per row. */
  requiredConfirmations: z.number().int(),

  /**
   * A drop is a fact, not a state. A transaction that left the mempool and was
   * accepted again later is one row with `dropCount` > 0, not two rows.
   */
  dropCount: z.number().int(),
  droppedAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),

  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),

  expiresAt: z.string().nullable(),
  signedAt: z.string().nullable(),
  broadcastAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  failedAt: z.string().nullable(),

  /**
   * The edges this row may legally take next, from the lifecycle table. Sent to
   * the client so the console cannot offer a button the API will refuse — and
   * so a refusal is visibly the same rule rather than a second opinion.
   */
  permittedNext: z.array(txStateSchema),
});

export const transactionListSchema = z.object({
  items: z.array(transactionRowSchema),
  nextCursor: z.string().nullable(),
});

/** The detail view adds the arbitrary chain data the list withholds. */
export const transactionDetailSchema = transactionRowSchema.extend({
  metadata: z.unknown().nullable(),
});

/** An account's own history. Same row shape; a user and an operator must agree. */
export const myTransactionsSchema = z.array(transactionRowSchema);

export const transactionStatsSchema = z.object({
  total: z.number(),
  byState: z.record(z.string(), z.number()),
  byDirection: z.record(z.string(), z.number()),
});

// --- redemptions ----------------------------------------------------------

export const redemptionStateSchema = z.enum([
  'requested', 'kyc_pending', 'approved', 'in_production', 'shipped', 'delivered',
  'rejected', 'cancelled',
]);

/**
 * One physical-redemption request, as the API returns it.
 *
 * Dates are ISO strings and money is a decimal string, because both leave the
 * Prisma row unmapped: `RedemptionService` hands the row straight back. A
 * contract that assumed a number here would be describing an API that does not
 * exist, so the decimal is accepted as the string it actually is.
 */
export const redemptionRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  /** The registry row's id, not the derived `assetId` string. */
  assetId: z.string(),
  providerId: z.string(),

  state: redemptionStateSchema,
  /**
   * Who approved this. Null until a human moves it to `approved`, and null
   * again for the shipment states, which have no reviewer.
   */
  reviewedBy: z.string().nullable(),

  amountRaw: z.string(),
  notionalUsd: z.union([z.string(), z.number()]).nullable(),
  feesUsd: z.union([z.string(), z.number()]).nullable(),
  serialNumbers: z.array(z.string()),

  destination: z.unknown().nullable(),
  providerRef: z.string().nullable(),
  rejectionReason: z.string().nullable(),

  requestedAt: z.string(),
  updatedAt: z.string(),
});

/** `GET /redemptions/mine` resolves the asset, so an account can render a name. */
export const myRedemptionsSchema = z.array(
  redemptionRequestSchema.extend({
    asset: z.object({ assetId: z.string(), symbol: z.string(), name: z.string() }),
  }),
);

export const redemptionStatsSchema = z.object({
  total: z.number().int(),
  byState: z.record(z.string(), z.number()),
});

// --- misc ------------------------------------------------------------------

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

// --- API versioning --------------------------------------------------------

/**
 * `GET /api/v1/meta/versions`.
 *
 * The registry, on the wire. A client that has to guess which version to call
 * — or that has to hardcode a sunset date someone told it about in a meeting —
 * will get one of them wrong, and a client that gets the version wrong is the
 * failure this whole scheme exists to prevent.
 */
export const apiVersionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['current', 'deprecated', 'retired']),
  releasedAt: z.string().min(1),
  sunsetAt: z.string().nullable(),
  path: z.string().min(1),
});

export const apiVersionsDocumentSchema = z.object({
  currentVersion: z.string().min(1),
  versionedPrefix: z.string().min(1),
  versions: z.array(apiVersionSchema),
  /** Served outside any version on purpose. `/health` is the important one. */
  unversionedPaths: z.array(z.string()),
  legacyUnversionedAlias: z.object({
    enabled: z.boolean(),
    sunsetAt: z.string().nullable(),
    successorPrefix: z.string().min(1),
  }),
  errorCodes: z.object({
    unsupportedApiVersion: z.string(),
    apiVersionRequired: z.string(),
    apiVersionRetired: z.string(),
    notFound: z.string(),
  }),
});

/**
 * A 404 for a version nobody has shipped.
 *
 * Distinct from `not_found` on purpose. "This asset does not exist" and "this
 * API version does not exist" send the caller in opposite directions — one to
 * look at what is registered, the other to look at the URL it built — and
 * collapsing them into one code is how a client spends an afternoon looking for
 * a typo in the wrong place.
 */
export const apiVersionErrorSchema = errorSchema.extend({
  error: errorSchema.shape.error.extend({
    code: z.enum(['unsupported_api_version', 'api_version_required', 'api_version_retired']),
  }),
});

/** A 404 for a path that does not exist inside a version we do serve. */
export const routeNotFoundSchema = errorSchema.extend({
  error: errorSchema.shape.error.extend({
    detail: z
      .object({
        currentVersion: z.string(),
        supportedVersions: z.array(z.string()),
        versionedPrefix: z.string(),
        unversionedPaths: z.array(z.string()),
      })
      .optional(),
  }),
});

// --- idempotency -----------------------------------------------------------

/**
 * A 409 from a financial POST carrying an `Idempotency-Key`.
 *
 * Every branch is a refusal to execute, and each has a different remedy, so
 * `reason` is required rather than a nicety:
 *
 *   fingerprint_mismatch — the key was used for a different request. Replaying
 *      would answer a request that was never made. Send a new key.
 *   in_progress          — an identical request is running. Wait.
 *   outcome_unknown      — a request started and never finished, so whether it
 *      committed is unknowable. Check before retrying with a new key.
 *
 * The first and third are the ones that matter. A client that reads "conflict"
 * and blindly retries has been told nothing.
 */
export const idempotencyConflictSchema = errorSchema.extend({
  error: errorSchema.shape.error.extend({
    code: z.literal('conflict'),
    detail: z.object({
      reason: z.enum(['fingerprint_mismatch', 'in_progress', 'outcome_unknown']),
      recorded: z.object({ method: z.string(), path: z.string() }).optional(),
      submitted: z.object({ method: z.string(), path: z.string() }).optional(),
    }),
  }),
});

/**
 * The wire contract registry.
 *
 * Keys are `METHOD /path` for a success response and `ERROR METHOD /path` for
 * the error envelope that route produces, so a client can declare what it
 * expects to *not* get as precisely as what it expects to get.
 *
 * Paths are the real, prefixed ones. A registry that said `/assets` while the
 * API served `/api/v1/assets` would describe an API nobody has.
 */
export const CONTRACT_REGISTRY = {
  'GET /api/v1/assets': assetListSchema,
  'GET /api/v1/assets/stats': assetStatsSchema,
  'GET /api/v1/users': userListSchema,
  'GET /api/v1/users/stats': userStatsSchema,
  'GET /api/v1/users/:id': userDetailSchema,
  'GET /api/v1/devices/all': deviceListSchema,
  'GET /api/v1/devices/stats': deviceStatsSchema,
  'GET /api/v1/issuers': issuerListSchema,
  'GET /api/v1/chains': chainListSchema,
  'GET /api/v1/providers': providerListSchema,
  'GET /api/v1/swaps/quotes/stats': quoteStatsSchema,
  'GET /api/v1/swaps/quotes': quoteListSchema,
  'GET /api/v1/swaps/quotes/:id': quoteDetailSchema,
  'GET /api/v1/audit': auditListSchema,
  'GET /api/v1/audit/:id': auditDetailSchema,
  'GET /api/v1/transactions': transactionListSchema,
  'GET /api/v1/transactions/stats': transactionStatsSchema,
  'GET /api/v1/transactions/mine': myTransactionsSchema,
  'GET /api/v1/transactions/:id': transactionDetailSchema,
  'POST /api/v1/redemptions': redemptionRequestSchema,
  'PATCH /api/v1/redemptions/:id/transition': redemptionRequestSchema,
  'GET /api/v1/redemptions/mine': myRedemptionsSchema,
  'GET /api/v1/redemptions/stats': redemptionStatsSchema,
  'GET /api/v1/meta/versions': apiVersionsDocumentSchema,
  'ERROR GET /api/v2/*': apiVersionErrorSchema,
  'ERROR GET /api/v1/does-not-exist': routeNotFoundSchema,
  'ERROR POST /api/v1/swaps/quotes': idempotencyConflictSchema,
  'ERROR POST /api/v1/redemptions': idempotencyConflictSchema,
  'ERROR POST /api/v1/onramp/quote': idempotencyConflictSchema,
} as const;
