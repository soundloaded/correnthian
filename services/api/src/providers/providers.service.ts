import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProvidersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(category?: string) {
    return this.prisma.provider.findMany({
      where: category ? { category: category as never } : {},
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true, slug: true, name: true, category: true, status: true,
        capabilities: true, lastCheckedAt: true, notes: true,
        _count: { select: { quotes: true, redemptions: true } },
      },
    });
  }

  async findBySlug(slug: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { slug },
      include: {
        _count: { select: { quotes: true, redemptions: true } },
      },
    });
    if (!provider) throw AppError.notFound('Provider not found');
    return provider;
  }

  /**
   * Only `lastHealth` — a health probe payload — is stored. Provider API
   * credentials live in the infrastructure secret store and are never written
   * here. This table must never become a place secrets land.
   *
   * Status is a manual operator override. The scheduled probe writes `status`,
   * `lastCheckedAt` and `lastHealth` through `ProviderHealthService`, which is
   * the single authority for the last two — there is deliberately no second
   * method here that can write them, because two writers of one field is how a
   * registry ends up claiming health nothing checked.
   */
  async setStatus(slug: string, status: 'active' | 'degraded' | 'disabled') {
    await this.prisma.provider.update({
      where: { slug },
      data: { status, lastCheckedAt: new Date() },
    });
    return this.findBySlug(slug);
  }


  /** Provider health drives whether a rail is offered at all. */
  async healthSummary() {
    const providers = await this.prisma.provider.findMany({
      select: { slug: true, name: true, category: true, status: true, lastCheckedAt: true },
      orderBy: { category: 'asc' },
    });
    const counts = providers.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {});
    return { counts, providers };
  }
}
