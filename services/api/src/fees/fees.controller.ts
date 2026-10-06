import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { RequireAuditReason } from '../audit/audit-reason.guard.js';
import { FeesService } from './fees.service.js';
import {
  createFeeRuleSchema, listFeeRulesSchema, previewFeesSchema, updateFeeRuleSchema,
  type CreateFeeRuleDto, type ListFeeRulesDto, type PreviewFeesDto, type UpdateFeeRuleDto,
} from './dto/fee-rule.dto.js';

/**
 * The fee surface, and its three separate capabilities.
 *
 * Being told what you are about to be charged, reading how the rate table is
 * configured, and changing how everyone is priced are three different trusts,
 * and they are gated three different ways here. Collapsing them would mean a
 * support agent answering "what did this customer pay?" is one step from being
 * able to re-price the product.
 *
 *   POST   /fees/preview        any signed-in account
 *   GET    /fees/rules          admin
 *   GET    /fees/rules/:id      admin
 *   GET    /fees/rules/diagnostics  admin
 *   POST   /fees/rules          owner, with a reason
 *   PATCH  /fees/rules/:id      owner, with a reason
 *
 * Read is `admin` and write is `owner`. Both are `admin`-or-higher — the
 * surface is an admin surface — but they are not the same permission, which is
 * the property that matters. The seeded development account is `admin`, so it
 * can read the table and cannot re-price it; an owner promotes it.
 */
@ApiTags('fees')
@Controller('fees')
export class FeesController {
  constructor(@Inject(FeesService) private readonly fees: FeesService) {}

  /**
   * A fee preview, for any signed-in account.
   *
   * Deliberately the lowest privilege of the three, and separate from them on
   * purpose. This route exposes no rule ids, no priority and no operator
   * identity — only the itemisation a quote would carry. `support` can answer
   * "what did this customer pay?" with it and still cannot see how the rate
   * table is configured.
   */
  @Post('preview')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Itemised fees for an operation. No rule ids, no rate table.' })
  preview(@Body(zodPipe(previewFeesSchema)) dto: PreviewFeesDto) {
    return this.fees.breakdown(dto);
  }

  /**
   * The rule table.
   *
   * Gated `admin`, and separately from the write routes below. The distinction
   * is the point: the first question is "what did this customer pay?", the
   * second is "how do I change what everybody pays?".
   */
  @Get('rules')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fee rules. Readable by admin; writable only by owner.' })
  listRules(@Query(zodPipe(listFeeRulesSchema)) query: ListFeeRulesDto) {
    return this.fees.listRules(query);
  }

  /**
   * Ambiguous rule pairs.
   *
   * Registered before `:id` so the literal segment cannot be shadowed by the
   * parameter, and gated like the table it describes — the diagnostic says
   * which rows are about to make a quote unpriceable, which is operator
   * information and nothing a customer needs.
   */
  @Get('rules/diagnostics')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rule pairs that can both apply and neither of which wins.' })
  diagnostics() {
    return this.fees.diagnostics();
  }

  @Get('rules/:id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'One fee rule' })
  findOne(@Param('id') id: string) {
    return this.fees.findRule(id);
  }

  /**
   * Create a rule.
   *
   * `owner`, and it needs a reason. A new rule changes what every subsequent
   * quote costs, so from this moment on it is load-bearing — which is the
   * sense in which a create is a destructive action even though it destroys
   * nothing that exists. `@RequireAuditReason` enforces that at the edge,
   * before anything is written; `recordChange({ destructive: true })` is the
   * second gate inside the service.
   */
  @Post('rules')
  @Roles('owner')
  @ApiBearerAuth()
  @RequireAuditReason('create a fee rule')
  @ApiOperation({ summary: 'Create a fee rule. Owner only. Requires a reason.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body(zodPipe(createFeeRuleSchema)) dto: CreateFeeRuleDto) {
    return this.fees.createRule(dto, { id: user.id, role: user.role });
  }

  /**
   * Change a rule.
   *
   * A rate is a price. Changing one without saying why leaves the audit trail
   * recording that a number moved and nothing about why, which is the half an
   * investigator six weeks later actually needs.
   */
  @Patch('rules/:id')
  @Roles('owner')
  @ApiBearerAuth()
  @RequireAuditReason('change a fee rule')
  @ApiOperation({ summary: 'Change a fee rule. Owner only. Requires a reason.' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(updateFeeRuleSchema)) dto: UpdateFeeRuleDto,
  ) {
    return this.fees.updateRule(id, dto, { id: user.id, role: user.role });
  }
}
