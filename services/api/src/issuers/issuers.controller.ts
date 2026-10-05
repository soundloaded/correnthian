import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
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
});

const riskFlagSchema = z.object({ flag: z.string().min(2).max(80) });

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

  @Post()
  @Roles('compliance')
  @ApiOperation({ summary: 'Register an issuer. New issuers are always created unverified.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body(zodPipe(createSchema)) dto: z.infer<typeof createSchema>) {
    return this.issuers.create(dto, { id: user.id, role: user.role });
  }

  @Patch(':slug/verification')
  @Roles('compliance')
  @ApiOperation({ summary: 'Set verification tier. Issuer-verified requires evidence.' })
  setTier(@Param('slug') slug: string, @Body(zodPipe(tierSchema)) dto: z.infer<typeof tierSchema>, @CurrentUser() user: AuthenticatedUser) {
    return this.issuers.setVerifiedTier(slug, dto.tier, dto, { id: user.id, role: user.role });
  }

  @Patch(':slug/risk-flags')
  @Roles('compliance')
  @ApiOperation({ summary: 'Attach a risk flag, propagated to every asset from this issuer' })
  addRiskFlag(@Param('slug') slug: string, @Body(zodPipe(riskFlagSchema)) dto: z.infer<typeof riskFlagSchema>, @CurrentUser() user: AuthenticatedUser) {
    return this.issuers.addRiskFlag(slug, dto.flag, { id: user.id, role: user.role });
  }
}
