import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListUsersDto } from './dto/list-users.dto.js';

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Keyset pagination on a stable sort. `skip` degrades badly once a table
   * is large and can repeat rows under concurrent writes.
   */
  async list(query: ListUsersDto) {
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.kycStatus ? { kycStatus: query.kycStatus } : {}),
      ...(query.country ? { country: query.country } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { displayName: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.user.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        country: true,
        region: true,
        kycStatus: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { wallets: true, devices: true } },
      },
    });

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        displayName: true,
        country: true,
        region: true,
        kycStatus: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        wallets: {
          select: {
            id: true, address: true, chainId: true, kind: true,
            label: true, deployed: true, isPrimary: true, createdAt: true,
          },
        },
        // Matches the list projection so a detail view and the table agree;
        // an operator switching between them should not see a field vanish.
        _count: { select: { wallets: true, devices: true, sessions: true } },
        devices: {
          where: { revokedAt: null },
          select: { id: true, platform: true, label: true, trustedAt: true, lastSeenAt: true },
        },
        kyc: true,
      },
    });
    if (!user) throw AppError.notFound('User not found');
    return user;
  }

  async setRole(id: string, role: 'user' | 'support' | 'compliance' | 'admin' | 'owner') {
    await this.prisma.user.update({ where: { id }, data: { role } });
    return this.findById(id);
  }

  async setStatus(id: string, status: 'active' | 'suspended' | 'closed') {
    await this.prisma.user.update({ where: { id }, data: { status } });
    return this.findById(id);
  }

  /**
   * Counters for the admin dashboard. Aggregated in the database rather than
   * by loading rows, so the cost does not grow with table size.
   */
  async stats() {
    const [total, byKyc, byRole, newLast7d] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({ by: ['kycStatus'], _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } },
      }),
    ]);

    return {
      total,
      newLast7d,
      byKyc: Object.fromEntries(byKyc.map((r) => [r.kycStatus, r._count._all])),
      byRole: Object.fromEntries(byRole.map((r) => [r.role, r._count._all])),
    };
  }
}
