import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { RequireAuditReason } from '../audit/audit-reason.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { IssuersService } from './issuers.service.js';

const createSchema = z.object({
  slug: z.string().min(2).max(64),
  name: z.string().min(1).max(160),
  jurisdiction: z.string().length(2),
  licenseTypes: z.array(z.string().max(80)).max(20).default([]),
  licenseRefs: z.array(z.string().max(120)).max(40).default([]),
  website: z.string().url().max(300).nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
});

const tierSchema = z.object({
  tier: z.enum(['issuer_verified', 'community_verified', 'unverified']),
  legalStructure: z.string().max(500).optional(),
  custodian: z.string().max(160).optional(),
  proofOfReserves: z.string().url().max(500).optional(),
  auditRefs: z.array(z.string().max(200)).max(20).optional(),
  regulatorRefs: z.array(z.string().max(200)).max(20).optional(),
  notes: z.string().max(2000).optional(),
  /**
   * Why this tier, in the operator's own words. Declared here so it
   * survives validation rather than being stripped — a guard reading
   * `req.body.reason` and a pipe that removed it would be a guard that
   * never fires.
   */
  reason: z.string().min(8).max(2000).optional(),
});

const riskFlagSchema = z.object({ flag: z.string().min(2).max(80) });

/**
 * What the operator cited as evidence, as query params.
 *
 * The preview asks the same question the tier change enforces — licences,
 * freshness, reachability — against the evidence the operator *would* cite.
 * A GET because it writes nothing: previews must be safe to run, re-run,
 * and link to. `auditRefs` arrives comma-separated because repeated query
 * keys need framework support the pipe does not promise; one string the
 * pipe splits is explicit about the shape.
 */
const checkQuerySchema = z.object({
  custodian: z.string().max(160).optional(),
  proofOfReserves: z.string().url().max(500).optional(),
  auditRefs: z
    .string()
    .max(4000)
    .optional()
    .transform((raw) =>
      raw === undefined ? undefined : raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
    ),
});

const licencesSchema = z.object({
  // Optional, and deliberately without a `[]` default: an omitted field means
  // "leave alone", an explicit `[]` means "there is none". Collapsing the two
  // makes clearing evidence a silent no-op.
  licenseTypes: z.array(z.string().max(80)).max(20).optional(),
  licenseRefs: z.array(z.string().max(120)).max(40).optional(),
  website: z.string().url().max(300).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

@ApiTags('issuers')
@ApiBearerAuth()
@Controller('issuers')
export class IssuersController {
  constructor(@Inject(IssuersService) private readonly issuers: IssuersService) {}

  @Get()
  @Roles('support')
  @ApiOperation({ summary: 'Issuer registry' })
  list() {
    return this.issuers.list();
  }

  @Get('stats')
  @Roles('support')
  @ApiOperation({ summary: 'Issuer counters by tier' })
  stats() {
    return this.issuers.stats();
  }

  @Get(':slug')
  @Roles('support')
  @ApiOperation({ summary: 'Issuer detail with its assets' })
  findOne(@Param('slug') slug: string) {
    return this.issuers.findBySlug(slug);
  }

  /**
   * What the machine can check about an issuer's verification claim.
   *
   * Read-only and side-effect free: it fetches proof URLs and reads the
   * registry, and writes nothing. The console renders this before the
   * operator decides, so "promote" is never the first time anyone looked.
   * The verdict the tier change enforces and the preview the console shows
   * are the same evaluation — one read, not two opinions.
   */
  @Get(':slug/verification-checks')
  @Roles('support')
  @ApiOperation({
    summary: 'Machine verification checks for one issuer: licences, attestation freshness, proof URLs.',
    description:
      'Read-only. Every check the tier change enforces, without enforcing it: ' +
      'licences on record, a fresh attestation on at least one asset, and every ' +
      'cited proof URL answering over HTTPS. Unverifiable fails, never passes.',
  })
  checkVerification(@Param('slug') slug: string, @Query(zodPipe(checkQuerySchema)) q: z.infer<typeof checkQuerySchema>) {
    return this.issuers.checkVerification(
      slug,
      {
        custodian: q.custodian,
        proofOfReserves: q.proofOfReserves,
        auditRefs: q.auditRefs,
      },
    );
  }

  @Post()
  @Roles('compliance')
  @ApiOperation({ summary: 'Register an issuer. New issuers are always created unverified.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body(zodPipe(createSchema)) dto: z.infer<typeof createSchema>) {
    return this.issuers.create(dto, { id: user.id, role: user.role });
  }

  @Patch(':slug/verification')
  @Roles('compliance')
  @RequireAuditReason('change an issuer verification tier')
  @ApiOperation({ summary: 'Set verification tier. Issuer-verified requires evidence. Requires a reason.' })
  setTier(@Param('slug') slug: string, @Body(zodPipe(tierSchema)) dto: z.infer<typeof tierSchema>, @CurrentUser() user: AuthenticatedUser) {
    const { reason, ...due } = dto;
    return this.issuers.setVerifiedTier(slug, due.tier, due, { id: user.id, role: user.role, reason });
  }

  @Patch(':slug/licences')
  @Roles('compliance')
  @ApiOperation({ summary: 'Record licence evidence. Removing evidence removes the verified tier with it.' })
  recordLicences(@Param('slug') slug: string, @Body(zodPipe(licencesSchema)) dto: z.infer<typeof licencesSchema>, @CurrentUser() user: AuthenticatedUser) {
    return this.issuers.recordLicences(slug, dto, { id: user.id, role: user.role });
  }

  @Patch(':slug/risk-flags')
  @Roles('compliance')
  @ApiOperation({ summary: 'Attach a risk flag, propagated to every asset from this issuer' })
  addRiskFlag(@Param('slug') slug: string, @Body(zodPipe(riskFlagSchema)) dto: z.infer<typeof riskFlagSchema>, @CurrentUser() user: AuthenticatedUser) {
    return this.issuers.addRiskFlag(slug, dto.flag, { id: user.id, role: user.role });
  }

  @Delete(':slug/risk-flags/:flag')
  @Roles('compliance')
  @ApiOperation({ summary: 'Remove a risk flag, from the issuer and every asset that carries it' })
  removeRiskFlag(@Param('slug') slug: string, @Param('flag') flag: string, @CurrentUser() user: AuthenticatedUser) {
    return this.issuers.removeRiskFlag(slug, flag, { id: user.id, role: user.role });
  }
}
