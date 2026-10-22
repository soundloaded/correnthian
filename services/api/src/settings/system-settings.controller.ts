import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { RequireAuditReason } from '../audit/audit-reason.guard.js';
import { SystemSettingsService } from './system-settings.service.js';
import { setSettingSchema, type SetSettingDto } from './dto/system-setting.dto.js';

/**
 * The system-settings surface — BE-1507.
 *
 * Two tiers, the same split the flags use: any operator reads (the console
 * renders every settings page against this list), only `admin` writes. A
 * setting changes what every account sees — a sanctions window, a quote's
 * life, whether the platform is in maintenance — so it is not a support
 * action, and every write carries a reason the audit trail keeps.
 *
 *   GET    /settings/system        support (class-level)
 *   PATCH  /settings/system/:key   admin, with a reason
 *   DELETE /settings/system/:key   admin, with a reason
 */
@ApiTags('settings')
@Controller('settings/system')
@Roles('support')
export class SystemSettingsController {
  constructor(
    @Inject(SystemSettingsService) private readonly settings: SystemSettingsService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Every declared setting, with the value in force and where it came from',
    description:
      'The list is the registry, not the table: a setting that has never been ' +
      'overridden is present with its declared default. A value that no longer ' +
      'validates is served as the default and logged.',
  })
  list() {
    return this.settings.list();
  }

  @Patch(':key')
  @Roles('admin')
  @ApiBearerAuth()
  @RequireAuditReason('change a system setting')
  @ApiOperation({
    summary: 'Override one setting. Admin only. Requires a reason.',
    description:
      'The value is validated against the key\'s declared schema, so a setting ' +
      'cannot be set to a value no code understands.',
  })
  update(
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(setSettingSchema)) dto: SetSettingDto,
  ) {
    return this.settings.set(key, dto.value, { id: user.id, role: user.role });
  }

  /**
   * Drop an override, putting the declared default back in force.
   *
   * The audit line records both halves: the override that was removed and the
   * default that is now in force. A trail that only showed the value would
   * read as though someone had set it deliberately.
   */
  @Delete(':key')
  @Roles('admin')
  @ApiBearerAuth()
  @RequireAuditReason('reset a system setting')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an override. Admin only. Requires a reason.' })
  async remove(
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // No `@Body` here on purpose: the reason the guard requires travels in the
    // body, but this handler needs nothing from it — reading it would invite a
    // body the route does not use.
    await this.settings.clear(key, { id: user.id, role: user.role });
  }
}
