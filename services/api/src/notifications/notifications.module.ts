import { Module } from '@nestjs/common';
import { ConfigService } from '../config/config.service.js';
import { ConsoleEmailTransport } from './console-email.transport.js';
import { DeliveryService } from './delivery.service.js';
import { EMAIL_TRANSPORT } from './email-transport.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { SmtpEmailTransport } from './smtp-email.transport.js';

/**
 * The transport is a port, not a provider.
 *
 * `EMAIL_TRANSPORT` resolves to the console sink in development and test,
 * and to SMTP in production — where the sink is refused, because sending
 * nothing in production is an outage that reads as delivered. A deployment
 * that wants real mail anywhere else says so with
 * `NOTIFICATIONS_PROVIDER=smtp` and the `MAIL_*` variables.
 *
 * The sink in test is not a claim that delivery works: it renders the
 * message and reports no provider id, and the delivery suite asserts the
 * *state machine* — claimed once, sent once, retried, failed — rather than
 * pretending a message reached anybody. Whether a provider answers is the
 * provider's own test, not this one's.
 *
 * Adding a vendor (Resend, SES) means a new `EmailTransport` implementation
 * and one entry here. Nothing that enqueues, claims, or dispatches changes.
 */
function emailTransport(config: ConfigService) {
  if (config.notifications.provider === 'smtp' || config.isProduction) {
    return SmtpEmailTransport.create(config);
  }
  return new ConsoleEmailTransport();
}

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    DeliveryService,
    ConsoleEmailTransport,
    SmtpEmailTransport,
    { provide: EMAIL_TRANSPORT, useFactory: emailTransport, inject: [ConfigService] },
  ],
  exports: [NotificationsService, DeliveryService, EMAIL_TRANSPORT],
})
export class NotificationsModule {}
