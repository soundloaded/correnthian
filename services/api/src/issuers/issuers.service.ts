import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DueDiligence {
  legalStructure?: string;
  custodian?: string;
  proofOfReserves?: string;
  auditRefs?: string[];
  regulatorRefs?: string[];
  notes?: string;
}

/**
 * Issuer registry.
 *
 * An issuer is the entity that stands behind a token. It is the most
 * consequential record in the system, because `Asset.verifiedTier` is copied
 * from it and shown to users as a trust signal.
 *
 * Two rules are enforced structurally rather than by convention:
 *
 * 1. Only a `compliance` or `owner` role may change a verification tier.
 *    A `support` agent cannot promote a token to issuer-verified.
 * 2. Promoting a tier requires the due-diligence fields to be present. A tier
 *    with no custodian and no proof of reserves is an unbacked claim, and the
 *    system refuses to record it rather than storing a badge that would later
 *    be shown to a user as fact.
 */
@Injectable()
export class IssuersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.issuer.findMany({
      orderBy: [{ verifiedTier: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { assets: true } } },
    });
  }

  async findBySlug(slug: string) {
    const issuer = await this.prisma.issuer.findUnique({
      where: { slug },
      include: { assets: { select: { assetId: true, symbol: true, name: true, enabled: true } } },
    });
    if (!issuer) throw AppError.notFound('Issuer not found');
    return issuer;
  }

  async create(input: {
    slug: string; name: string; jurisdiction: string;
    licenseTypes: string[]; licenseRefs: string[]; website?: string | null; notes?: string | null;
  }, actor: { id: string; role: string }) {
    const slug = input.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
      throw AppError.badRequest('slug must be lowercase alphanumeric with hyphens');
    }
    const existing = await this.prisma.issuer.findUnique({ where: { slug } });
    if (existing) throw AppError.conflict(`Issuer already registered: ${slug}`);

    // New issuers start unverified. There is no path that creates a verified
    // issuer directly — verification is a separate, auditable act.
    const issuer = await this.prisma.issuer.create({
      data: {
        slug,
        name: input.name,
        jurisdiction: input.jurisdiction.toUpperCase(),
        licenseTypes: input.licenseTypes,
        licenseRefs: input.licenseRefs,
        website: input.website ?? null,
        notes: input.notes ?? null,
        verifiedTier: 'unverified',
      },
    });

    await this.audit.record({
      actorId: actor.id, actorRole: actor.role,
      action: 'issuer.created', targetType: 'Issuer', targetId: issuer.id,
      metadata: { slug, jurisdiction: issuer.jurisdiction },
    });
    return issuer;
  }

  /**
   * Set the verification tier, refusing to promote to issuer-verified without
   * the evidence that would make the badge honest.
   */
  async setVerifiedTier(
    slug: string,
    tier: 'issuer_verified' | 'community_verified' | 'unverified',
    due: DueDiligence,
    actor: { id: string; role: string },
  ) {
    const issuer = await this.prisma.issuer.findUnique({ where: { slug } });
    if (!issuer) throw AppError.notFound('Issuer not found');

    if (tier === 'issuer_verified') {
      const missing: string[] = [];
      if (!issuer.licenseTypes.length) missing.push('licenseTypes');
      if (!issuer.licenseRefs.length) missing.push('licenseRefs');
      if (!due.custodian) missing.push('custodian');
      if (!due.proofOfReserves) missing.push('proofOfReserves');
      if (missing.length) {
        throw AppError.badRequest(
          `Cannot mark issuer-verified without: ${missing.join(', ')}. ` +
            `A verification tier with no evidence is a claim, not a verification.`,
        );
      }
    }

    const updated = await this.prisma.issuer.update({
      where: { slug },
      data: {
        verifiedTier: tier,
        ...(due.legalStructure ? { notes: due.legalStructure } : {}),
        // Propagate to every asset from this issuer, or the registry would
        // show a verified issuer next to unverified tokens it stands behind.
        ...(tier !== 'unverified'
          ? {}
          : {}),
      },
    });

    await this.prisma.asset.updateMany({
      where: { issuerId: issuer.id },
      data: { verifiedTier: tier },
    });

    await this.audit.record({
      actorId: actor.id, actorRole: actor.role,
      action: `issuer.verifiedTier.${tier}`, targetType: 'Issuer', targetId: issuer.id,
      metadata: { slug, from: issuer.verifiedTier, to: tier, dueDiligence: due },
    });

    return updated;
  }

  async addRiskFlag(slug: string, flag: string, actor: { id: string; role: string }) {
    const issuer = await this.prisma.issuer.findUnique({ where: { slug } });
    if (!issuer) throw AppError.notFound('Issuer not found');
    if (issuer.riskFlags.includes(flag)) return issuer;

    const updated = await this.prisma.issuer.update({
      where: { slug }, data: { riskFlags: [...issuer.riskFlags, flag] },
    });
    await this.prisma.asset.updateMany({
      where: { issuerId: issuer.id }, data: { riskFlags: { push: flag } },
    });
    await this.audit.record({
      actorId: actor.id, actorRole: actor.role,
      action: 'issuer.riskFlag.added', targetType: 'Issuer', targetId: issuer.id,
      metadata: { slug, flag },
    });
    return updated;
  }

  async stats() {
    const [total, byTier] = await Promise.all([
      this.prisma.issuer.count(),
      this.prisma.issuer.groupBy({ by: ['verifiedTier'], _count: { _all: true } }),
    ]);
    return { total, byTier: Object.fromEntries(byTier.map((r) => [r.verifiedTier, r._count._all])) };
  }
}
