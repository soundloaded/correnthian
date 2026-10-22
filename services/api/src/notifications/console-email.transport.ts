import { Injectable, Logger } from '@nestjs/common';
import {
  EmailTransport,
  type OutgoingEmail,
  type SentEmail,
} from './email-transport.js';

/**
 * The development transport: email goes to the operator's console.
 *
 * This is the correct answer while there is no delivery provider. It sends
 * nothing and says so: the log line carries the recipient, the subject, and
 * the first lines of the body, so a developer exercising the magic-link
 * flow can read the link without an inbox.
 *
 * A console sink is not a mock delivery provider. A fake that reported
 * success would bless every path that depends on delivery being real,
 * including the dispatch job's `markSent`. This one is explicit about what
 * it does: it logs.
 *
 * Production never wires this in — see the module factory, which refuses to
 * boot the sink outside development and test. Sending nothing is the right
 * development behaviour and an outage in production: real users would wait
 * for links that never come, and every one of those links would read as
 * delivered in the run detail.
 */
@Injectable()
export class ConsoleEmailTransport extends EmailTransport {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleEmailTransport.name);

  async send(message: OutgoingEmail): Promise<SentEmail> {
    this.logger.log(
      `email to=${message.to} subject=${JSON.stringify(message.subject)} ` +
        `body=${JSON.stringify(message.text.slice(0, 400))}`,
    );
    return { providerMsgId: null };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
