import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  attestationStale,
  checkAttestationFreshness,
  checkLicences,
  checkProofUrls,
  type FetchText,
  type VerificationAsset,
  type VerificationIssuer,
} from './verification-checks.js';
import { VERIFICATION_FETCH } from './verification-fetch.js';
import type { VerificationPreview } from './verification-preview.js';

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
    @Inject(VERIFICATION_FETCH) private readonly fetchText: FetchText,
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
   * Check what the machine can check about an issuer's verification claim.
   *
   * Read-only and side-effect free: it fetches proof URLs and reads the
   * registry, and writes nothing. The console renders this before the
   * operator decides, so "promote" is never the first time anyone looked.
   * The judgment — does this custodian arrangement satisfy counsel, does
   * this auditor's report say what the tier claims — stays human, and the
   * tier change records the reason the human gave alongside what the
   * machine measured.
   */
  async checkVerification(
    slug: string,
    due: DueDiligence,
    now: Date = new Date(),
  ): Promise<VerificationPreview> {
    const issuer = await this.prisma.issuer.findUnique({ where: { slug } });
    if (!issuer) throw AppError.notFound('Issuer not found');

    const assets = await this.prisma.asset.findMany({
      where: { issuerId: issuer.id },
      select: {
        assetId: true,
        symbol: true,
        lastAttestedAt: true,
        attestationCadence: true,
        proofOfReserveUrl: true,
      },
    });

    return this.evaluateVerification(
      {
        slug: issuer.slug,
        licenseTypes: issuer.licenseTypes,
        licenseRefs: issuer.licenseRefs,
      },
      assets.map((a) => ({
        assetId: a.assetId,
        symbol: a.symbol,
        lastAttestedAt: a.lastAttestedAt,
        attestationCadence: a.attestationCadence as VerificationAsset['attestationCadence'],
        proofOfReserveUrl: a.proofOfReserveUrl,
      })),
      due,
      now,
    );
  }

  /**
   * The machine half, factored out: same evidence in, same verdict out.
   * `checkVerification` reads the registry; this evaluates what it read.
   * The tier change enforces the verdict; the console previews it.
   */
  async evaluateVerification(
    issuer: VerificationIssuer,
    assets: VerificationAsset[],
    due: DueDiligence,
    now: Date = new Date(),
  ): Promise<VerificationPreview> {
    const nowDate = now instanceof Date ? now : new Date(now);

    const licences = checkLicences(issuer);
    const freshness = checkAttestationFreshness(assets, nowDate);

    const urls = [due.proofOfReserves, ...(due.auditRefs ?? [])].filter(
      (u): u is string => typeof u === 'string' && u.trim().length > 0,
    );
    const reachable = await checkProofUrls(urls, this.fetchText);

    const checks = [licences, freshness, reachable];
    const checkedUrls = [...new Set(checks.flatMap((c) => c.checkedUrls ?? []))];
    // Freshness per asset, from the same function the check itself uses.
    // Restating the window here would be a second definition of "fresh" —
    // and two definitions of freshness are two answers to the same question.
    const assetResults = assets.map((a) => ({
      assetId: a.assetId,
      symbol: a.symbol,
      fresh: !attestationStale(a.lastAttestedAt, nowDate),
    }));

    return {
      passed: checks.every((c) => c.passed),
      checks,
      checkedUrls,
      assetResults,
    };
  }

  /**
   * Set the verification tier, refusing to promote to issuer-verified without
   * the evidence that would make the badge honest.
   *
   * The machine half runs first: licences on record, a fresh attestation on
   * at least one asset, and every cited proof URL answering over HTTPS. A
   * check that cannot run fails the promotion rather than waving it
   * through. The human half is the reason, recorded alongside what the
   * machine measured — the tier change is auditable as both.
   */
  async setVerifiedTier(
    slug: string,
    tier: 'issuer_verified' | 'community_verified' | 'unverified',
    due: DueDiligence,
    actor: { id: string; role: string; reason?: string },
  ) {
    const issuer = await this.prisma.issuer.findUnique({ where: { slug } });
    if (!issuer) throw AppError.notFound('Issuer not found');

    // The reason is checked before anything is written, not after. The
    // route's `@RequireAuditReason` already refuses a request without one,
    // so this is the second line — but the second line is the one that
    // matters here, because `recordChange` is the *last* thing this method
    // does, and a reason discovered at that point would arrive after the
    // tier had already moved.
    this.audit.assertReason('verifiedTier.changed', actor.reason);

    // The presence gate stays: a missing field is a missing field, and the
    // operator should hear that before any network call runs. The workflow
    // below checks that the cited evidence exists, answers, and is fresh.
    let checks: VerificationPreview | undefined;
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

      checks = await this.checkVerification(slug, due);
      if (!checks.passed) {
        throw AppError.badRequest(
          `Verification checks failed: ${checks.checks
            .filter((c) => !c.passed)
            .map((c) => `${c.name} — ${c.detail}`)
            .join(' ')} ` +
            `Fix the evidence, or record a lower tier that does not claim it.`,
        );
      }
    }

    const updated = await this.prisma.issuer.update({
      where: { slug },
      data: {
        verifiedTier: tier,
        ...(due.legalStructure ? { notes: due.legalStructure } : {}),
      },
    });

    await this.prisma.asset.updateMany({
      where: { issuerId: issuer.id },
      data: { verifiedTier: tier },
    });

    // The tier is shown to users as a trust signal, so the trail records
    // what was checked as well as what was decided: the due diligence the
    // operator cited, and — for a promotion — the machine report behind
    // it. A tier whose trail says only "promoted" is the claim this
    // workflow exists to prevent.
    //
    // The report recorded here is the *same* one that gated the promotion.
    // Re-running the checks after the write would fetch the proof URLs a
    // second time, and a URL that had gone down in between would put a
    // failing report next to a promotion the gate had already allowed —
    // a trail that contradicts itself about the same decision.
    const recordMeta: Record<string, unknown> = {
      slug,
      from: issuer.verifiedTier,
      to: tier,
      dueDiligence: due,
    };
    if (checks) {
      recordMeta.checks = checks.checks.map((c) => ({
        name: c.name,
        passed: c.passed,
        detail: c.detail,
      }));
      recordMeta.checkedUrls = checks.checkedUrls;
      recordMeta.assetResults = checks.assetResults;
    }

    await this.audit.recordChange({
      actorId: actor.id, actorRole: actor.role,
      // The destructiveness registry's name for this operation. A tier is
      // the product, and the registry treats moving one as destructive in
      // both directions — so it is recorded as a state change with the row
      // either side of it, not as a note.
      action: 'verifiedTier.changed',
      targetType: 'Issuer', targetId: issuer.id,
      reason: actor.reason,
      destructive: true,
      // The two fields this operation owns. `recordChange` derives the
      // diff from these, and skips an entry when nothing in them moved —
      // so a request that sets the tier it already has leaves no line,
      // which is the same rule every other state change follows.
      before: { verifiedTier: issuer.verifiedTier, notes: issuer.notes },
      after: { verifiedTier: tier, notes: updated.notes },
      metadata: recordMeta,
    });

    return updated;
  }

  /**
   * Record licence evidence against an existing issuer.
   *
   * Without this, an issuer created before its licences were known could never
   * satisfy the verification gate — the only way to set them was at creation.
   * A downgrade of the tier follows automatically: an issuer that loses its
   * licence evidence must not keep claiming issuer-verified.
   */
  async recordLicences(
    slug: string,
    input: { licenseTypes?: string[]; licenseRefs?: string[]; website?: string | null; notes?: string | null },
    actor: { id: string; role: string },
  ) {
    const issuer = await this.prisma.issuer.findUnique({ where: { slug } });
    if (!issuer) throw AppError.notFound('Issuer not found');

    const licenseTypes = input.licenseTypes ?? issuer.licenseTypes;
    const licenseRefs = input.licenseRefs ?? issuer.licenseRefs;

    // Verification depends on evidence existing. Remove evidence and the
    // verification must go with it, or the badge outlives its basis.
    const evidenceGone = licenseTypes.length === 0 || licenseRefs.length === 0;
    const tier = evidenceGone && issuer.verifiedTier !== 'unverified' ? 'unverified' : issuer.verifiedTier;

    const updated = await this.prisma.issuer.update({
      where: { slug },
      data: {
        licenseTypes,
        licenseRefs,
        ...(input.website !== undefined ? { website: input.website } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        verifiedTier: tier,
      },
    });

    if (tier !== issuer.verifiedTier) {
      await this.prisma.asset.updateMany({ where: { issuerId: issuer.id }, data: { verifiedTier: tier } });
    }

    await this.audit.record({
      actorId: actor.id, actorRole: actor.role,
      action: 'issuer.licences.recorded', targetType: 'Issuer', targetId: issuer.id,
      metadata: { slug, licenseTypes, licenseRefs, tierChanged: tier !== issuer.verifiedTier },
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

  /**
   * Remove a risk flag, from the issuer and from every asset that carries it.
   *
   * Adding without removing is a ratchet: every scare leaves a permanent
   * mark, and a registry that can only get scarier stops meaning anything.
   * Removal propagates the same way addition does, or an asset would keep
   * warning about a risk its issuer no longer carries.
   */
  async removeRiskFlag(slug: string, flag: string, actor: { id: string; role: string }) {
    const issuer = await this.prisma.issuer.findUnique({ where: { slug } });
    if (!issuer) throw AppError.notFound('Issuer not found');
    if (!issuer.riskFlags.includes(flag)) return issuer;

    const updated = await this.prisma.issuer.update({
      where: { slug },
      data: { riskFlags: issuer.riskFlags.filter((f) => f !== flag) },
    });
    // Prisma has no array-remove for Postgres text[]: rewrite each row's
    // array without the flag rather than pretending `push` has an inverse.
    const assets = await this.prisma.asset.findMany({
      where: { issuerId: issuer.id },
      select: { id: true, riskFlags: true },
    });
    for (const row of assets) {
      if (!row.riskFlags.includes(flag)) continue;
      await this.prisma.asset.update({
        where: { id: row.id },
        data: { riskFlags: row.riskFlags.filter((f: string) => f !== flag) },
      });
    }
    await this.audit.record({
      actorId: actor.id, actorRole: actor.role,
      action: 'issuer.riskFlag.removed', targetType: 'Issuer', targetId: issuer.id,
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
