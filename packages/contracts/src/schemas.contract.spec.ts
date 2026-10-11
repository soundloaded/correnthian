import { describe, expect, it } from 'vitest';
import {
  priceLatestSchema,
  eligibilitySchema,
  walletRegisterSchema,
  issuerWriteSchema,
  transactionRawRowSchema,
  startVerificationSchema,
  healthReadySchema,
} from './schemas.js';

describe('BE-1705 schemas accept the documented shape', () => {
  it('price latest accepts both union arms', () => {
    expect(priceLatestSchema.safeParse({ found: false, assetId: 'a', reason: 'r' }).success).toBe(true);
    expect(priceLatestSchema.safeParse({
      found: true, assetId: 'a', priceUsd: 1.5, source: 's', capturedAt: new Date().toISOString(), ageSeconds: 3, stale: false,
    }).success).toBe(true);
    expect(priceLatestSchema.safeParse({ found: true, assetId: 'a' }).success).toBe(false);
  });

  it('wallet registration rejects the detail shape it does not answer', () => {
    // The split exists because the create select lacks deployed/createdAt/
    // display — this test is the split. If the service ever returns the full
    // row here, this fails and the schemas reunite deliberately, not by drift.
    expect(walletRegisterSchema.safeParse({
      id: 'w', address: '0x0', chainId: '1', kind: 'smart', label: null, guardians: [], isPrimary: true,
    }).success).toBe(true);
    expect(walletRegisterSchema.safeParse({
      id: 'w', address: '0x0', chainId: '1', kind: 'seedling', label: null, guardians: [], isPrimary: true,
    }).success).toBe(false);
  });

  it('issuer writes reject the counts only reads carry', () => {
    const row = {
      id: 'i', slug: 's', name: 'n', jurisdiction: 'US', licenseTypes: [], licenseRefs: [],
      website: null, verifiedTier: 'unverified', riskFlags: [], notes: null, createdAt: new Date().toISOString(),
    };
    expect(issuerWriteSchema.safeParse(row).success).toBe(true);
    expect(issuerWriteSchema.safeParse({ ...row, verifiedTier: 'issuer-blessed' }).success).toBe(false);
  });

  it('raw transaction rows accept string-or-number Decimals and ISO dates', () => {
    const base = {
      id: 't', userId: 'u', walletId: 'w', assetId: 's', chainId: '1', providerId: null,
      destination: null, txHash: null, direction: 'out', state: 'created', amountRaw: '1',
      amountUsd: null, feeRaw: null, feeUsd: null, blockNumber: '12345', confirmations: 0,
      requiredConfirmations: 12, droppedAt: null, dropCount: 0, lastSeenAt: null,
      errorCode: null, errorMessage: null, expiresAt: null, signedAt: null, broadcastAt: null,
      confirmedAt: null, failedAt: null, blockTime: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    expect(transactionRawRowSchema.safeParse(base).success).toBe(true);
    expect(transactionRawRowSchema.safeParse({ ...base, direction: 'sideways' }).success).toBe(false);
  });

  it('start verification and readiness accept their shapes', () => {
    expect(startVerificationSchema.safeParse({ status: 'pending', inquiryId: 'i', sessionToken: 's' }).success).toBe(true);
    expect(healthReadySchema.safeParse({
      status: 'ok', dependencies: {
        database: { status: 'up', latencyMs: 3 }, redis: { status: 'up', latencyMs: 1 },
      },
    }).success).toBe(true);
    expect(healthReadySchema.safeParse({ status: 'ok', dependencies: {} }).success).toBe(false);
  });

  it('eligibility mirrors the engine field for field', () => {
    expect(eligibilitySchema.safeParse({
      allowed: false, canBuyCrypto: false, canSellCrypto: false, canUseMetals: false,
      canRedeem: false, kycRequired: true, blockedProviders: [], matchedRule: null, unmatched: true,
    }).success).toBe(true);
    expect(eligibilitySchema.safeParse({ allowed: false }).success).toBe(false);
  });
});
