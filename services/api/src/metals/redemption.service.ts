import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { AuditService } from '../audit/audit.service.js';
import { JurisdictionService } from '../compliance/jurisdiction.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface RedemptionRequestInput {
  userId: string;
  assetId: string;
  amountRaw: string;
  country: string | null;
  region: string | null;
  providerSlug: string;
  destination?: Record<string, unknown>;
}

/**
 * Physical redemption.
 *
 * This is Correnthian's most operationally exposed feature and the one most
 * likely to be quietly wrong. Two rules are enforced here rather than trusted:
 *
 * 1. The asset must actually be redeemable. A token without redemption support
 *    cannot be redeemed regardless of what the request says.
 * 2. The jurisdiction must permit it. Selling physical metal is licensed
 *    activity in many US states, so the jurisdiction engine gates this more
 *    strictly than it gates a crypto swap.
 *
 * State advances only through explicit transitions. Nothing here auto-approves.
 */
@Injectable()
export class RedemptionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JurisdictionService) private readonly jurisdiction: JurisdictionService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async request(input: RedemptionRequestInput) {
    if (!/^\d+(\.\d+)?$/.test(input.amountRaw)) {
      throw AppError.badRequest('amountRaw must be a positive decimal string');
    }

    const [asset, provider] = await Promise.all([
      this.prisma.asset.findUnique({ where: { assetId: input.assetId } }),
      this.prisma.provider.findUnique({ where: { slug: input.providerSlug } }),
    ]);

    if (!asset) throw AppError.notFound('Asset not in the registry');
    // The most important check. A token that cannot be redeemed must never
    // produce a redemption.
    if (!asset.redeemSupported) {
      throw AppError.badRequest(`${asset.symbol} cannot be redeemed for physical metal`);
    }
    if (!asset.enabled) throw AppError.badRequest(`${asset.symbol} is not currently enabled`);

    if (!provider) throw AppError.notFound(`Unknown provider: ${input.providerSlug}`);
    if (provider.status === 'disabled') {
      throw AppError.providerUnavailable('This redemption provider is not available');
    }

    await this.jurisdiction.assertEligible(input.country, input.region, 'redeem');
    if (await this.jurisdiction.isProviderBlocked(input.country, input.region, input.providerSlug)) {
      throw AppError.jurisdictionBlocked('This redemption provider is not available in your jurisdiction.');
    }

    const request = await this.prisma.redemptionRequest.create({
      data: {
        userId: input.userId,
        assetId: asset.id,
        providerId: provider.id,
        amountRaw: input.amountRaw,
        state: 'requested',
        destination: (input.destination ?? {}) as object,
      },
    });

    await this.audit.record({
      actorId: input.userId,
      action: 'redemption.requested',
      targetType: 'RedemptionRequest',
      targetId: request.id,
      metadata: { assetId: asset.assetId, provider: provider.slug, amountRaw: input.amountRaw },
    });

    return request;
  }

  listForUser(userId: string) {
    return this.prisma.redemptionRequest.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      include: { asset: { select: { assetId: true, symbol: true, name: true } } },
    });
  }

  /**
   * Advance the state machine. Rejects transitions that skip a control rather
   * than silently accepting them — an out-of-order update usually means two
   * operators disagree about what happened.
   */
  async transition(
    id: string,
    next: 'kyc_pending' | 'approved' | 'in_production' | 'shipped' | 'delivered' | 'rejected' | 'cancelled',
    actor: { id: string; role: string },
  ) {
    const ALLOWED: Record<string, string[]> = {
      requested: ['kyc_pending', 'approved', 'rejected', 'cancelled'],
      kyc_pending: ['approved', 'rejected', 'cancelled'],
      approved: ['in_production', 'cancelled'],
      in_production: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      rejected: [],
      cancelled: [],
    };

    const current = await this.prisma.redemptionRequest.findUnique({ where: { id } });
    if (!current) throw AppError.notFound('Redemption request not found');

    if (!ALLOWED[current.state]?.includes(next)) {
      throw AppError.badRequest(`Cannot move a redemption from "${current.state}" to "${next}"`);
    }

    const updated = await this.prisma.redemptionRequest.update({
      where: { id },
      data: { state: next, ...(next === 'approved' ? { reviewedBy: actor.id } : {}) },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: `redemption.${next}`,
      targetType: 'RedemptionRequest',
      targetId: id,
      metadata: { from: current.state, to: next },
    });

    return updated;
  }

  async stats() {
    const [total, byState] = await Promise.all([
      this.prisma.redemptionRequest.count(),
      this.prisma.redemptionRequest.groupBy({ by: ['state'], _count: { _all: true } }),
    ]);
    return { total, byState: Object.fromEntries(byState.map((r) => [r.state, r._count._all])) };
  }
}
