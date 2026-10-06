import { Inject, Injectable } from '@nestjs/common';
import { redactDeep } from '@correnthian/security';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListAuditDto } from './dto/list-audit.dto.js';

export type AuditOutcome = 'success' | 'failure' | 'denied';

export interface AuditEntry {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  outcome?: AuditOutcome;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

/**
 * The columns the list and the detail both project.
 *
 * Explicit, because the row also carries `metadata`. Returning the raw Prisma
 * row would put a hundred redacted blobs in a table the operator reads at a
 * glance — which is how something ends up in the log that nobody meant to put
 * there. Metadata is read one entry at a time, through `findById`.
 */
const ROW_SELECT = {
  id: true,
  actorId: true,
  actorRole: true,
  action: true,
  targetType: true,
  targetId: true,
  outcome: true,
  ipAddress: true,
  createdAt: true,
} as const;

type AuditRow = {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: string;
  ipAddress: string | null;
  createdAt: Date;
};

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Write an audit record.
   *
   * Metadata is redacted on the way in, not on the way out. An audit log is
   * the one place a stray secret is most likely to survive, because it is
   * written deliberately rather than by accident.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          actorRole: entry.actorRole ?? null,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          outcome: entry.outcome ?? 'success',
          ipAddress: entry.ipAddress ?? null,
          metadata: redactDeep(entry.metadata ?? {}) as object,
        },
      });
    } catch {
      // An audit failure must never take down the operation being audited.
      // Swallowed deliberately: losing an audit line is bad, refusing a
      // user's withdrawal because logging failed is worse.
    }
  }

  async list(query: ListAuditDto) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(query.action ? { action: query.action } : {}),
        ...(query.outcome ? { outcome: query.outcome } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(query.limit, 200),
      select: ROW_SELECT,
    });

    const actors = await this.actorEmails(rows);
    return rows.map((row) => this.presentRow(row, actors));
  }

  /** One entry, with the metadata the list withholds. */
  async findById(id: string) {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
      select: { ...ROW_SELECT, metadata: true },
    });
    if (!row) throw AppError.notFound('Audit entry not found');

    const actors = await this.actorEmails([row]);
    return { ...this.presentRow(row, actors), metadata: row.metadata ?? {} };
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
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    };
  }
}