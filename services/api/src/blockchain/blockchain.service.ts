import { EvmAdapter, type BlockchainAdapter } from '@correnthian/blockchain';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Resolves a chain to its adapter.
 *
 * RPC URLs are read from the database and never returned by the API — they are
 * our metered quota, and publishing them invites a third party onto it. The
 * client resolves chains from its own configuration.
 *
 * Adapters are built once and cached, because constructing one builds a viem
 * client per endpoint and that is not free on a hot path.
 */
@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly cache = new Map<string, BlockchainAdapter>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async forChain(chainId: string): Promise<BlockchainAdapter> {
    const cached = this.cache.get(chainId);
    if (cached) return cached;

    const chain = await this.prisma.chain.findUnique({ where: { id: chainId } });
    if (!chain) throw AppError.notFound(`Chain not configured: ${chainId}`);

    const endpoints = chain.rpcUrls
      .map((url) => ({ url, weight: 0 }))
      .filter((e) => e.url.length > 0);

    if (endpoints.length === 0) {
      // A chain with no RPC configured is a configuration gap, not a user error.
      // Saying so plainly is more useful than a generic provider failure.
      throw AppError.providerUnavailable(
        `No RPC endpoint is configured for ${chain.name}. This is a deployment gap, not a client error.`,
      );
    }

    const adapter = new EvmAdapter(
      {
        chainId: chain.id,
        family: chain.family,
        nativeSymbol: chain.nativeSymbol,
        decimals: chain.decimals,
        explorerUrl: chain.explorerUrl,
        enabled: chain.enabled,
        isTestnet: chain.isTestnet,
      },
      endpoints,
    );

    this.cache.set(chainId, adapter);
    return adapter;
  }

  /** Drop a cached adapter, e.g. after its RPC configuration changes. */
  invalidate(chainId: string): void {
    this.cache.delete(chainId);
  }

  /** Per-chain reachability for the readiness probe. Never exposes the URLs. */
  async health(): Promise<Record<string, { healthy: boolean; enabled: boolean }>> {
    const chains = await this.prisma.chain.findMany({ select: { id: true, name: true, enabled: true } });
    const out: Record<string, { healthy: boolean; enabled: boolean }> = {};

    for (const chain of chains) {
      if (!chain.enabled) {
        out[chain.name] = { healthy: false, enabled: false };
        continue;
      }
      try {
        const adapter = await this.forChain(chain.id);
        out[chain.name] = { healthy: await adapter.isHealthy(), enabled: true };
      } catch {
        out[chain.name] = { healthy: false, enabled: true };
      }
    }
    return out;
  }
}
