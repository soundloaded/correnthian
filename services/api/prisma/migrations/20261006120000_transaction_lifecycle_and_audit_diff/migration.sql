-- Transaction lifecycle engine (§21, §62) and a usable audit trail (§55).
--
-- ---------------------------------------------------------------------------
-- SECURITY INVARIANT
--
-- This migration adds no column capable of holding key material, and it adds
-- no column for a signed payload either. A signed transaction is a
-- replayable authorisation while its nonce is unspent and `redactDeep()` does
-- not catch one, because it is not shaped like a secret. See
-- `docs/architecture/key-boundary.md` item 8.
--
-- `Transaction.destination` and `Transaction.txHash` are public chain data.
-- ---------------------------------------------------------------------------

-- §62: the lifecycle is explicit states, not a status flag. `dropped` is
-- deliberately not one of them — see the TxLifecycle doc comment in
-- schema.prisma. It becomes a pair of columns on a row that is still moving.
CREATE TYPE "TxLifecycle" AS ENUM (
  'created',
  'signed',
  'broadcast',
  'pending',
  'confirmed',
  'failed',
  'cancelled',
  'expired'
);

-- §21: the record should contain user, wallet, chain, asset, amount,
-- destination, hash, fee, status, provider, timestamps and error information.
--
-- Added before the data migration below, which writes to `droppedAt`.
ALTER TABLE "Transaction" ALTER COLUMN "txHash" DROP NOT NULL;

ALTER TABLE "Transaction" ADD COLUMN "userId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "providerId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "destination" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "feeRaw" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "feeUsd" DECIMAL(36, 8);
ALTER TABLE "Transaction" ADD COLUMN "requiredConfirmations" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Transaction" ADD COLUMN "droppedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "dropCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Transaction" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "errorMessage" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "signedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "broadcastAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "failedAt" TIMESTAMP(3);

-- Backfilled from the wallet, never from a request body: the owner of a
-- transaction is a property of whose wallet it left, not of who filed it.
UPDATE "Transaction" t
SET "userId" = w."userId"
FROM "Wallet" w
WHERE w."id" = t."walletId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Transaction" WHERE "userId" IS NULL) THEN
    RAISE EXCEPTION
      'Cannot require Transaction.userId: % row(s) reference a wallet that no longer exists.',
      (SELECT COUNT(*) FROM "Transaction" WHERE "userId" IS NULL);
  END IF;
END $$;

ALTER TABLE "Transaction" ALTER COLUMN "userId" SET NOT NULL;

-- `dropped` rows were broadcast and never mined. At the lifecycle level that
-- is `pending`, and the drop itself is preserved rather than lost.
UPDATE "Transaction"
SET "droppedAt"  = COALESCE("blockTime", "updatedAt"),
    "dropCount"  = 1,
    "lastSeenAt" = "blockTime"
WHERE "state" = 'dropped';

ALTER TABLE "Transaction" ALTER COLUMN "state" DROP DEFAULT;
-- Through `text`: Postgres will not assign one enum type to another, and the
-- whole rewrite has to fit in the statements below rather than in a default.
ALTER TABLE "Transaction" ALTER COLUMN "state" TYPE text USING "state"::text;
UPDATE "Transaction"
SET "state" = CASE "state"
  WHEN 'pending'   THEN 'pending'
  WHEN 'confirmed' THEN 'confirmed'
  WHEN 'failed'    THEN 'failed'
  WHEN 'dropped'   THEN 'pending'
END;
ALTER TABLE "Transaction"
  ALTER COLUMN "state" TYPE "TxLifecycle" USING "state"::"TxLifecycle";
ALTER TABLE "Transaction" ALTER COLUMN "state" SET DEFAULT 'created';

DROP TYPE "TxState";

-- A transaction is an outbound movement unless a caller says otherwise, and
-- the default belongs in the database rather than only in the service.
ALTER TABLE "Transaction" ALTER COLUMN "direction" SET DEFAULT 'out';

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");
CREATE INDEX "Transaction_chainId_state_idx" ON "Transaction"("chainId", "state");

-- ---------------------------------------------------------------------------
-- §55: before, after, reason, device, requestId.
--
-- `actor, actorRole, action, resource, resourceId, timestamp, IP` already
-- existed. What made an entry unreadable after the fact was that it recorded
-- *that* something changed and never *what it had been* or *why*.
-- ---------------------------------------------------------------------------

ALTER TABLE "AuditLog" ADD COLUMN "before" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "after" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "reason" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "deviceId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "requestId" TEXT;

CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");