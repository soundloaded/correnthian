import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type Channel = 'email' | 'push' | 'in_app';

export interface NotificationInput {
  userId: string;
  channel: Channel;
  template: string;
  payload?: Record<string, unknown>;
}

/**
 * Notification delivery is recorded, not yet sent.
 *
 * No delivery provider is chosen, and inventing a fake one here would be worse
 * than leaving it unimplemented: a row that claims to have been emailed is a
 * lie a user could act on. Rows are written first and flushed by a transport
 * worker once a provider exists.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async enqueue(input: NotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        channel: input.channel,
        template: input.template,
        payload: (input.payload ?? {}) as object,
      },
    });
  }

  async listForUser(userId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * Enumerate pending rows. **This does not claim anything**, despite the name.
   *
   * The docstring used to describe "`updateMany` with a status guard… the loser
   * matches zero rows". No such guard exists, and none can without a schema
   * change: `Notification` has only `sentAt`, `failedAt` and `error`, so there
   * is no column to write a claim into. Two workers calling this today receive
   * the same rows.
   *
   * That is recorded rather than quietly patched, because the obvious fix is
   * worse than the bug. A naive `claimedAt` column is a lease with no expiry:
   * a worker that dies mid-batch leaves those rows claimed forever, and
   * notifications that are never sent are a harder failure than notifications
   * sent twice — the second is visible, the first is silent. A real claim needs
   * a lease with a timeout, a way to requeue an abandoned one, and a decision
   * about idempotent delivery. Those are design questions, and they belong to
   * the transport decision in ADR-020 rather than to a method nothing calls:
   * no scheduler job invokes this, and no transport is wired.
   *
   * Tracked as `DEF-009`; the consequence is recorded in ADR-020.
   */
  async claimBatch(limit = 50) {
    const candidates = await this.prisma.notification.findMany({
      where: { sentAt: null, failedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return candidates;
  }

  async markSent(id: string) {
    await this.prisma.notification.update({ where: { id }, data: { sentAt: new Date() } });
  }

  async markFailed(id: string, error: string) {
    await this.prisma.notification.update({
      where: { id },
      data: { failedAt: new Date(), error: error.slice(0, 500) },
    });
  }

  async stats() {
    const [total, pending, sent, failed] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { sentAt: null, failedAt: null } }),
      this.prisma.notification.count({ where: { sentAt: { not: null } } }),
      this.prisma.notification.count({ where: { failedAt: { not: null } } }),
    ]);
    return { total, pending, sent, failed };
  }
}
