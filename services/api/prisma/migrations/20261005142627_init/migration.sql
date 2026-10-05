-- CreateEnum
CREATE TYPE "ChainFamily" AS ENUM ('evm', 'bitcoin', 'solana');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('smart', 'seed');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'support', 'compliance', 'admin', 'owner');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('not_started', 'pending', 'approved', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('crypto', 'stablecoin', 'metal', 'treasury', 'fund', 'other');

-- CreateEnum
CREATE TYPE "TokenStandard" AS ENUM ('native', 'erc20', 'bep20', 'btrc20', 'spl', 'other');

-- CreateEnum
CREATE TYPE "CustodyModel" AS ENUM ('allocated', 'unallocated', 'synthetic');

-- CreateEnum
CREATE TYPE "VerifiedTier" AS ENUM ('issuer_verified', 'community_verified', 'unverified');

-- CreateEnum
CREATE TYPE "AttestationCadence" AS ENUM ('monthly', 'quarterly', 'annual', 'none');

-- CreateEnum
CREATE TYPE "RailKind" AS ENUM ('provider', 'dex', 'cex', 'otc');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('active', 'degraded', 'disabled');

-- CreateEnum
CREATE TYPE "ProviderCategory" AS ENUM ('metals', 'onramp', 'offramp', 'rpc', 'pricing', 'kyc', 'sanctions', 'indexer');

-- CreateEnum
CREATE TYPE "QuoteState" AS ENUM ('quoted', 'awaiting_payment', 'broadcast', 'settled', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "ExecutionQuality" AS ENUM ('deep', 'thin', 'none');

-- CreateEnum
CREATE TYPE "TxState" AS ENUM ('pending', 'confirmed', 'failed', 'dropped');

-- CreateEnum
CREATE TYPE "TxDirection" AS ENUM ('in', 'out', 'internal');

-- CreateEnum
CREATE TYPE "RedemptionState" AS ENUM ('requested', 'kyc_pending', 'approved', 'in_production', 'shipped', 'delivered', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('success', 'failure', 'denied');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "status" TEXT NOT NULL DEFAULT 'active',
    "displayName" TEXT,
    "country" CHAR(2),
    "region" TEXT,
    "passwordDigest" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'not_started',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "label" TEXT NOT NULL,
    "publicKey" TEXT,
    "pushToken" TEXT,
    "trustedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'not_started',
    "providerRef" TEXT,
    "provider" TEXT,
    "jurisdiction" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "label" TEXT,
    "deployed" BOOLEAN NOT NULL DEFAULT false,
    "guardians" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletAccount" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "balanceRaw" TEXT NOT NULL DEFAULT '0',
    "balanceUsd" DECIMAL(36,18),
    "lastSyncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issuer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "licenseTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "licenseRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "website" TEXT,
    "verifiedTier" "VerifiedTier" NOT NULL DEFAULT 'unverified',
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issuer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "contractAddress" TEXT,
    "tokenStandard" "TokenStandard" NOT NULL DEFAULT 'erc20',
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "issuerId" TEXT NOT NULL,
    "custodyModel" "CustodyModel" NOT NULL DEFAULT 'synthetic',
    "custodian" TEXT,
    "vaultLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proofOfReserveUrl" TEXT,
    "attestationCadence" "AttestationCadence" NOT NULL DEFAULT 'none',
    "lastAttestedAt" TIMESTAMP(3),
    "gramsPerToken" DECIMAL(18,6),
    "ouncesPerToken" DECIMAL(18,8),
    "transferSupported" BOOLEAN NOT NULL DEFAULT true,
    "swapSupported" BOOLEAN NOT NULL DEFAULT false,
    "redeemSupported" BOOLEAN NOT NULL DEFAULT false,
    "rails" "RailKind"[] DEFAULT ARRAY[]::"RailKind"[],
    "verifiedTier" "VerifiedTier" NOT NULL DEFAULT 'unverified',
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "iconUrl" TEXT,
    "accentColor" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "ChainFamily" NOT NULL,
    "nativeSymbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 18,
    "rpcUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "explorerUrl" TEXT,
    "gasPriceUsd" DECIMAL(36,18),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "isTestnet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProviderCategory" NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'disabled',
    "lastHealth" JSONB,
    "lastCheckedAt" TIMESTAMP(3),
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "walletId" TEXT,
    "railKind" "RailKind" NOT NULL,
    "railId" TEXT NOT NULL,
    "fromAssetId" TEXT NOT NULL,
    "toAssetId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "providerId" TEXT,
    "fromAmountRaw" TEXT NOT NULL,
    "toAmountRaw" TEXT NOT NULL,
    "notionalUsd" DECIMAL(36,8),
    "priceImpactBps" INTEGER NOT NULL,
    "slippageBps" INTEGER NOT NULL,
    "minReceivedRaw" TEXT NOT NULL,
    "fees" JSONB NOT NULL DEFAULT '[]',
    "executionQuality" "ExecutionQuality" NOT NULL DEFAULT 'thin',
    "sizeCapUsd" DECIMAL(36,2),
    "state" "QuoteState" NOT NULL DEFAULT 'quoted',
    "txHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwapQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "direction" "TxDirection" NOT NULL,
    "state" "TxState" NOT NULL DEFAULT 'pending',
    "amountRaw" TEXT NOT NULL,
    "amountUsd" DECIMAL(36,8),
    "blockNumber" BIGINT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "blockTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "totalUsd" DECIMAL(36,8) NOT NULL,
    "breakdown" JSONB NOT NULL DEFAULT '{}',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPrice" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "priceUsd" DECIMAL(36,8) NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedemptionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "state" "RedemptionState" NOT NULL DEFAULT 'requested',
    "amountRaw" TEXT NOT NULL,
    "notionalUsd" DECIMAL(36,8),
    "feesUsd" DECIMAL(36,8),
    "serialNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "destination" JSONB,
    "providerRef" TEXT,
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedemptionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JurisdictionRule" (
    "id" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL,
    "region" TEXT,
    "canBuyCrypto" BOOLEAN NOT NULL DEFAULT false,
    "canSellCrypto" BOOLEAN NOT NULL DEFAULT false,
    "canUseMetals" BOOLEAN NOT NULL DEFAULT false,
    "canRedeem" BOOLEAN NOT NULL DEFAULT false,
    "kycRequired" BOOLEAN NOT NULL DEFAULT true,
    "blockedProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JurisdictionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'success',
    "ipAddress" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout" INTEGER NOT NULL DEFAULT 100,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");

-- CreateIndex
CREATE INDEX "User_country_region_idx" ON "User"("country", "region");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KycProfile_userId_key" ON "KycProfile"("userId");

-- CreateIndex
CREATE INDEX "KycProfile_status_idx" ON "KycProfile"("status");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_chainId_idx" ON "Wallet"("chainId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_chainId_address_key" ON "Wallet"("chainId", "address");

-- CreateIndex
CREATE INDEX "WalletAccount_assetId_idx" ON "WalletAccount"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletAccount_walletId_assetId_key" ON "WalletAccount"("walletId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Issuer_slug_key" ON "Issuer"("slug");

-- CreateIndex
CREATE INDEX "Issuer_verifiedTier_idx" ON "Issuer"("verifiedTier");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetId_key" ON "Asset"("assetId");

-- CreateIndex
CREATE INDEX "Asset_category_enabled_idx" ON "Asset"("category", "enabled");

-- CreateIndex
CREATE INDEX "Asset_symbol_idx" ON "Asset"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_chainId_contractAddress_issuerId_key" ON "Asset"("chainId", "contractAddress", "issuerId");

-- CreateIndex
CREATE INDEX "Chain_family_idx" ON "Chain"("family");

-- CreateIndex
CREATE INDEX "Chain_enabled_idx" ON "Chain"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE INDEX "Provider_category_status_idx" ON "Provider"("category", "status");

-- CreateIndex
CREATE INDEX "SwapQuote_userId_state_idx" ON "SwapQuote"("userId", "state");

-- CreateIndex
CREATE INDEX "SwapQuote_state_expiresAt_idx" ON "SwapQuote"("state", "expiresAt");

-- CreateIndex
CREATE INDEX "SwapQuote_fromAssetId_toAssetId_idx" ON "SwapQuote"("fromAssetId", "toAssetId");

-- CreateIndex
CREATE INDEX "Transaction_walletId_createdAt_idx" ON "Transaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_state_idx" ON "Transaction"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_chainId_txHash_key" ON "Transaction"("chainId", "txHash");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_walletId_capturedAt_idx" ON "PortfolioSnapshot"("walletId", "capturedAt");

-- CreateIndex
CREATE INDEX "AssetPrice_assetId_capturedAt_idx" ON "AssetPrice"("assetId", "capturedAt");

-- CreateIndex
CREATE INDEX "AssetPrice_source_capturedAt_idx" ON "AssetPrice"("source", "capturedAt");

-- CreateIndex
CREATE INDEX "RedemptionRequest_userId_state_idx" ON "RedemptionRequest"("userId", "state");

-- CreateIndex
CREATE INDEX "RedemptionRequest_providerId_state_idx" ON "RedemptionRequest"("providerId", "state");

-- CreateIndex
CREATE INDEX "JurisdictionRule_active_idx" ON "JurisdictionRule"("active");

-- CreateIndex
CREATE UNIQUE INDEX "JurisdictionRule_country_region_key" ON "JurisdictionRule"("country", "region");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_channel_sentAt_idx" ON "Notification"("channel", "sentAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycProfile" ADD CONSTRAINT "KycProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "Issuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapQuote" ADD CONSTRAINT "SwapQuote_fromAssetId_fkey" FOREIGN KEY ("fromAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapQuote" ADD CONSTRAINT "SwapQuote_toAssetId_fkey" FOREIGN KEY ("toAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapQuote" ADD CONSTRAINT "SwapQuote_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapQuote" ADD CONSTRAINT "SwapQuote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPrice" ADD CONSTRAINT "AssetPrice_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedemptionRequest" ADD CONSTRAINT "RedemptionRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedemptionRequest" ADD CONSTRAINT "RedemptionRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
