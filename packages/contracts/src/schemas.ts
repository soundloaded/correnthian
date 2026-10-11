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

export const deviceMineSchema = deviceRowSchema.omit({ revokedAt: true, user: true });

export const authSessionSchema = z.object({
  user: z.object({ id: z.string(), email: z.string(), role: z.string() }),
  token: z.string().min(1),
  expiresAt: z.string(),
});

export const authMeSchema = z.object({
  id: z.string(), email: z.string(), role: z.string(),
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

export const issuerWriteSchema = issuerSchema.omit({ _count: true });

export const issuerDetailSchema = issuerWriteSchema.extend({
  assets: z.array(z.object({
    assetId: z.string(), symbol: z.string(), name: z.string(), enabled: z.boolean(),
  })),
});

export const issuerStatsSchema = z.object({
  total: z.number().int(),
  byTier: z.record(z.string(), z.number()),
});

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

export const chainDetailSchema = chainSchema.extend({
  _count: z.object({ assets: z.number(), wallets: z.number(), transactions: z.number() }),
});

export const providerHealthSchema = z.object({
  counts: z.record(z.string(), z.number()),
  providers: z.array(z.object({
    slug: z.string(),
    name: z.string(),
    category: z.string(),
    status: z.enum(['active', 'degraded', 'disabled']),
    lastCheckedAt: z.string().nullable(),
  })),
});

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

// --- fees ------------------------------------------------------------------

/**
 * §37's itemisation, in the two shapes the design spec's product claim rests
 * on: one named line per fee, and an explicit statement of what could not be
 * determined.
 *
 * The distinction that is the whole reason this section exists: **a fee of
 * zero and a fee nobody knows are different things.** A configured zero is a
 * line with `status: 'computed'` and `amountUsd: '0.00000000'`. An unconfigured
 * fee is `status: 'unknown'` with `amountUsd: null` and a sentence saying why.
 * Before this existed every quote carried `amountUsd: 0`, which asserted to a
 * customer that we had considered their fee and decided it was nothing.
 *
 * `amountUsd` is a fixed-precision decimal **string**, never a number: these
 * are exact 10^-8 USD amounts and a JSON number is a binary float.
 *
 * There is no field here, and no field anywhere on a quote, that holds a
 * price. `notionalUsd` is echoed back unchanged beside the fees it was
 * computed from, which is what makes "Correnthian never earns by mispricing an
 * asset" checkable rather than aspirational. A spread is legal and is exactly
 * this: a line with `basis: 'spread'`, named and visible. There is nowhere for
 * a hidden one to live.
 */
export const feeKindSchema = z.enum(['network', 'provider', 'correnthian']);
export const feeBasisSchema = z.enum(['percent', 'fixed', 'spread']);
export const feeOperationSchema = z.enum(['swap', 'buy', 'sell', 'redeem', 'onramp', 'offramp']);
export const feeAssetCategorySchema = z.enum([
  'crypto', 'stablecoin', 'metal', 'treasury', 'fund', 'other',
]);

/** An exact USD amount at 10^-8, as a fixed-precision string. */
export const usdAmountSchema = z.string().regex(/^\d+\.\d{8}$/);

export const feeLineSchema = z.object({
  kind: feeKindSchema,
  /** The operator's words. Never generated from the rule's selectors. */
  label: z.string().min(1),
  basis: feeBasisSchema.nullable(),
  /** Integer basis points. Null for a fixed amount. */
  rateBps: z.number().int().nullable(),
  /** Null exactly when `status` is `unknown`. Never a number. */
  amountUsd: usdAmountSchema.nullable(),
  status: z.enum(['computed', 'unknown']),
  /** Present exactly when `status` is `unknown`. */
  reason: z.string().nullable(),
});

export const feeBreakdownSchema = z.object({
  operation: feeOperationSchema,
  /**
   * The notional the fees were computed from, echoed verbatim. Null when no
   * notional could be derived — in which case every percentage fee is
   * `unknown` rather than computed against a figure someone made up.
   */
  notionalUsd: usdAmountSchema.nullable(),
  /** Always three lines: network, provider, Correnthian. §37's order. */
  lines: z.array(feeLineSchema).length(3),
  /**
   * The sum of every line, or `null` when any line is unknown. Null rather
   * than a partial sum, because a partial sum is the number a UI puts in a
   * headline and a customer reads as the price.
   */
  totalUsd: usdAmountSchema.nullable(),
  /** What is known. Labeled a subtotal so no caller can sell it as a total. */
  knownSubtotalUsd: usdAmountSchema,
  complete: z.boolean(),
  unknown: z.array(z.object({ kind: feeKindSchema, reason: z.string() })),
  /** A fingerprint of the rule rows that priced this. Not a security control. */
  rulesetVersion: z.string(),
});

// --- fee rules (admin) -----------------------------------------------------

/**
 * One row of the fee table.
 *
 * Rule ids and the operator who set the rate travel only on these admin
 * routes. A customer sees the itemisation above and nothing about how it was
 * configured.
 */
export const feeRuleSchema = z.object({
  id: z.string(),
  operation: feeOperationSchema,
  kind: feeKindSchema,
  basis: feeBasisSchema,
  label: z.string().min(1),
  rateBps: z.number().int().nullable(),
  fixedUsd: usdAmountSchema.nullable(),
  assetId: z.string().nullable(),
  assetCategory: feeAssetCategorySchema.nullable(),
  providerSlug: z.string().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  minNotionalUsd: usdAmountSchema.nullable(),
  maxNotionalUsd: usdAmountSchema.nullable(),
  /** Higher wins. The explicit tie-break "most specific" cannot provide. */
  priority: z.number().int(),
  effectiveFrom: z.string().nullable(),
  effectiveUntil: z.string().nullable(),
  active: z.boolean(),
  specificity: z.object({
    asset: z.number().int(),
    provider: z.number().int(),
    jurisdiction: z.number().int(),
    notional: z.number().int(),
  }),
  createdById: z.string().nullable(),
  updatedById: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const feeRuleListSchema = z.array(feeRuleSchema);

/**
 * Rule pairs that can both apply and neither of which wins.
 *
 * The resolver refuses those pairs at quote time rather than picking one. This
 * is the same set, surfaced before a customer trips over it.
 */
export const feeDiagnosticsSchema = z.object({
  ruleCount: z.number().int(),
  conflicts: z.array(
    z.object({
      operation: feeOperationSchema,
      kind: feeKindSchema,
      ruleIds: z.array(z.string()),
      detail: z.string(),
      specificity: z.record(z.string(), z.object({
        asset: z.number().int(),
        provider: z.number().int(),
        jurisdiction: z.number().int(),
        notional: z.number().int(),
      })),
    }),
  ),
  clear: z.boolean(),
  note: z.string(),
});

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
export const walletListRowSchema = z.object({
  id: z.string(),
  address: z.string(),
  chainId: z.string(),
  kind: z.enum(['smart', 'seed']),
  label: z.string().nullable(),
  deployed: z.boolean(),
  isPrimary: z.boolean(),
  guardians: z.array(z.string()),
  createdAt: z.string(),
  display: z.string(),
  _count: z.object({ accounts: z.number(), transactions: z.number() }),
});

export const walletPortfolioSchema = z.object({
  wallets: z.array(walletListRowSchema),
  totalWallets: z.number().int(),
  notice: z.string(),
});

/**
 * Registration answers the created select, not the detail shape: no
 * `deployed`, no `createdAt`, no `display`. A contract that demanded them
 * would fail on every 201.
 */
export const walletRegisterSchema = z.object({
  id: z.string(),
  address: z.string(),
  chainId: z.string(),
  kind: z.enum(['smart', 'seed']),
  label: z.string().nullable(),
  guardians: z.array(z.string()),
  isPrimary: z.boolean(),
});

export const walletBalanceSchema = z.object({
  balanceRaw: z.string(),
  lastSyncedAt: z.string(),
  assetId: z.string(),
});

/**
 * Wallet detail as `findById` returns it: the row plus per-asset accounts
 * and a display abbreviation. `guardians` is present because the guardians
 * endpoint returns this same shape — a contract that omitted it would pass
 * over the field the route exists to change.
 */
export const walletDetailSchema = z.object({
  id: z.string(),
  address: z.string(),
  chainId: z.string(),
  kind: z.enum(['smart', 'seed']),
  label: z.string().nullable(),
  deployed: z.boolean(),
  isPrimary: z.boolean(),
  guardians: z.array(z.string()),
  createdAt: z.string(),
  display: z.string(),
});

export const quoteDetailSchema = z.object({
  id: z.string(),
  rail: z.object({ kind: railKindSchema, id: z.string() }),
  fromAmountRaw: z.string(),
  toAmountRaw: z.string(),
  slippageBps: z.number().int(),
  priceImpactBps: z.number().int(),
  minReceivedRaw: z.string(),
  /**
   * The itemised breakdown, not a blended number and not a bare list.
   *
   * Strictly the engine's shape. Quote rows written before the fee engine
   * landed hold an older `[{ label, amountUsd, kind }]` array in the same
   * column and will not parse here — deliberately, because a contract that
   * accepts both is a contract that cannot fail.
   */
  fees: feeBreakdownSchema,
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

/** `GET /redemptions`: the operator table. Resolves asset and provider
 * names so the console never joins, and carries the keyset cursor. */
export const redemptionOperatorListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      requestedAt: z.string(),
      state: redemptionStateSchema,
      amountRaw: z.string(),
      asset: z.object({ assetId: z.string(), symbol: z.string() }),
      provider: z.object({ slug: z.string(), name: z.string() }),
    }),
  ),
  nextCursor: z.string().nullable(),
});

/** `GET /compliance/reviews`: profiles parked for a human decision,
 * oldest first. Pointers only — the inquiry id opens the vendor record;
 * documents were never stored and cannot appear here. */
export const reviewQueueSchema = z.array(
  z.object({
    userId: z.string(),
    email: z.string(),
    status: kycStatusSchema,
    provider: z.string(),
    providerRef: z.string().nullable(),
    sanctionsResult: z.enum(['clean', 'hit']).nullable(),
    sanctionsScreenedAt: z.string().nullable(),
    updatedAt: z.string(),
  }),
);

/** `POST /compliance/reviews/:userId/decide` answers the written status. */
export const decideResultSchema = z.object({ status: z.string() });

/** `GET /notifications/stats`: delivery counters over the queue. */
export const notificationStatsSchema = z.object({
  total: z.number().int(),
  pending: z.number().int(),
  sent: z.number().int(),
  failed: z.number().int(),
});

/** `GET /notifications`: the operator table. State is derived from the
 * timestamps — pending means neither sent nor failed — and `error` travels
 * with failed rows so the console can say why, not just that. */
export const notificationOperatorListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string(),
      channel: z.string(),
      template: z.string(),
      state: z.enum(['pending', 'sent', 'failed']),
      error: z.string().nullable(),
      user: z.object({ id: z.string(), email: z.string() }),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const redemptionStatsSchema = z.object({
  total: z.number().int(),
  byState: z.record(z.string(), z.number()),
});

// --- pricing -----------------------------------------------------------------

export const priceLatestSchema = z.union([
  z.object({ found: z.literal(false), assetId: z.string(), reason: z.string() }),
  z.object({
    found: z.literal(true),
    assetId: z.string(),
    priceUsd: z.number(),
    source: z.string(),
    capturedAt: z.string(),
    ageSeconds: z.number(),
    stale: z.boolean(),
  }),
]);

export const priceHistorySchema = z.array(z.object({
  priceUsd: z.union([z.string(), z.number()]),
  source: z.string(),
  capturedAt: z.string(),
}));

export const priceRecordSchema = z.object({
  assetId: z.string(),
  priceUsd: z.union([z.string(), z.number()]),
  source: z.string(),
  capturedAt: z.string(),
});

export const eligibilitySchema = z.object({
  allowed: z.boolean(),
  canBuyCrypto: z.boolean(),
  canSellCrypto: z.boolean(),
  canUseMetals: z.boolean(),
  canRedeem: z.boolean(),
  kycRequired: z.boolean(),
  blockedProviders: z.array(z.string()),
  matchedRule: z.object({ country: z.string(), region: z.string().nullable() }).nullable(),
  unmatched: z.boolean(),
});

export const availabilitySchema = z.object({
  available: z.boolean(),
  reason: z.string().nullable(),
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

// --- scheduled jobs --------------------------------------------------------

/**
 * How one execution of a scheduled job ended.
 *
 * `running` is not a failure: a healthy run passes through it. What matters is
 * `abandoned`, which exists only because the instance running the job stopped
 * existing and could not write its own ending.
 */
export const jobRunOutcomeSchema = z.enum(['running', 'succeeded', 'failed', 'abandoned']);

/**
 * One run, as the operations view returns it.
 *
 * `detail` is free-form on purpose: it is the job's own account of what it did,
 * and a registry entry per job would turn every new job into a contract
 * change. It is still typed as an object, so `null` and a string are refused —
 * the drift this file exists to catch does not get an exception because a field
 * is "just details".
 */
export const jobRunSchema = z.object({
  id: z.string(),
  jobName: z.string(),
  instanceId: z.string(),
  trigger: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
  outcome: jobRunOutcomeSchema,
  /** Rows changed, or flagged where the job's job is observation. */
  affected: z.number(),
  detail: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
});

/**
 * The verdict an operator reads first.
 *
 * `overdue` is the one that matters: a job that has not started within three
 * intervals looks identical to one that never ran. `disabled` is separate from
 * `never_run` because the first means this process is not scheduling anything
 * and the second means it is, and the job has not run.
 */
export const jobHealthSchema = z.enum(['ok', 'running', 'failing', 'overdue', 'never_run', 'disabled']);

export const scheduledJobSchema = z.object({
  name: z.string(),
  description: z.string(),
  everyMs: z.number(),
  timeoutMs: z.number(),
  health: jobHealthSchema,
  runningNow: z.boolean(),
  /** Ticks skipped because the previous run was still going. Not a count of runs. */
  overlapsSkipped: z.number(),
  lastRun: jobRunSchema.nullable(),
  recentRuns: z.array(jobRunSchema),
});

export const jobsStatusSchema = z.object({
  scheduler: z.object({
    running: z.boolean(),
    instanceId: z.string(),
    tickMs: z.number(),
    lastTickAt: z.string().nullable(),
    /** Set when the lease could not be taken at all. Present, not hidden. */
    lastLeaseError: z.string().nullable(),
  }),
  jobs: z.array(scheduledJobSchema),
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
  'GET /api/v1/devices': z.array(deviceMineSchema),
  'POST /api/v1/devices': deviceMineSchema,
  'POST /api/v1/auth/register': authSessionSchema,
  'POST /api/v1/auth/login': authSessionSchema,
  'GET /api/v1/auth/me': authMeSchema,
  'GET /api/v1/devices/all': deviceListSchema,
  'GET /api/v1/devices/stats': deviceStatsSchema,
  'GET /api/v1/issuers': issuerListSchema,
  'GET /api/v1/issuers/stats': issuerStatsSchema,
  'GET /api/v1/issuers/:slug': issuerDetailSchema,
  'POST /api/v1/issuers': issuerWriteSchema,
  'PATCH /api/v1/issuers/:slug/verification': issuerWriteSchema,
  'PATCH /api/v1/issuers/:slug/licences': issuerWriteSchema,
  'PATCH /api/v1/issuers/:slug/risk-flags': issuerWriteSchema,
  'GET /api/v1/chains': chainListSchema,
  'GET /api/v1/chains/:id': chainDetailSchema,
  'PATCH /api/v1/chains/:id/enabled': chainDetailSchema,
  'GET /api/v1/providers/health': providerHealthSchema,
  'GET /api/v1/providers/:slug': providerSchema,
  'PATCH /api/v1/providers/:slug/status': providerSchema,
  'GET /api/v1/providers': providerListSchema,
  'GET /api/v1/swaps/quotes/stats': quoteStatsSchema,
  'GET /api/v1/swaps/quotes': quoteListSchema,
  'GET /api/v1/swaps/quotes/:id': quoteDetailSchema,
  'PATCH /api/v1/wallets/:id/guardians': walletDetailSchema,
  'GET /api/v1/wallets': z.array(walletListRowSchema),
  'GET /api/v1/wallets/portfolio': walletPortfolioSchema,
  'GET /api/v1/wallets/:id': walletDetailSchema,
  'POST /api/v1/wallets': walletRegisterSchema,
  'PATCH /api/v1/wallets/:id/label': walletDetailSchema,
  'PATCH /api/v1/wallets/:id/primary': walletDetailSchema,
  'POST /api/v1/wallets/:id/balances/:assetId': walletBalanceSchema,
  // Fees. The preview is open to any signed account; the rule table is not.
  'POST /api/v1/fees/preview': feeBreakdownSchema,
  'GET /api/v1/fees/rules': feeRuleListSchema,
  'GET /api/v1/fees/rules/diagnostics': feeDiagnosticsSchema,
  'GET /api/v1/fees/rules/:id': feeRuleSchema,
  'POST /api/v1/fees/rules': feeRuleSchema,
  'PATCH /api/v1/fees/rules/:id': feeRuleSchema,
  'GET /api/v1/audit': auditListSchema,
  'GET /api/v1/audit/:id': auditDetailSchema,
  'GET /api/v1/transactions': transactionListSchema,
  'GET /api/v1/transactions/stats': transactionStatsSchema,
  'GET /api/v1/transactions/mine': myTransactionsSchema,
  'GET /api/v1/transactions/:id': transactionDetailSchema,
  'POST /api/v1/redemptions': redemptionRequestSchema,
  'PATCH /api/v1/redemptions/:id/transition': redemptionRequestSchema,
  'GET /api/v1/redemptions': redemptionOperatorListSchema,
  'GET /api/v1/compliance/reviews': reviewQueueSchema,
  'POST /api/v1/compliance/reviews/:userId/decide': decideResultSchema,
  'GET /api/v1/notifications': notificationOperatorListSchema,
  'GET /api/v1/notifications/stats': notificationStatsSchema,
  'GET /api/v1/redemptions/mine': myRedemptionsSchema,
  'GET /api/v1/redemptions/stats': redemptionStatsSchema,
  'GET /api/v1/jobs': jobsStatusSchema,
  'GET /api/v1/pricing/assets/:assetId': priceLatestSchema,
  'GET /api/v1/pricing/assets/:assetId/history': priceHistorySchema,
  'POST /api/v1/pricing/record': priceRecordSchema,
  'GET /api/v1/compliance/eligibility': eligibilitySchema,
  'GET /api/v1/onramp/availability': availabilitySchema,
  'POST /api/v1/jobs/:name/run': jobRunSchema,
  'GET /api/v1/meta/versions': apiVersionsDocumentSchema,
  'ERROR GET /api/v2/*': apiVersionErrorSchema,
  'ERROR GET /api/v1/does-not-exist': routeNotFoundSchema,
  'ERROR POST /api/v1/swaps/quotes': idempotencyConflictSchema,
  'ERROR POST /api/v1/redemptions': idempotencyConflictSchema,
  'ERROR POST /api/v1/onramp/quote': idempotencyConflictSchema,
} as const;
