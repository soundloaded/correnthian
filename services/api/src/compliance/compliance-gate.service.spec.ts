import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ComplianceGate, FiatDeniedError, SANCTIONS_TTL_MS,
} from './compliance-gate.service.js';
import { FakeScreeningProvider } from './screening/fake-screening.provider.js';
import { KycService } from './kyc.service.js';

/**
 * The fiat gate — BE-1101/BE-1105 §4.
 *
 * One guard, three doors: onramp execution, metals purchase, redemption
 * payout. Crypto-only moves never pass through here — the gate is not
 * imported by the send path, and that absence is the enforcement.
 *
 * Two properties the tests pin because getting them subtly wrong is the
 * failure mode:
 *
 *  - Denials are typed internally (`kyc_required`, `kyc_pending`,
 *    `sanctions_review`, `screening_unavailable`) but generic externally.
 *    The typed code never reaches the client — `detail` serialises into
 *    the error envelope, so the mapping to one 403 shape happens here,
 *    once, not per caller. A sanctions denial and a pending-KYC denial
 *    look identical from the outside (tipping-off), while support reads
 *    the code from the thrown error server-side.
 *  - Uncertainty denies. A stale screen re-screens inline; a vendor that
 *    cannot be reached denies with `screening_unavailable`. There is no
 *    path from "unknown" to "allowed".
 */

const T0 = new Date('2026-10-10T10:00:00.000Z');
const HOUR = 3_600_000;

type Row = Record<string, unknown>;

function makePrisma(profile: Row | null) {
  const profiles = new Map<string, Row>();
  if (profile) profiles.set('u1', { userId: 'u1', ...profile });
  return {
    prisma: {
      kycProfile: {
        findUnique: async ({ where }: { where: { userId: string } }) =>
          profiles.get(where.userId) ? { ...profiles.get(where.userId) } : null,
        // KycService.rescreen writes through here. Same fake-defaults rule
        // as the KycService spec: the real table fills what the writer omits.
        update: async ({ where, data }: { where: { userId: string }; data: Row }) => {
          const row = profiles.get(where.userId);
          if (!row) throw new Error('record not found');
          Object.assign(row, data);
          return { ...row };
        },
      },
    } as never,
    profiles,
  };
}

const audit = { record: vi.fn(async () => {}) };

function setup(profile: Row | null) {
  const { prisma, profiles } = makePrisma(profile);
  const screening = new FakeScreeningProvider();
  const kyc = new KycService(prisma, screening, audit as never);
  // KycService.rescreen is exercised through its fake store here; the
  // gate under test calls the real method against the same fakes.
  const gate = new ComplianceGate(prisma, kyc);
  return { prisma, profiles, screening, kyc, gate };
}

const approved = (over: Row = {}) => ({
  status: 'approved',
  sanctionsResult: 'clean',
  sanctionsScreenedAt: new Date(T0.getTime() - HOUR),
  needsReview: false,
  ...over,
});

describe('assertFiatAllowed', () => {
  beforeEach(() => audit.record.mockClear());

  it('allows an approved user with a fresh clean screen without calling the vendor', async () => {
    const { screening, gate } = setup(approved());
    await expect(gate.assertFiatAllowed('u1', 'redemption', T0)).resolves.toBeUndefined();
    expect(screening.calls.rescreen).toHaveLength(0);
  });

  it('denies a user who never started, as kyc_required', async () => {
    const { gate } = setup(null);
    const err = await gate.assertFiatAllowed('u1', 'redemption', T0).catch((e) => e);
    expect(err).toBeInstanceOf(FiatDeniedError);
    expect(err.code).toBe('kyc_required');
  });

  it('denies a pending user as kyc_pending, not kyc_required', async () => {
    // The UI asks a different question for "you haven't started" versus
    // "you're waiting" — collapsing them tells a waiting user to start over.
    const { gate } = setup({ status: 'pending', needsReview: false });
    const err = await gate.assertFiatAllowed('u1', 'redemption', T0).catch((e) => e);
    expect(err).toBeInstanceOf(FiatDeniedError);
    expect(err.code).toBe('kyc_pending');
  });

  it('denies rejected and expired users as kyc_required: the remedy is re-verification', async () => {
    for (const status of ['rejected', 'expired']) {
      const { gate } = setup({ status });
      const err = await gate.assertFiatAllowed('u1', 'redemption', T0).catch((e) => e);
      expect(err.code).toBe('kyc_required');
    }
  });

  it('denies a latched sanctions hit even with approved KYC', async () => {
    const { screening, gate } = setup(approved({ sanctionsResult: 'hit', needsReview: true }));
    const err = await gate.assertFiatAllowed('u1', 'redemption', T0).catch((e) => e);
    expect(err).toBeInstanceOf(FiatDeniedError);
    expect(err.code).toBe('sanctions_review');
    // No re-screen can clear a latch, so none is attempted.
    expect(screening.calls.rescreen).toHaveLength(0);
  });

  it('re-screens inline when the clean screen is stale, and allows on clean', async () => {
    const { screening, gate } = setup(
      approved({ sanctionsScreenedAt: new Date(T0.getTime() - SANCTIONS_TTL_MS - 1000) }),
    );
    screening.scriptScreen('u1', 'clean');

    await expect(gate.assertFiatAllowed('u1', 'redemption', T0)).resolves.toBeUndefined();
    expect(screening.calls.rescreen).toEqual(['u1']);
  });

  it('a stale screen that re-screens to a hit denies as sanctions_review', async () => {
    const { screening, gate } = setup(
      approved({ sanctionsScreenedAt: new Date(T0.getTime() - SANCTIONS_TTL_MS - 1000) }),
    );
    screening.scriptScreen('u1', 'hit');

    const err = await gate.assertFiatAllowed('u1', 'redemption', T0).catch((e) => e);
    expect(err).toBeInstanceOf(FiatDeniedError);
    expect(err.code).toBe('sanctions_review');
  });

  it('denies when the vendor cannot be reached, rather than waving through', async () => {
    // Nothing scripted: the fake throws, which is the vendor-down path.
    const { gate } = setup(
      approved({ sanctionsScreenedAt: new Date(T0.getTime() - SANCTIONS_TTL_MS - 1000) }),
    );
    const err = await gate.assertFiatAllowed('u1', 'redemption', T0).catch((e) => e);
    expect(err).toBeInstanceOf(FiatDeniedError);
    expect(err.code).toBe('screening_unavailable');
  });

  it('a screen exactly at the TTL boundary counts as fresh', async () => {
    const { screening, gate } = setup(
      approved({ sanctionsScreenedAt: new Date(T0.getTime() - SANCTIONS_TTL_MS) }),
    );
    await expect(gate.assertFiatAllowed('u1', 'redemption', T0)).resolves.toBeUndefined();
    expect(screening.calls.rescreen).toHaveLength(0);
  });
});

describe('FiatDeniedError.toHttpError', () => {
  it('every code maps to one generic 403 with no reason words', async () => {
    for (const code of ['kyc_required', 'kyc_pending', 'sanctions_review', 'screening_unavailable'] as const) {
      const http = new FiatDeniedError(code).toHttpError();
      expect(http.code).toBe('forbidden');
      expect(http.status).toBe(403);
      // Tipping-off: "sanctions" must not appear in any denial a user reads.
      expect(http.message).not.toMatch(/sanction/i);
      expect(http.message).not.toMatch(/kyc_required|kyc_pending|sanctions_review|screening_unavailable/);
    }
    // ...while remaining distinguishable server-side.
    expect(new FiatDeniedError('sanctions_review').code).toBe('sanctions_review');
  });
});
