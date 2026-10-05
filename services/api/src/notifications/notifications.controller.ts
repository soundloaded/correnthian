import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/guards/roles.guard.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { NotificationsService } from './notifications.service.js';

const enqueueSchema = z.object({
  channel: z.enum(['email', 'push', 'in_app']),
  template: z.string().min(1).max(80),
  payload: z.record(z.string(), z.unknown()).default({}),
});

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Notifications for the current account' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.listForUser(user.id);
  }

  @Post()
  @Roles('support')
  @ApiOperation({ summary: 'Queue a notification' })
  enqueue(@CurrentUser() user: AuthenticatedUser, @Body(zodPipe(enqueueSchema)) dto: z.infer<typeof enqueueSchema>) {
    return this.notifications.enqueue({ userId: user.id, ...dto });
  }

  @Get('stats')
  @Roles('support')
  @ApiOperation({ summary: 'Delivery counters' })
  stats() {
    return this.notifications.stats();
  }
}
