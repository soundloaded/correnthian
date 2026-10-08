import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { decodeCursor, encodeCursor, keysetAfter } from '../common/keyset.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegisterDeviceDto } from './dto/register-device.dto.js';
import type { ListAllDevicesDto } from './dto/list-all-devices.dto.js';

@Injectable()
export class DevicesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.device.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, platform: true, label: true, trustedAt: true, lastSeenAt: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async register(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.device.create({
      data: {
        userId,
        platform: dto.platform,
        label: dto.label,
        publicKey: dto.publicKey,
        pushToken: dto.pushToken,
      },
      select: { id: true, platform: true, label: true, trustedAt: true, lastSeenAt: true },
    });
  }

  async touch(deviceId: string, userId: string) {
    const { count } = await this.prisma.device.updateMany({
      where: { id: deviceId, userId, revokedAt: null },
      data: { lastSeenAt: new Date() },
    });
    if (count === 0) throw AppError.notFound('Device not found');
  }

  /**
   * Revoking is soft: an audit trail must survive the device being removed.
   */
  async revoke(deviceId: string, userId: string) {
    const { count } = await this.prisma.device.updateMany({
      where: { id: deviceId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw AppError.notFound('Device not found');
  }
  /**
   * Cross-account device list for the admin console.
   *
   * The self-scoped `list()` above is what a signed-in user sees of their own
   * devices; this is the operator view. A device here proves nothing about
   * custody — the row records a public key and platform, never key material —
   * so it carries no more sensitivity than the account row beside it.
   */
  async listAll(query: ListAllDevicesDto) {
    const after = query.cursor ? decodeCursor(query.cursor) : null;

    const rows = await this.prisma.device.findMany({
      where: {
        ...(query.platform ? { platform: query.platform } : {}),
        ...(query.includeRevoked ? {} : { revokedAt: null }),
        ...(query.search
          ? { user: { email: { contains: query.search, mode: 'insensitive' as const } } }
          : {}),
        ...keysetAfter(after, 'lastSeenAt'),
      },
      take: query.limit + 1,
      // The full key, not just the timestamp: two devices seen in the same
      // instant tie, and a tie broken by nothing is a page boundary that moves
      // (DEF-015). `KEYSET_ORDER` is the `createdAt` variant, so this list
      // spells out its own sort rather than borrowing a column it does not use.
      orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        platform: true,
        label: true,
        trustedAt: true,
        lastSeenAt: true,
        revokedAt: true,
        user: { select: { id: true, email: true, role: true, kycStatus: true } },
      },
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor({ id: last.id, at: last.lastSeenAt }) : null,
    };
  }
  /** Counters for the admin dashboard. */
  async stats() {
    const [total, byPlatform, revoked, staleSeen] = await Promise.all([
      this.prisma.device.count({ where: { revokedAt: null } }),
      this.prisma.device.groupBy({
        by: ['platform'],
        where: { revokedAt: null },
        _count: { _all: true },
      }),
      this.prisma.device.count({ where: { revokedAt: { not: null } } }),
      this.prisma.device.count({
        where: { revokedAt: null, lastSeenAt: { lt: new Date(Date.now() - 90 * 864e5) } },
      }),
    ]);
    return {
      total,
      revoked,
      /** Active but not seen in 90 days — worth surfacing as possible cleanup. */
      stale: staleSeen,
      byPlatform: Object.fromEntries(byPlatform.map((r) => [r.platform, r._count._all])),
    };
  }
}
