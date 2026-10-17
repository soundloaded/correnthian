import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { CreateFlagDto, UpdateFlagDto } from './dto/feature-flag.dto.js';

/** The operator behind a change. From the session, never from the body. */
export interface FlagActor {
  id: string;
  role: string;
}

/** Columns the table projects. Explicit, like every other service — the audit snapshot rides on it. */
const FLAG_SELECT = {
  key: true,
  enabled: true,
  rollout: true,
  description: true,
  updatedAt: true,
} as const;

type FlagRow = {
  key: string;
  enabled: boolean;
  rollout: number;
  description: string | null;
  updatedAt: Date;
};

/**
 * The system-configuration surface — BE-1505.
 *
 * Four routes, two tiers: any operator reads (the console needs the table to
 * render any settings page against it), only `admin` writes. No `support`
 * write: a flag flips behaviour for every account, so it is not a helpdesk
 * action. Writes are audited with before/after because "who turned it on" is
 * the question every incident review asks first.
 */
@Injectable()
export class SettingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
      select: FLAG_SELECT,
    });
  }

  async create(dto: CreateFlagDto, actor: FlagActor) {
    // P2002 is excluded from the audit: nothing changed, so there is no
    // state to diff — same convention as every other create route.
    const flag = await this.prisma.featureFlag
      .create({
        data: {
          key: dto.key,
          enabled: dto.enabled,
          rollout: dto.rollout,
          description: dto.description ?? null,
        } as Prisma.FeatureFlagUncheckedCreateInput,
        select: FLAG_SELECT,
      })
      .catch((err: unknown) => {
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
          throw AppError.conflict(`A flag named "${dto.key}" already exists`);
        }
        throw err;
      });

    await this.audit.recordChange({
      action: 'flag.created',
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'FeatureFlag',
      targetId: flag.key,
      // A create is destructive in the §55 sense: from this moment every
      // request sees it. So it owes a reason.
      destructive: true,
      after: flag,
    });

    return flag;
  }

  async update(key: string, dto: UpdateFlagDto, actor: FlagActor) {
    const before = await this.prisma.featureFlag.findUnique({ where: { key }, select: FLAG_SELECT });
    if (!before) throw AppError.notFound('Flag not found');

    // `null` on description clears; omission leaves alone. `enabled` and
    // `rollout` have no null state — a relaxation would accept `null` where
    // the row demands a boolean and fail at the database instead of the edge.
    const data: Prisma.FeatureFlagUncheckedUpdateInput = {};
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.rollout !== undefined) data.rollout = dto.rollout;
    if (dto.description !== undefined) data.description = dto.description;

    const after = await this.prisma.featureFlag.update({ where: { key }, data, select: FLAG_SELECT });

    await this.audit.recordChange({
      action: 'flag.changed',
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'FeatureFlag',
      targetId: key,
      // A rate-style flip is not ordinary work: it changes what every
      // account sees, so it opts in by name rather than by verb.
      destructive: true,
      before,
      after,
      fields: ['enabled', 'rollout', 'description'],
    });

    return after;
  }

  async remove(key: string, actor: FlagActor) {
    const before = await this.prisma.featureFlag.findUnique({ where: { key }, select: FLAG_SELECT });
    if (!before) throw AppError.notFound('Flag not found');

    // A row deleted between the pre-read and here throws P2025; that is the
    // same stranger-semantics as jurisdiction — a second racing delete reads
    // as missing, not as a crash. The filter maps P2025 to 404.
    const deleted: FlagRow = await this.prisma.featureFlag.delete({ where: { key }, select: FLAG_SELECT });

    await this.audit.recordChange({
      action: 'flag.removed',
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'FeatureFlag',
      targetId: key,
      destructive: true,
      before,
      after: deleted,
    });
  }
}
