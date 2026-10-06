import { Inject, Injectable, Logger } from '@nestjs/common';
import { redactDeep } from '@correnthian/security';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { currentAuditContext } from './audit-context.js';
import { diffState, type DiffOptions, type StateChange } from './audit-diff.js';
import {
  isDestructive, isUsableReason, MIN_REASON_LENGTH,
} from './destructive-actions.js';
import type { ListAuditDto } from './dto/list-audit.dto.js';

export type AuditOutcome = 'success' | 'failure' | 'denied';

export interface AuditEntry {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  outcome?: AuditOutcome;
  reason?: string | null;
  /** State of the resource before the operation. Null on a create. */
  before?: unknown;
  /** State after. Null on a delete. */
  after?: unknown;
  ipAddress?: string | null;
  deviceId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * What `recordChange` takes.
 *
 * `before` and `after` are two versions of a *row*, not two hand-built
 * blobs — see `diffState`.
 */
export interface AuditChangeEntry extends Omit<AuditEntry, 'before' | 'after'> {
  before?: unknown;
  after?: unknown;
  fields?: DiffOptions['fields'];
  /**
   * Force destructive treatment. Use for an action whose final segment is
   * neutral but which still destroys something for the user — `session.purge`,
   * for instance.
   */
  destructive?: boolean;
}

/**
 * Reject a destructive operation that arrived without a usable reason.
 *
 * Free function rather than only a method so both `recordChange` and a
 * service that wants to validate *before* it mutates can call it without
 * first having an audit service in hand.
 *
 * Throws, unlike `record`. The difference is deliberate: a missing reason is
 * a caller mistake we refuse to hide, whereas a failing database is an outage
 * we refuse to propagate. Call it before the mutation, so the operation does
 * not half-happen.
 */
export function assertReason(action: string, reason: unknown): asserts reason is string {
  if (isUsableReason(reason)) return;
  throw AppError.badRequest(
    `"${action}" changes something a user depends on, so it needs a reason of at ` +
      `least ${MIN_REASON_LENGTH} characters. Write what happened, not what you did.`,
    { action, reason },
  );
}

/**
 * The columns the list and the detail both project.
 *
 * Explicit, because the row also carries `metadata`, `before` and `after`.
 * Returning the raw Prisma row would put a hundred redacted blobs in a table
 * the operator reads at a glance — which is how something ends up in the log
 * that nobody meant to put there. The payload is read one entry at a time,
 * through `findById`.
 *
 * `reason` is the exception: it is a short string, and an operator scanning
 * the trail for "why was this disabled" needs it in the list, not one click
 * away. That is the question the trail exists to answer.
 */
const ROW_SELECT = {
  id: true,
  actorId: true,
  actorRole: true,
  action: true,
  targetType: true,
  targetId: true,
  outcome: true,
  reason: true,
  ipAddress: true,
  deviceId: true,
  requestId: true,
  createdAt: true,
} as const;

const DETAIL_SELECT = { ...ROW_SELECT, before: true, after: true, metadata: true } as const;

type AuditRow = {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: string;
  reason: string | null;
  ipAddress: string | null;
  deviceId: string | null;
  requestId: string | null;
  createdAt: Date;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Write an audit record.
   *
   * Metadata, `before` and `after` are redacted on the way in, not on the way
   * out. An audit log is the one place a stray secret is most likely to
   * survive, because it is written deliberately rather than by accident — and
   * a state snapshot is a bigger surface than a hand-written log line, since
   * it copies whatever columns the caller's query happened to select.
   *
   * Never throws. Losing an audit line must not take down the operation being
   * audited, and refusing a user's withdrawal because logging failed is worse
   * than the missing line.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      const ctx = currentAuditContext();
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          actorRole: entry.actorRole ?? null,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          outcome: entry.outcome ?? 'success',
          reason: entry.reason ?? ctx?.reason ?? null,
          before: this.redactOrNull(entry.before),
          after: this.redactOrNull(entry.after),
          // Falls back to the request, so no caller has to remember it.
          ipAddress: entry.ipAddress ?? ctx?.ipAddress ?? null,
          deviceId: entry.deviceId ?? ctx?.deviceId ?? null,
          requestId: entry.requestId ?? ctx?.requestId ?? null,
          metadata: redactDeep(entry.metadata ?? {}) as object,
        },
      });
    } catch {
      // Deliberately swallowed — see the note above. The `recordChange` path
      // is where a *caller* mistake is caught; this is where infrastructure
      // failure is absorbed.
    }
  }

  /**
   * Record a state change, with the before and after derived rather than
   * hand-built.
   *
   * This is the method a destructive admin operation should call, and calling
   * it is what makes the reason mandatory: `assertReason` throws before any
   * write, so an operator who has not said why cannot complete the
   * operation. Call it *before* mutating — which is also the only moment at
   * which the before-state still exists.
   */
  async recordChange(entry: AuditChangeEntry): Promise<StateChange> {
    const reason = entry.reason ?? currentAuditContext()?.reason ?? null;

    if (entry.destructive ?? isDestructive(entry.action)) {
      assertReason(entry.action, reason);
    }

    const change = diffState(entry.before, entry.after, { fields: entry.fields });

    // An entry that says "something changed" and shows nothing is noise. It is
    // almost always a caller updating a timestamp only; saying so out loud is
    // more useful than writing it.
    if (change.changed.length === 0) {
      this.logger.debug(`No state change for ${entry.action}; audit entry skipped`);
      return change;
    }

    await this.record({ ...entry, reason, before: change.before, after: change.after });
    return change;
  }

  /** See the module-level `assertReason`. */
  assertReason(action: string, reason: unknown): asserts reason is string {
    assertReason(action, reason);
  }

  async list(query: ListAuditDto) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(query.action ? { action: query.action } : {}),
        ...(query.outcome ? { outcome: query.outcome } : {}),
        // Everything one HTTP request did, in order. The reason the requestId
        // is worth storing at all.
        ...(query.requestId ? { requestId: query.requestId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(query.limit, 200),
      select: ROW_SELECT,
    });

    const actors = await this.actorEmails(rows);
    return rows.map((row) => this.presentRow(row, actors));
  }

  /** One entry, with the payloads the list withholds. */
  async findById(id: string) {
    const row = await this.prisma.auditLog.findUnique({ where: { id }, select: DETAIL_SELECT });
    if (!row) throw AppError.notFound('Audit entry not found');

    const actors = await this.actorEmails([row]);
    return {
      ...this.presentRow(row, actors),
      before: row.before ?? null,
      after: row.after ?? null,
      metadata: row.metadata ?? {},
    };
  }

  /** Everything one actor did, for an investigation. */
  async forActor(actorId: string, limit = 100) {
    const rows = await this.prisma.auditLog.findMany({
      where: { actorId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      select: ROW_SELECT,
    });
    const actors = await this.actorEmails(rows);
    return rows.map((row) => this.presentRow(row, actors));
  }

  /**
   * Resolve actor ids to addresses.
   *
   * `AuditLog.actorId` is a plain string, not a relation, so this is a second
   * query rather than a join. It is batched: one lookup per page, not one per
   * row. The email matters — an operator looking at a denied action cannot act
   * on a cuid.
   */
  private async actorEmails(rows: Array<{ actorId: string | null }>): Promise<Map<string, string>> {
    const ids = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return new Map();

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true },
    });
    return new Map(users.map((u) => [u.id, u.email]));
  }

  private redactOrNull(value: unknown): object | undefined {
    if (value === null || value === undefined) return undefined;
    return redactDeep(value) as object;
  }

  private presentRow(row: AuditRow, actors: Map<string, string>) {
    return {
      id: row.id,
      actorId: row.actorId,
      actorEmail: row.actorId ? (actors.get(row.actorId) ?? null) : null,
      actorRole: row.actorRole,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      outcome: row.outcome,
      reason: row.reason,
      ipAddress: row.ipAddress,
      deviceId: row.deviceId,
      requestId: row.requestId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}