import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ChainsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(enabledOnly = false) {
    return this.prisma.chain.findMany({
      where: enabledOnly ? { enabled: true } : {},
      orderBy: [{ family: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, family: true, nativeSymbol: true, decimals: true,
        explorerUrl: true, enabled: true, isTestnet: true,
        rpcCount: { select: false },
        _count: { select: { assets: true, wallets: true } },
      },
    });
  }

  async findById(id: string) {
    const chain = await this.prisma.chain.findUnique({
      where: { id },
      select: {
        id: true, name: true, family: true, nativeSymbol: true, decimals: true,
        explorerUrl: true, enabled: true, isTestnet: true,
        _count: { select: { assets: true, wallets: true, transactions: true } },
      },
    });
    if (!chain) throw AppError.notFound('Chain not found');
    return chain;
  }

  /**
   * RPC endpoints are never returned over the API. They are infrastructure
   * configuration, and publishing them invites a third party to use our
   * paid quota — the client resolves chains from its own configuration.
   */
  async setEnabled(id: string, enabled: boolean) {
    await this.prisma.chain.update({ where: { id }, data: { enabled } });
    return this.findById(id);
  }
}
