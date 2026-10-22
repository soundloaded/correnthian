import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  DeliveryUnavailableError,
  EMAIL_TRANSPORT,
  renderNotification,
  type EmailTransport,
} from './email-transport.js';

/**
 * The claim-and-dispatch discipline, in one place — Wave 1 of the unblock.
 *
 * A notification row is an intent; the `DeliveryLog` is the record of what
 * the transport did with it. Claiming and dispatch are separate steps on
 * purpose: a claim is a lease on the intent, and a dispatch is what makes
 * the lease mean something.
 *
 * ## The lease
 *
 * `claimedBy` names the holder; `claimedUntil` is when the hold lapses. A
 * worker that dies mid-batch leaves the rows claimed, and the next worker
 * treats a lapsed lease as unclaimed — it does not wait for anyone to clean
 * up, because a row that waits on a dead worker is a message that is never
 * sent, which is the silent failure the lease exists to prevent.
 *
 * Every read the job makes repeats the predicate on the write. A row sent,
 * failed, or re-claimed between the read and the write matches zero, and
 * the loser sends nothing. Two workers racing for the same row cannot both
 * send it.
 *
 * ## The outcomes
 *
 * - **Sent.** The transport accepted the message. The row is marked sent;
 *   the attempt isLogged with the provider's message id where there is one.
 * - **Hard failure.** The message is malformed, the template is unknown, or
 *   the address cannot receive. The row is marked failed and stays failed:
 *   retrying a message that cannot be delivered is how a queue becomes a
 *   load test against its own provider.
 * - **Transient failure.** The provider could not be reached. The row goes
 *   back to unclaimed with a fresh lease floor — it is retried on the next
 *   run, up to `MAX_ATTEMPTS`, after which it is failed rather than held
 *   forever.
 *
 * ## What the console sink proves
 *
 * Nothing about delivery, and it says so. A run through the sink logs the
 * rendered message and marks it sent, because the sink *is* the transport in
 * development: there is nowhere else for the message to go, and a dispatch
 * job that refused to run without SMTP would make the whole notification
 * surface untestable where no provider exists. The message id is null, the
 * run detail names the transport, and anyone reading the log can see the
 * message was rendered, not delivered.
 */

const MAX_ATTEMPTS = 5;
const LEASE_MS = 5 * 60_000;
const BATCH = 50;

type ClaimedRow = {
  id: string;
  userId: string;
  channel: string;
  template: string;
  payload: Prisma.JsonValue;
};

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
  ) {}

  /**
   * Claim up to `limit` pending rows for this worker.
   *
   * The select finds rows that are unsent, unfailed, and either never
   * claimed or whose lease has lapsed. The update claims the same rows by
   * id, *repeating* the unclaimed-or-lapsed predicate — so a row claimed,
   * sent, or failed between the two statements matches zero for us. The
   * return is what `updateMany` actually claimed, re-read for dispatch.
   */
  async claim(limit: number, holder: string, now: Date): Promise<ClaimedRow[]> {
    const candidates = await this.prisma.notification.findMany({
      where: {
        sentAt: null,
        failedAt: null,
        OR: [{ claimedUntil: null }, { claimedUntil: { lt: now } }],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: Math.min(Math.max(limit, 1), BATCH),
      select: { id: true },
    });
    if (candidates.length === 0) return [];

    const leaseUntil = new Date(now.getTime() + LEASE_MS);
    const claimed = await this.prisma.notification.updateMany({
      where: {
        id: { in: candidates.map((c) => c.id) },
        sentAt: null,
        failedAt: null,
        // The guard repeated on the write. The `claimedBy: null` half says a
        // row this process has never seen may be taken once; the lease half
        // says a row a dead worker holds may be taken again. Both must fail
        // together for the row to be untouchable, which is exactly the live
        // lease the other worker is still working under.
        OR: [
          { claimedBy: null, claimedUntil: null },
          { claimedUntil: { lt: now } },
        ],
      },
      data: { claimedBy: holder, claimedUntil: leaseUntil },
    });

    if (claimed.count === 0) return [];
    return this.prisma.notification.findMany({
      where: { id: { in: candidates.map((c) => c.id) }, claimedBy: holder },
      select: { id: true, userId: true, channel: true, template: true, payload: true },
    });
  }

  /**
   * Dispatch one claimed row: render, send, and record what happened.
   *
   * Returns the outcome so the job can count it. Every path writes a
   * `DeliveryLog` row first and moves the `Notification` row second, so the
   * log is the audit of the attempt and the notification row is the state.
   */
  async dispatch(row: ClaimedRow, now: Date): Promise<'sent' | 'failed' | 'retrying'> {
    if (row.channel !== 'email') {
      // Today there is only the email port. A row in a channel with no
      // transport is a configuration mistake, and failing it loudly is
      // better than retrying it forever against a transport that does not
      // exist.
      await this.fail(row, `No transport for channel "${row.channel}"`, 1, now);
      return 'failed';
    }

    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { email: true, displayName: true },
    });
    if (!user) {
      await this.fail(row, 'The account the notification was queued for no longer exists.', 1, now);
      return 'failed';
    }

    let rendered;
    try {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      rendered = renderNotification(row.template, {
        name: typeof user.displayName === 'string' ? user.displayName : undefined,
        link: typeof payload['link'] === 'string' ? payload['link'] : undefined,
      });
    } catch (err) {
      await this.fail(
        row,
        err instanceof Error ? err.message : 'The template could not be rendered.',
        1,
        now,
      );
      return 'failed';
    }

    const attempt = (await this.prisma.deliveryLog.count({ where: { notificationId: row.id } })) + 1;

    try {
      const sent = await this.transport.send({ to: user.email, ...rendered });
      await this.prisma.deliveryLog.create({
        data: {
          notificationId: row.id,
          channel: row.channel,
          template: row.template,
          userId: row.userId,
          attempt,
          status: 'sent',
          providerMsgId: sent.providerMsgId,
        },
      });
      await this.prisma.notification.update({
        where: { id: row.id },
        data: { sentAt: now, claimedBy: null, claimedUntil: null },
      });
      return 'sent';
    } catch (err) {
      if (err instanceof DeliveryUnavailableError) {
        if (attempt >= MAX_ATTEMPTS) {
          await this.fail(row, `The provider was unreachable ${attempt} times; giving up.`, attempt, now);
          return 'failed';
        }
        // Back to the queue: clear the claim so the next run picks it up.
        // `claimedUntil` in the past reads as unclaimed to `claim`.
        await this.prisma.deliveryLog.create({
          data: {
            notificationId: row.id,
            channel: row.channel,
            template: row.template,
            userId: row.userId,
            attempt,
            status: 'retrying',
            error: 'The provider could not be reached.',
          },
        });
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { claimedBy: null, claimedUntil: new Date(now.getTime() - 1) },
        });
        return 'retrying';
      }
      await this.fail(row, err instanceof Error ? err.message : 'The send failed.', attempt, now);
      return 'failed';
    }
  }

  private async fail(row: ClaimedRow, error: string, attempt: number, now: Date): Promise<void> {
    await this.prisma.deliveryLog.create({
      data: {
        notificationId: row.id,
        channel: row.channel,
        template: row.template,
        userId: row.userId,
        attempt,
        status: 'failed',
        error: error.slice(0, 500),
      },
    });
    await this.prisma.notification.update({
      where: { id: row.id },
      data: { failedAt: now, error: error.slice(0, 500), claimedBy: null, claimedUntil: null },
    });
    this.logger.warn(`Notification ${row.id} failed: ${error.slice(0, 200)}`);
  }
}
