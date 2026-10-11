import { formatBalance } from '@correnthian/blockchain';
import { redact } from '@correnthian/security';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BlockchainService } from './blockchain.service.js';

export interface SyncResult {
  walletId: string;
  chainId: string;
  assetsChecked: number;
  updated: Array<{ assetId: string; balanceRaw: string; formatted: string }>;
  errors: string[];
  syncedAt: string;
}

/**
 * Indexes a registered public address into `WalletAccount`.
 *
 * Reads public chain state only. No key is involved and none could be: the
 * user registered an address, and the chain will tell anyone what it holds.
 *
 * Only assets explicitly enabled for the chain are read. Fetching every
 * contract in the registry for every address would be slow and would invite
 * balances for assets a user should not be shown.
 */
@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BlockchainService) private readonly blockchain: BlockchainService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async syncWallet(userId: string, walletId: string): Promise<SyncResult> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });
    if (!wallet) throw AppError.notFound('Wallet not found');

    const chain = await this.prisma.chain.findUnique({ where: { id: wallet.chainId } });
    if (!chain?.enabled) {
      throw AppError.badRequest(`Chain ${wallet.chainId} is not enabled`);
    }

    const adapter = await this.blockchain.forChain(wallet.chainId);
    const errors: string[] = [];
    const updated: SyncResult['updated'] = [];

    // Native balance first. A chain being unreachable is a real failure and
    // should surface rather than being reported as a zero balance.
    try {
      const native = await adapter.getBalance(wallet.address);
      const nativeAsset = await this.prisma.asset.findFirst({
        where: { chainId: wallet.chainId, contractAddress: '', enabled: true },
      });
      if (nativeAsset) {
        await this.prisma.walletAccount.upsert({
          where: { walletId_assetId: { walletId, assetId: nativeAsset.id } },
          update: { balanceRaw: native.raw, lastSyncedAt: new Date() },
          create: { walletId, assetId: nativeAsset.id, balanceRaw: native.raw, lastSyncedAt: new Date() },
        });
        updated.push({
          assetId: nativeAsset.assetId,
          balanceRaw: native.raw,
          formatted: formatBalance(native.raw, native.decimals),
        });
      }
    } catch (err) {
      errors.push(`native balance: ${this.summariseError(err)}`);
    }

    // Then the enabled tokens on this chain.
    const assets = await this.prisma.asset.findMany({
      where: { chainId: wallet.chainId, enabled: true, NOT: { contractAddress: '' } },
      select: { id: true, assetId: true, contractAddress: true, decimals: true },
    });

    for (const asset of assets) {
      if (!asset.contractAddress) continue;
      try {
        const balance = await adapter.getTokenBalance(wallet.address, asset.contractAddress);
        await this.prisma.walletAccount.upsert({
          where: { walletId_assetId: { walletId, assetId: asset.id } },
          update: { balanceRaw: balance.raw, lastSyncedAt: new Date() },
          create: { walletId, assetId: asset.id, balanceRaw: balance.raw, lastSyncedAt: new Date() },
        });
        updated.push({
          assetId: asset.assetId,
          balanceRaw: balance.raw,
          formatted: formatBalance(balance.raw, asset.decimals),
        });
      } catch (err) {
        // One unreadable contract must not abandon the rest of the sweep.
        errors.push(`${asset.assetId}: ${this.summariseError(err)}`);
      }
    }

    await this.audit.record({
      actorId: userId,
      action: 'wallet.synced',
      targetType: 'Wallet',
      targetId: walletId,
      metadata: { chainId: wallet.chainId, assetsChecked: assets.length, errors: errors.length },
    });

    return {
      walletId, chainId: wallet.chainId,
      // Includes the native read, so the count matches `updated` and `errors`.
      assetsChecked: updated.length + errors.length,
      updated,
      errors,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Adapter failures are viem verbatim — endpoint URLs and request bodies
   * included. `errors[]` is returned in the response and written to audit
   * metadata, so it is redacted and truncated here, mirroring the
   * transaction engine: the failure is recorded, the internals are not.
   */
  private summariseError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    // Redaction replaces the endpoint but leaves viem's diagnostic dump
    // (`URL:`, `Request body:`, call arguments) — labels around nothing the
    // operator can act on. Drop those lines; keep the summary and the cause.
    const kept = redact(message)
      .split('\n')
      .filter((line) => !/^(URL|Request body|Raw Call|Contract Call|Docs|Version):/.test(line.trim()))
      .join('\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
    return kept.length > 200 ? `${kept.slice(0, 197)}...` : kept;
  }
}
