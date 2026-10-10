import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  SCREENING_PROVIDER, ScreeningProvider, ScreeningUnavailableError,
} from './screening/screening-provider.js';
import type { InquiryDecision, ParsedWebhookEvent } from './screening/screening-provider.js';

/**
 * Identity verification state machine — BE-1101 §1.
 *
 * `KycProfile.status` is the record; `User.kycStatus` is its denormalised
 * mirror, written in the same transaction every time the profile moves, so
 * the two can never disagree. The gate reads the user row; the console
 * reads the profile; both say the same thing because there is one write.
 *
 * The asymmetry is deliberate throughout: a clean pass approves with no
 * human, and everything else parks for one. False declines are support
 * tickets; false approvals are legal exposure. Only a human writes
 * `rejected` (see the review queue), and only a human clears a sanctions
 * hit — a later clean screen records without unfreezing, because list
 * matching jitters and jitter must not decide who can buy gold.
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SCREENING_PROVIDER) private readonly screening: ScreeningProvider,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * Open verification for the user. Idempotent while pending: re-entry
   * returns the live inquiry rather than spawning a second one, because two
   * live inquiries would race each other's webhooks.
   */
  async startVerification(userId: string): Promise<{ status: string; inquiryId: string; sessionToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('Account not found');

    const existing = await this.prisma.kycProfile.findUnique({ where: { userId } });
    if (existing?.status === 'pending' && existing.providerRef) {
      // The session token is short-lived vendor-side; re-entry reuses the
      // inquiry, and the client resumes it through the vendor flow.
      return { status: 'pending', inquiryId: existing.providerRef, sessionToken: '' };
    }

    let inquiry;
    try {
      inquiry = await this.screening.createInquiry(userId);
    } catch (err) {
      if (err instanceof ScreeningUnavailableError) {
        throw AppError.providerUnavailable('Verification is temporarily unavailable. Try again.');
      }
      throw err;
    }

    // One write for both rows: the mirror is atomic by construction, not by
    // coincidence. A reader of either column sees the same status.
    const [profile] = await this.prisma.$transaction([
      this.prisma.kycProfile.upsert({
        where: { userId },
        create: {
          userId,
          status: 'pending',
          providerRef: inquiry.inquiryId,
          provider: this.screening.name,
        },
        update: {
          status: 'pending',
          providerRef: inquiry.inquiryId,
          provider: this.screening.name,
          needsReview: false,
        },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { kycStatus: 'pending' } }),
    ]);

    await this.audit.record({
      actorId: userId,
      action: 'kyc.started',
      targetType: 'KycProfile',
      targetId: profile.id,
      metadata: { provider: this.screening.name, inquiryId: inquiry.inquiryId },
    });

    return { status: 'pending', inquiryId: inquiry.inquiryId, sessionToken: inquiry.sessionToken };
  }

  /**
   * Apply a parsed, signature-verified webhook event.
   *
   * Returns whether anything was applied and why not. A webhook that is
   * valid but inapplicable (duplicate, unbound, stale, unknown user) is
   * acknowledged, never applied — and never an error, because Persona
   * retries errors and retrying an inapplicable event changes nothing.
   */
  async applyWebhookEvent(event: ParsedWebhookEvent): Promise<{ applied: boolean; status?: string; reason?: string }> {
    // Idempotency first: "approved then approved again" must not double-write.
    try {
      await this.prisma.webhookEvent.create({
        data: { provider: this.screening.name, eventId: event.eventId },
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return { applied: false, reason: 'duplicate' };
      throw err;
    }

    if (!event.referenceId) {
      // No reference on the event: fall back to the inquiry-id reverse
      // lookup. Inquiry ids are vendor-unique and each profile holds at
      // most one live inquiry, so at most one profile can claim an event —
      // but "at most one" is a property of our writes, verified below by
      // matching the user when both sides exist.
      const bound = await this.prisma.kycProfile.findFirst({
        where: { providerRef: event.inquiryId },
      });
      if (!bound) return { applied: false, reason: 'unbound' };
      return this.applyBound(bound.userId, bound, event);
    }
    const user = await this.prisma.user.findUnique({ where: { id: event.referenceId } });
    if (!user) return { applied: false, reason: 'unknown_user' };

    const profile = await this.prisma.kycProfile.findUnique({ where: { userId: user.id } });
    // Signature proves the event came from the vendor, not that it is ours:
    // the inquiry must be the one this profile holds. Both sides agreeing
    // is the binding; either side alone is not.
    if (!profile || profile.providerRef !== event.inquiryId) {
      return { applied: false, reason: 'unbound' };
    }

    return this.applyBound(user.id, profile, event);
  }

  private async applyBound(
    userId: string,
    profile: { id: string; status: string; providerRef: string | null; lastDecisionAt: Date | null },
    event: ParsedWebhookEvent,
  ): Promise<{ applied: boolean; status?: string; reason?: string }> {
    // Stale events lose to newer decisions. Webhooks reorder; applying an
    // older verdict over a newer one would un-approve an approval.
    if (profile.lastDecisionAt && event.occurredAt <= new Date(profile.lastDecisionAt)) {
      return { applied: false, reason: 'stale' };
    }

    if (!event.decision) return { applied: true, status: profile.status };

    const status = await this.applyDecision(userId, profile.id, event);
    return { applied: true, status };
  }

  /**
   * A fresh list check outside any inquiry flow — the fiat gate's inline
   * re-screen and the nightly job's early warning share this path.
   *
   * Stamped with the caller's `now`, not the wall clock and not the
   * vendor's timestamp: scheduled work takes its time from the caller so a
   * test can put a screen one second past the TTL without waiting a second,
   * and the recorded time is the time the decision was made.
   */
  async rescreen(userId: string, now: Date): Promise<{ result: 'clean' | 'hit'; screenedAt: Date }> {
    const profile = await this.prisma.kycProfile.findUnique({ where: { userId } });
    if (!profile) throw AppError.notFound('No verification profile for this account');

    const screening = await this.screening.rescreen(userId, profile.providerRef ?? undefined);

    if (screening.result === 'hit') {
      await this.latchHit(userId, 'rescreen', now);
    } else {
      // Records without unfreezing: if a hit latched earlier, only a human
      // clears it. The update is conditional on no latched hit for exactly
      // that reason — an unconditional write would let matching jitter
      // quietly unfreeze through the back door.
      const profile = await this.prisma.kycProfile.findUnique({ where: { userId } });
      if (profile && profile.sanctionsResult !== 'hit') {
        await this.prisma.kycProfile.update({
          where: { userId },
          data: { sanctionsResult: 'clean', sanctionsScreenedAt: now },
        });
      }
    }

    await this.audit.record({
      actorId: 'system',
      action: 'sanctions.rescreened',
      targetType: 'KycProfile',
      targetId: userId,
      metadata: { result: screening.result },
    });

    return { result: screening.result, screenedAt: now };
  }

  /**
   * The review decision — the only path that writes `rejected` or clears a
   * sanctions hit. Machine output parks; humans decide.
   */
  async decide(userId: string, operatorId: string, decision: 'approve' | 'reject', reason: string): Promise<{ status: string }> {
    this.audit.assertReason(`kyc.${decision}`, reason);

    const profile = await this.prisma.kycProfile.findUnique({ where: { userId } });
    if (!profile) throw AppError.notFound('No verification profile for this account');
    if (!profile.needsReview) {
      throw AppError.conflict('This profile is not awaiting review');
    }

    const status = decision === 'approve' ? 'approved' : 'rejected';
    const [updated] = await this.prisma.$transaction([
      this.prisma.kycProfile.update({
        where: { userId },
        data: {
          status,
          needsReview: false,
          reviewedBy: operatorId,
          reviewedAt: new Date(),
          // An approval is the one human act that clears a latched hit.
          // A rejection leaves the latch in place: the account cannot move
          // fiat either way, and a later review starts from frozen, not open.
          ...(decision === 'approve'
            ? { sanctionsResult: 'clean', sanctionsScreenedAt: new Date() }
            : {}),
        },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { kycStatus: status } }),
    ]);

    await this.audit.record({
      actorId: operatorId,
      action: `kyc.${decision}d`,
      targetType: 'KycProfile',
      targetId: profile.id,
      reason,
      metadata: { previousStatus: profile.status },
    });

    return { status: updated.status };
  }

  /** Profiles waiting on a human, oldest first. Operational fields only:
   *  the operator needs the inquiry id to open the vendor record; identity
   *  documents never appear because they were never stored. */
  async reviewQueue(limit = 100): Promise<Array<Record<string, unknown>>> {
    const rows = await this.prisma.kycProfile.findMany({
      where: { needsReview: true },
      orderBy: { updatedAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: { user: { select: { id: true, email: true } } },
    });
    return rows.map((r) => ({
      userId: r.userId,
      email: r.user.email,
      status: r.status,
      provider: r.provider,
      providerRef: r.providerRef,
      sanctionsResult: r.sanctionsResult,
      sanctionsScreenedAt: r.sanctionsScreenedAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  private async applyDecision(
    userId: string, profileId: string, event: ParsedWebhookEvent,
  ): Promise<string> {
    const decision = event.decision as InquiryDecision;
    // One clock for ordering: the envelope time is what staleness compares,
    // so it is also what staleness stores. The decision's own timestamp
    // travels in the audit metadata instead — two clocks that can disagree
    // are how a stale event gets applied "because its decision was newer".
    const at = event.occurredAt;

    // The halves apply independently: verification and lists arrive on
    // different events (inquiry.approved carries no watchlist signal, and a
    // watchlist report carries no verdict), so neither half may assume the
    // other. An approval must not double as a clean screen, and a list
    // signal must not move verification status.
    if (decision.watchlist === 'hit') {
      await this.latchHit(userId, event.eventId, at);
      await this.audit.record({
        actorId: 'system',
        action: 'kyc.parked',
        targetType: 'KycProfile',
        targetId: profileId,
        metadata: { eventId: event.eventId, verdict: decision.verdict, codes: decision.codes, reason: 'watchlist hit' },
      });
      // A hit ends the event: verification does not advance on a verdict
      // that arrived holding a list match. "Approved" must mean approved
      // with nothing outstanding — an approved-but-frozen row tells two
      // stories, and the gate would have to explain which one it believes.
      // The identity fact is not lost: the codes carry the verdict, and
      // review decides both halves together.
      return 'pending';
    } else if (decision.watchlist === 'clean') {
      // A clean list signal records without unfreezing (see rescreen):
      // the latch guard below is what keeps matching jitter from
      // quietly opening through this path.
      const profile = await this.prisma.kycProfile.findUnique({ where: { userId } });
      if (profile && profile.sanctionsResult !== 'hit') {
        await this.prisma.kycProfile.update({
          where: { userId },
          data: { sanctionsResult: 'clean', sanctionsScreenedAt: at },
        });
      }
      if (decision.verdict === null) {
        await this.prisma.kycProfile.update({ where: { userId }, data: { lastDecisionAt: at } });
        return profile?.status ?? 'pending';
      }
    }

    if (decision.verdict === 'passed') {
      // A latched hit survives a passing verification: the identity check
      // and the list check are separate facts, and approving the first must
      // not clear the second. The profile advances to approved (the gate
      // still denies on the latch), the freeze and the review flag stay, and
      // only a human decision clears them.
      //
      // And an approval with no list signal writes no list fact: inquiry
      // events carry none, so a `clean` written here would be invented.
      const latched =
        (await this.prisma.kycProfile.findUnique({ where: { userId } }))?.sanctionsResult === 'hit';
      const [updated] = await this.prisma.$transaction([
        this.prisma.kycProfile.update({
          where: { userId },
          data: latched
            ? {
                status: 'approved',
                reviewedBy: null,
                lastDecisionAt: at,
              }
            : {
                status: 'approved',
                ...(decision.watchlist === 'clean'
                  ? { sanctionsResult: 'clean' as const, sanctionsScreenedAt: at }
                  : {}),
                needsReview: false,
                reviewedBy: null,
                lastDecisionAt: at,
              },
        }),
        this.prisma.user.update({ where: { id: userId }, data: { kycStatus: 'approved' } }),
      ]);
      await this.audit.record({
        actorId: 'system',
        action: 'kyc.approved',
        targetType: 'KycProfile',
        targetId: profileId,
        metadata: { eventId: event.eventId, verdict: decision.verdict, codes: decision.codes, automatic: true },
      });
      return updated.status;
    }

    // needs_review or declined: park. A machine decline never finalises a
    // rejection — the operator confirms, or the user retries.
    if (decision.verdict === 'declined' || decision.verdict === 'needs_review') {
      await this.prisma.kycProfile.update({
        where: { userId },
        data: { needsReview: true, lastDecisionAt: at },
      });
      await this.audit.record({
        actorId: 'system',
        action: 'kyc.parked',
        targetType: 'KycProfile',
        targetId: profileId,
        metadata: { eventId: event.eventId, verdict: decision.verdict, codes: decision.codes },
      });
      return 'pending';
    }

    // Neither half says anything (a dismissal, an unknown future event, a
    // lifecycle note): the watermark still moves so ordering keeps working,
    // and a dismissal is audited because a human acted — just not ours, so
    // the latch stays for our operator to decide.
    await this.prisma.kycProfile.update({ where: { userId }, data: { lastDecisionAt: at } });
    if (decision.codes.length > 0) {
      await this.audit.record({
        actorId: 'system',
        action: 'webhook.noted',
        targetType: 'KycProfile',
        targetId: profileId,
        metadata: { eventId: event.eventId, codes: decision.codes },
      });
    }
    const current = await this.prisma.kycProfile.findUnique({ where: { userId } });
    return current?.status ?? 'pending';
  }

  private async latchHit(userId: string, source: string, at: Date): Promise<void> {
    // Update, not upsert: every path that latches already holds a profile
    // (startVerification creates it; the gate only rescreens the approved,
    // who were approved through it). A hit for a user with no profile is a
    // caller bug, and creating a pending profile from thin air would mark a
    // never-verified user as mid-verification.
    //
    // The user mirror needs no write here: latching never changes `status`,
    // so whatever the mirror says still matches.
    await this.prisma.kycProfile.update({
      where: { userId },
      data: {
        sanctionsResult: 'hit',
        sanctionsScreenedAt: at,
        needsReview: true,
      },
    });
    this.logger.warn(`Sanctions hit latched for user ${userId} (source: ${source})`);
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' && err !== null &&
      'code' in err && (err as { code: unknown }).code === 'P2002'
    );
  }
}
