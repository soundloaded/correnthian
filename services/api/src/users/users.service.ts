import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { decodeCursor, encodeCursor, KEYSET_ORDER, keysetAfter } from '../common/keyset.js';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListUsersDto } from './dto/list-users.dto.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  /**
   * Keyset pagination over `(createdAt desc, id desc)`.
   *
   * The comment used to claim this while the code paginated with
   * `cursor: { id }` and `skip: 1` — carrying only half the sort key, so two
   * users created in the same instant could land on the same page twice or
   * fall between pages. Reading the comment was enough to record it as fixed,
   * which is how it survived two re-verifications (DEF-015).
   *
   * The cursor and the filter now come from `common/keyset`, the same
   * implementation `SwapsService` and `TransactionsService` already use.
   */
  /**
   * Keyset pagination over the requested order, defaulting to
   * `(createdAt desc, id desc)` (see the note above).
   *
   * Sort is closed to `createdAt` and `email`: an arbitrary column would
   * reach Prisma's `orderBy` unvalidated, and each order needs its cursor
   * to carry the row's value for that column — the cursor is `{ t, i }`
   * and `t` is whichever timestamp or string the order sorts on. Email
   * ties break on `id` like everything else; `id` uniqueness makes the
   * order total, which is what keeps a page boundary from moving under
   * concurrent writes (DEF-015's lesson, applied to the new order too).
   */
  async list(query: ListUsersDto) {
    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const field = query.sort === 'email' ? 'email' : 'createdAt';
    const dir = query.order === 'asc' ? 'asc' : 'desc';

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
      where: { ...where, ...keysetAfter(after, field, dir) },
      take: query.limit + 1,
      orderBy: [{ [field]: dir }, { id: dir }],
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
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({ id: last.id, at: last[field] })
          : null,
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
    if (status !== 'active') {
      // A suspended account must lose its sessions in the same request that
      // suspends it: resolveSession does not consult status on every call by
      // itself, so without this a blocked account keeps working until TTL.
      await this.auth.revokeAllForUser(id);
    }
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
