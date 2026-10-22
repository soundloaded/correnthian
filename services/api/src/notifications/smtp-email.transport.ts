import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ConfigService } from '../config/config.service.js';
import {
  DeliveryUnavailableError,
  EmailTransport,
  type OutgoingEmail,
  type SentEmail,
} from './email-transport.js';

/**
 * The production transport: SMTP.
 *
 * Chosen over a vendor SDK on purpose. SMTP is the one email interface that
 * survives a provider change — Resend, SES, Postmark and a relay all speak
 * it — and a transport module that depends on one vendor's SDK is an
 * adapter written against an imagined API waiting to be rewritten.
 *
 * Credentials live in the environment, never in code, and the module
 * refuses to enable the transport without a host. That failure is at boot,
 * not at send time: a transport that boots unconfigured sends its first
 * message into `DeliveryUnavailableError` at 3am, and discovering the
 * misconfiguration then is discovering it from a user's complaint.
 */
@Injectable()
export class SmtpEmailTransport extends EmailTransport {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpEmailTransport.name);
  private readonly sender: string;
  private readonly mailer: Transporter;

  constructor(sender: string, mailer: Transporter) {
    super();
    this.sender = sender;
    this.mailer = mailer;
  }

  /**
   * Build from configuration, or throw before the process serves traffic.
   *
   * `MAIL_FROM` is required wherever this transport is built: a sender
   * address is the one part of a message that cannot be defaulted without
   * making every message it sends a forgery risk. The caller passes the
   * *resolved* config — this transport never reads `process.env` itself,
   * because the environment is what the config package exists to own.
   */
  static create(@Inject(ConfigService) config: ConfigService): SmtpEmailTransport {
    const mail = config.value.notifications;
    if (!mail.configured || mail.host === undefined || mail.from === undefined) {
      throw new Error(
        'SmtpEmailTransport needs MAIL_HOST (and MAIL_FROM). ' +
          'Set NOTIFICATIONS_PROVIDER=smtp and the MAIL_* variables, or stay on the console sink.',
      );
    }
    const mailer = createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      auth: mail.user !== undefined ? { user: mail.user, pass: mail.pass ?? '' } : undefined,
    });
    return new SmtpEmailTransport(mail.from, mailer);
  }

  async send(message: OutgoingEmail): Promise<SentEmail> {
    try {
      const info = await this.mailer.sendMail({
        from: this.sender,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return { providerMsgId: typeof info.messageId === 'string' ? info.messageId : null };
    } catch (err) {
      // The provider's answer is a credential-shaped error often enough
      // that it must not reach a log, a run detail or a response.
      this.logger.error('SMTP send failed');
      throw new DeliveryUnavailableError('The email provider refused the message.');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.mailer.verify();
      return true;
    } catch {
      return false;
    }
  }
}
