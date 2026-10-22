import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuthController } from './auth.controller.js';
import { AuthLinksService } from './auth-links.service.js';
import { AuthService } from './auth.service.js';

@Module({
  // Links enqueue notifications; the transport sends them.
  imports: [NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, AuthLinksService],
  exports: [AuthService, AuthLinksService],
})
export class AuthModule {}
