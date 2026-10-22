import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SystemSettingsService } from '../settings/system-settings.service.js';
import { KycService } from './kyc.service.js';
import { ScreeningUnavailableError } from './screening/screening-provider.js';

/**
 * How long a clean sanctions screen stays valid is now a setting —
 * `compliance.sanctions-rescreen-hours` — so an operator can change it
 * without a release.
 *
 * It was a constant here, exported so the nightly re-screen job and the
 * tests read the same number the gate enforces: two TTLs would drift, and
 * the drift would be invisible, because the job would re-screen on a
 * different schedule than the gate demands. The setting keeps that
 * property — the gate and the job read the same one value — and adds the
 * ability to change it.
 */

/** Fiat-touching movements. Crypto-only moves never reach this gate — the
 *  send and swap paths do not import it, and that absence is enforced by
 *  the module graph, not by a runtime flag. */
export type FiatMovement = 'onramp' | 'metals-buy' | 'redemption';

export type FiatDenialCode =
  | 'kyc_required'
  | 'kyc_pending'
  | 'sanctions_review'
  | 'screening_unavailable';

/**
 * A denied fiat movement, typed for the server and generic for the client.
 *
 * The code is what support reads and what the caller maps; it never
 * reaches the client, because `detail` serialises into the error envelope
 * and a sanctions denial must be indistinguishable from a pending-KYC
 * denial from the outside (tipping-off). `toHttpError` is the single
 * mapping — every door converts through it, so the generic shape cannot
 * drift per route.
 */
export class FiatDeniedError extends Error {
  constructor(readonly code: FiatDenialCode) {
    super(`Fiat movement denied: ${code}`);
    this.name = 'FiatDeniedError';
  }

  toHttpError(): AppError {
    return AppError.forbidden(
      "This action is not available right now. Check your verification status or contact support.",
    );
  }
}

/**
 * One guard, three doors — BE-1101/BE-1105 §4.
 *
 * Checked in order, first failure short-circuits: KYC approved, then a
 * clean and fresh sanctions screen (re-screened inline when stale). Every
 * denial is a `FiatDeniedError`; the caller converts it once via
 * `toHttpError()`. Uncertainty denies at every step: an unknown user is
 * `kyc_required`, a stale screen re-screens, and a vendor that cannot be
 * reached is `screening_unavailable` — never a wave-through.
 */
@Injectable()
export class ComplianceGate {
  private readonly logger = new Logger(ComplianceGate.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KycService) private readonly kyc: KycService,
    @Inject(SystemSettingsService) private readonly settings: SystemSettingsService,
  ) {}

  async assertFiatAllowed(userId: string, movement: FiatMovement, now: Date = new Date()): Promise<void> {
    const profile = await this.prisma.kycProfile.findUnique({ where: { userId } });
    const status = profile?.status ?? 'not_started';

    if (status !== 'approved') {
      throw this.deny(
        userId, movement, status === 'pending' ? 'kyc_pending' : 'kyc_required',
      );
    }

    if (profile?.sanctionsResult === 'hit') {
      // No re-screen can clear a latch, so none is attempted. Only a human
      // decision clears it (see KycService.decide).
      throw this.deny(userId, movement, 'sanctions_review');
    }

    const screenedAt = profile?.sanctionsScreenedAt ? new Date(profile.sanctionsScreenedAt).getTime() : null;
    const ttlMs = (await this.settings.get('compliance.sanctions-rescreen-hours')) * 60 * 60_000;
    if (
      profile?.sanctionsResult === 'clean' &&
      screenedAt !== null &&
      now.getTime() - screenedAt <= ttlMs
    ) {
      return;
    }

    let screening;
    try {
      screening = await this.kyc.rescreen(userId, now);
    } catch (err) {
      if (err instanceof ScreeningUnavailableError) {
        throw this.deny(userId, movement, 'screening_unavailable');
      }
      throw err;
    }
    if (screening.result === 'hit') {
      throw this.deny(userId, movement, 'sanctions_review');
    }
  }

  private deny(userId: string, movement: FiatMovement, code: FiatDenialCode): FiatDeniedError {
    // Debug, not audit: denials are routine (an unverified user trying),
    // and every attempt writing an audit row would flood the trail. The
    // review queue already holds the profile that needs a human.
    this.logger.debug(`Fiat ${movement} denied for user ${userId}: ${code}`);
    return new FiatDeniedError(code);
  }
}
