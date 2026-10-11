import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { RequireAuditReason } from '../audit/audit-reason.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { JurisdictionService } from './jurisdiction.service.js';
import { KycService } from './kyc.service.js';

const checkSchema = z.object({
  country: z.string().length(2).toUpperCase(),
  region: z.string().max(64).optional(),
});

const updateRuleSchema = z.object({
  canBuyCrypto: z.boolean().optional(),
  canSellCrypto: z.boolean().optional(),
  canUseMetals: z.boolean().optional(),
  canRedeem: z.boolean().optional(),
  kycRequired: z.boolean().optional(),
  blockedProviders: z.array(z.string().max(80)).max(40).optional(),
  notes: z.string().max(2000).nullable().optional(),
  active: z.boolean().optional(),
  reason: z.string().min(8).max(2000),
});

const decideSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  // Non-empty here; the real length rule lives in `assertReason`, which
  // names the action and the minimum. Two lengths would drift, and the
  // drift would be invisible until an operator's reason passed one and
  // failed the other.
  reason: z.string().min(1).max(2000),
});

@ApiTags('compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(
    @Inject(JurisdictionService) private readonly jurisdiction: JurisdictionService,
    @Inject(KycService) private readonly kyc: KycService,
  ) {}

  @Public()
  @Get('eligibility')
  @ApiOperation({ summary: 'Feature eligibility for a location. Unmatched locations are denied.' })
  check(@Query(zodPipe(checkSchema)) q: z.infer<typeof checkSchema>) {
    return this.jurisdiction.evaluate(q.country, q.region ?? null);
  }

  @Post('verification/start')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Open identity verification for the caller',
    description:
      'Creates the vendor inquiry and returns its session token for the ' +
      'vendor flow. Idempotent while pending: re-entry returns the live ' +
      'inquiry rather than a second one. Stores a pointer, never documents.',
  })
  startVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.kyc.startVerification(user.id);
  }

  @Get('rules')
  @Roles('support')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Jurisdiction rules for the operator console' })
  rules() {
    return this.jurisdiction.listRules();
  }

  @Patch('rules/:id')
  @Roles('admin')
  @ApiBearerAuth()
  @RequireAuditReason('change a jurisdiction rule')
  @ApiOperation({ summary: 'Change a jurisdiction rule. Admin only. Requires a reason.' })
  updateRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(zodPipe(updateRuleSchema)) dto: z.infer<typeof updateRuleSchema>,
  ) {
    const { reason, ...patch } = dto;
    return this.jurisdiction.updateRule(id, patch, { id: user.id, role: user.role, reason });
  }

  @Get('reviews')
  @Roles('compliance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verification profiles awaiting a human decision, oldest first' })
  reviews() {
    return this.kyc.reviewQueue();
  }

  @Post('reviews/:userId/decide')
  @Roles('compliance')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve or reject a parked verification',
    description:
      'The only path that writes `rejected` or clears a sanctions hit. ' +
      'A reason is required: an unexplained decision is not a decision.',
  })
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body(zodPipe(decideSchema)) dto: z.infer<typeof decideSchema>,
  ) {
    return this.kyc.decide(userId, user.id, dto.decision, dto.reason);
  }
}
