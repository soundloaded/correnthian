-- §37 fees engine: centralised, itemised, and configurable without a deploy.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A TABLE AND NOT A CONSTANT
--
-- A fee is a commercial term. It changes because counsel read a contract, or a
-- provider repriced, or a promotion ended. All of those are business events.
-- A rate compiled into a service is a rate that needs a release to change, and
-- the pressure that creates is to batch changes and ship them rarely — which is
-- how a stale rate ends up quoting a price nobody agreed to.
--
-- ---------------------------------------------------------------------------
-- SECURITY INVARIANT
--
-- This migration adds no column capable of holding key material and no column
-- for a signed payload. See the schema header and
-- `docs/architecture/key-boundary.md`.
--
-- The security property that *does* belong here is economic. Correnthian never
-- earns by mispricing an asset: a fee is a row that resolves to a named,
-- itemised line, and there is no column on this table — or anywhere else — for
-- a fee to be folded into a price instead. `src/fees/fee-breakdown.ts` echoes
-- the notional it was given, verbatim, beside the fees; that is what makes the
-- guarantee checkable rather than aspirational.
--
-- ---------------------------------------------------------------------------
-- NO SEEDED RATE
--
-- The development seed creates jurisdiction rules marked DEVELOPMENT ONLY,
-- because a jurisdiction rule that is too permissive can be replaced without
-- charging anyone. That does not transfer to fees. A seeded fee rate would be
-- a number nobody agreed to, and if it reached production it would be a real
-- charge applied to real customers. So this table starts empty, and a quote
-- with no rule reports its Correnthian fee as *unknown* rather than as zero.
--
-- That is the behaviour the engine is for. Before this migration every quote
-- carried a hardcoded `amountUsd: 0`, which asserted to a customer that we
-- had thought about their fee and decided it was nothing.

CREATE TYPE "FeeOperation" AS ENUM ('swap', 'buy', 'sell', 'redeem', 'onramp', 'offramp');

-- Who is paid. §37 lists seven categories; three of them answer "who" and four
-- answer "which operation". Conflating those two axes would make a redemption
-- fee inexpressible as a provider fee, and would split one on-ramp fee into
-- fragments instead of itemising it. See the module header in `fee-rule.ts`.
CREATE TYPE "FeeKind" AS ENUM ('network', 'provider', 'correnthian');

-- How a rule turns a notional into an amount. `spread` is separate from
-- `percent` not because the arithmetic differs — it does not — but because a
-- spread is a margin that venues habitually hide inside the exchange rate, and
-- the design spec forbids exactly that. Naming it forces it onto the list.
CREATE TYPE "FeeBasis" AS ENUM ('percent', 'fixed', 'spread');

-- Mirrors the `AssetCategory` enum. A second Postgres enum type is unavoidable
-- — one enum cannot be reused under two names — so the two must be kept in
-- step when a category is added.
CREATE TYPE "FeeAssetCategory" AS ENUM ('crypto', 'stablecoin', 'metal', 'treasury', 'fund', 'other');

CREATE TABLE "FeeRule" (
    "id" TEXT NOT NULL,

    "operation" "FeeOperation" NOT NULL,
    "kind" "FeeKind" NOT NULL,
    "basis" "FeeBasis" NOT NULL,

    -- The customer's line item, verbatim. Never generated from the selectors:
    -- "Gold platform fee" reads as a description and "Fee 1" reads as a
    -- placeholder.
    "label" TEXT NOT NULL,

    -- percent/spread: an INTEGER count of basis points. Not a percentage in a
    -- float — 1.49% is 149, and 0.0149 is not exactly representable. One basis
    -- point is the finest rate this model can express, which is deliberate: it
    -- is the unit fees are negotiated in.
    "rateBps" INTEGER,

    -- fixed: an exact amount at the same 10^-8 scale as SwapQuote.notionalUsd,
    -- so a fee and the notional it is computed from round against each other
    -- consistently. A rate and an amount on one row would be a float.
    "fixedUsd" DECIMAL(36, 8),

    -- Selectors. Every one is optional, and NULL means "not restricted to" —
    -- an unrestricted rule is the normal case, and NULL is genuinely different
    -- from the empty string.
    --
    -- Note `region` is nullable here, unlike `JurisdictionRule.region`. That
    -- model needs a non-nullable region to target a compound unique for
    -- upsert; this table has no such constraint, and nullable states the
    -- meaning — "the whole country" — without an encoding for it.
    "assetId" TEXT,
    "assetCategory" "FeeAssetCategory",
    "providerSlug" TEXT,
    "country" CHAR(2),
    "region" TEXT,

    -- Inclusive both ends.
    "minNotionalUsd" DECIMAL(36, 8),
    "maxNotionalUsd" DECIMAL(36, 8),

    -- Higher wins among rules of the same operation and kind. This is the
    -- explicit, operator-set tie-break, and it exists because "most specific
    -- wins" cannot rank two rules that are each more specific in a different
    -- direction. See `resolveKind`.
    "priority" INTEGER NOT NULL DEFAULT 0,

    -- Exclusive at the end: a rule stops applying at that instant.
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),

    -- An inactive rule is not a rule. It is not a fee of zero, and it must not
    -- become one on the way to resolution.
    "active" BOOLEAN NOT NULL DEFAULT true,

    -- Who set the rate. Not a relation: an audit row records the operator
    -- already, and a dangling id is better than a cascade that erases the
    -- attribution when an account is removed.
    "createdById" TEXT,
    "updatedById" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRule_pkey" PRIMARY KEY ("id")
);

-- The resolution path is "every active rule for this operation", so the
-- operation and kind lead. `active` alone is the operator's list view.
CREATE INDEX "FeeRule_operation_kind_active_idx" ON "FeeRule"("operation", "kind", "active");
CREATE INDEX "FeeRule_active_idx" ON "FeeRule"("active");
