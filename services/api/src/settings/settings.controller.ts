import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { RequireAuditReason } from '../audit/audit-reason.guard.js';
import { SettingsService } from './settings.service.js';
import {
  createFlagSchema, updateFlagSchema,
  type CreateFlagDto, type UpdateFlagDto,
} from './dto/feature-flag.dto.js';

/**
 * The `FeatureFlag` surface — BE-1505.
 *
 * Two tiers, deliberately: any operator reads (the console renders every
 * settings page against this table), only `admin` writes. A flag flips
 * behaviour for every account at once, which is why this is not a `support`
 * action — same reasoning as `PATCH /chains/:id/enabled`.
 *
 *   GET    /settings/flags        support (class-level)
 *   POST   /settings/flags        admin, with a reason
 *   PATCH  /settings/flags/:key   admin, with a reason
 *   DELETE /settings/flags/:key   admin, with a reason
 *
 * Writes carry reasons because the audit entry for a silent behavioural flip
 * that says nothing about why is the entry nobody can act on.
 */
@ApiTags('settings')
@Controller('settings/flags')
@Roles('support')
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Every feature flag, by key. Any operator reads.' })
  list() {
    return this.settings.list();
  }

  @Post()
  @Roles('admin')
  @ApiBearerAuth()
  @RequireAuditReason('create a feature flag')
  @ApiOperation({ summary: 'Create a flag. Admin only. Requires a reason.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body(zodPipe(createFlagSchema)) dto: CreateFlagDto) {
    return this.settings.create(dto, { id: user.id, role: user.role });
  }

  @Patch(':key')
  @Roles('admin')
  @ApiBearerAuth()
  @RequireAuditReason('change a feature flag')
  @ApiOperation({ summary: 'Change a flag. Admin only. Requires a reason.' })
  update(
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(updateFlagSchema)) dto: UpdateFlagDto,
  ) {
    return this.settings.update(key, dto, { id: user.id, role: user.role });
  }

  /**
   * Remove a flag.
   *
   * Deleting is retiring the switch, not renaming it: clients must degrade
   * with the flag absent (that is the documented default), because a deleted
   * key that a client hard-required would turn a config change into an
   * outage for exactly the users the flag was meant to protect.
   */
  @Delete(':key')
  @Roles('admin')
  @ApiBearerAuth()
  @RequireAuditReason('remove a feature flag')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a flag. Admin only. Requires a reason.' })
  async remove(
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // No `@Body` here on purpose: the reason the guard requires travels in
    // the body, but this handler needs nothing from it — reading it would
    // invite a body the route does not use.
    await this.settings.remove(key, { id: user.id, role: user.role });
  }
}
