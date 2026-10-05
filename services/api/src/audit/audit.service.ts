import { Inject, Injectable } from '@nestjs/common';
import { redactDeep } from '@correnthian/security';
import { PrismaService } from '../prisma/prisma.service.js';

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

  list(limit = 50, action?: string) {
    return this.prisma.auditLog.findMany({
      where: action ? { action } : {},
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /** Everything one actor did, for an investigation. */
  forActor(actorId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { actorId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }
}
