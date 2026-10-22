-- Notification delivery: an atomic claim over the rows that exist.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A TABLE AND NOT A FLAG
--
-- `Notification` rows were written and never sent: there was a transport,
-- a scheduler, and an atomic claim missing (DEF-009). The rows already
-- exist, so this migration adds what two workers need in order to share
-- them without sending anything twice.
--
-- `claimedBy` and `claimedUntil` are the lease. `claimedUntil` is a timeout,
-- not a flag: a worker that dies mid-batch leaves its rows claimed, and a
-- claim with no expiry is a row that is never sent — a harder failure than
-- a row sent twice, because the second is visible and the first is silent.
--
-- The predicate *is* the guard. `claimedUntil` is repeated on the update,
-- not just on the select, so two workers racing for the same row both match
-- zero or one wins. The loser claims nothing, and a row already claimed is
-- invisible to the next worker until its lease expires.
--
-- ---------------------------------------------------------------------------
-- WHY ONE UPDATE, NOT UPDATE-THEN-SELECT
--
-- The claim selects the row ids it can see and updates them by id, both with
-- the same predicate. A second worker that interleaves between the two sees
-- either no row (already claimed) or a row it takes itself. It cannot take
-- what the first worker took, because the update only touches rows whose
-- lease is expired or absent.
--
-- ---------------------------------------------------------------------------
-- SECURITY INVARIANT
--
-- This migration adds two nullable columns to a table that holds delivery
-- intent. It adds no column capable of holding key material and no signed
-- payload. See the schema header and
-- `docs/architecture/key-boundary.md`.
--
-- ---------------------------------------------------------------------------
-- NO SEEDED VALUE
--
-- Existing rows are unclaimed. A row that was never sent must not read as
-- claimed because a migration touched the table.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "claimedBy" TEXT,
ADD COLUMN "claimedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DeliveryLog" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "providerMsgId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeliveryLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Notification_claimedUntil_idx" ON "Notification"("claimedUntil");

-- CreateIndex
CREATE INDEX "DeliveryLog_notificationId_idx" ON "DeliveryLog"("notificationId");

-- CreateIndex
CREATE INDEX "DeliveryLog_status_createdAt_idx" ON "DeliveryLog"("status", "createdAt");
