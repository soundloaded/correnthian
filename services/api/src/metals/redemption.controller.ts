import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Idempotent } from '../common/idempotency/idempotency.decorator.js';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { RedemptionService } from './redemption.service.js';

const requestSchema = z.object({
  assetId: z.string().min(1),
  amountRaw: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
  providerSlug: z.string().min(1),
  destination: z.record(z.string(), z.unknown()).optional(),
});

const transitionSchema = z.object({
  state: z.enum(['kyc_pending', 'approved', 'in_production', 'shipped', 'delivered', 'rejected', 'cancelled']),
});

@ApiTags('redemptions')
@ApiBearerAuth()
@Controller('redemptions')
export class RedemptionController {
  constructor(@Inject(RedemptionService) private readonly redemptions: RedemptionService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Request physical redemption. Requires a redeemable asset and a permitted jurisdiction.' })
  async request(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(requestSchema)) dto: z.infer<typeof requestSchema>,
  ) {
    // No jurisdiction field on the DTO, and none on
    // `RedemptionRequestInput` either. The service reads `country`/`region`
    // off the account record; a client cannot claim a location, so it cannot
    // claim a jurisdiction where redemption happens to be permitted.
    return this.redemptions.request({
      userId: user.id,
      amountRaw: dto.amountRaw,
      assetId: dto.assetId,
      providerSlug: dto.providerSlug,
      destination: dto.destination,
    });
  }

  @Get('mine')
  @ApiOperation({ summary: "Redemptions for the current account" })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.redemptions.listForUser(user.id);
  }

  @Patch(':id/transition')
  @Roles('compliance')
  @ApiOperation({ summary: 'Advance a redemption through its state machine' })
  transition(
    @Param('id') id: string,
    @Body(zodPipe(transitionSchema)) dto: z.infer<typeof transitionSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.redemptions.transition(id, dto.state, { id: user.id, role: user.role });
  }

  @Get('stats')
  @Roles('support')
  @ApiOperation({ summary: 'Redemption counters' })
  stats() {
    return this.redemptions.stats();
  }
}
