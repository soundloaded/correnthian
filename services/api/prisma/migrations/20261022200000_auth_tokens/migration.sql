-- One-time links for passwordless sign-in and password reset.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A TABLE
--
-- A magic link and a password-reset link are the same shape: a single-use
-- token, bound to one account, that dies after a short window. Both are
-- bearer credentials for their lifetime, so both live under the same rules:
-- the raw token is never stored (only its SHA-256, as with sessions), use
-- marks the row consumed, and expiry is a column, not a hope.
--
-- Single-use is enforced the way the idempotency claim is: the consume
-- query repeats the unconsumed-and-unexpired predicate on the write, so two
-- requests racing for the same link cannot both succeed.
--
-- ---------------------------------------------------------------------------
-- WHY `purpose`, NOT TWO TABLES
--
-- Magic and reset differ in lifetime (15 vs 60 minutes) and in what they
-- grant (a session vs the right to set a password). They share everything
-- else: lookup by token hash, single-use, expiry, and the rate limit on
-- issuance. Two tables with identical discipline drift apart the first time
-- one of them is fixed.
--
-- ---------------------------------------------------------------------------
-- SECURITY INVARIANT
--
-- This table holds token *digests*, never raw tokens. The raw value crosses
-- the wire twice — once in the email, once back from the client — and is
-- otherwise known to nobody, including us. A database compromise hands an
-- attacker digests it cannot exchange.
--
-- `usedAt` starts null, and a used or expired token is indistinguishable
-- from an unknown one: the response to either is the same refusal, because
-- distinguishing them confirms whether an address is registered.
--
-- ---------------------------------------------------------------------------
-- NO SEEDED VALUE
--
-- Tokens are issued, never seeded. An empty table means no outstanding
-- links, which is the state every deployment starts in.

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('magic_link', 'password_reset');

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_purpose_createdAt_idx" ON "AuthToken"("userId", "purpose", "createdAt");
