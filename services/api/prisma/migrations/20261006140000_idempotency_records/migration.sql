-- CreateEnum
CREATE TYPE "IdempotencyState" AS ENUM ('in_progress', 'completed');

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "state" "IdempotencyState" NOT NULL DEFAULT 'in_progress',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_keyHash_key" ON "IdempotencyRecord"("keyHash");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_state_expiresAt_idx" ON "IdempotencyRecord"("state", "expiresAt");