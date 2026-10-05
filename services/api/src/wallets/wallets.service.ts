import { formatAddress, validateAddress, type AddressFamily } from '@correnthian/blockchain';
import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Wallet registration.
 *
 * THIS SERVICE STORES PUBLIC ADDRESSES ONLY.
 *
 * A `Wallet` row is a watch-list entry that lets us index a portfolio and
 * attribute activity. It is not a custody record, and no field on it can
 * express a key. There is no seed phrase, no private key, no signing share,
 * no encrypted blob — Correnthian's servers hold nothing that could move a
 * user's funds, and that property is only as strong as this service.
 *
 * Addresses are validated on the way in. A mistyped address is a permanent,
 * irreversible loss, and rejecting it here is far better than discovering it
 * at signing time.
 */
@Injectable()
export class WalletsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private familyFor(chainId: string): AddressFamily {
    const chain = FAMILIES[chainId];
    if (!chain) {
      throw AppError.badRequest(`Unsupported or unconfigured chain: ${chainId}`);
    }
    return chain;
  }

  async list(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true, address: true, chainId: true, kind: true, label: true,
        deployed: true, isPrimary: true, guardians: true, createdAt: true,
        _count: { select: { accounts: true, transactions: true } },
      },
    });
    return wallets.map((w) => ({ ...w, display: formatAddress(w.address) }));
  }

  async findById(userId: string, id: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id, userId },
      include: {
        accounts: { include: { asset: { select: { assetId: true, symbol: true, name: true, decimals: true } } } },
      },
    });
    if (!wallet) throw AppError.notFound('Wallet not found');
    return { ...wallet, display: formatAddress(wallet.address) };
  }

  async register(
    userId: string,
    input: { address: string; chainId: string; kind: 'smart' | 'seed'; label?: string; guardians?: string[] },
  ) {
    const family = this.familyFor(input.chainId);

    const validation = validateAddress(input.address, family);
    if (!validation.valid || !validation.normalised) {
      // The reason is written for a user, not a developer.
      throw AppError.badRequest(validation.reason ?? 'Invalid address');
    }

    // A guardians list only makes sense for an on-chain smart account; a
    // seed account has no contract to hold them.
    if (input.kind === 'seed' && input.guardians?.length) {
      throw AppError.badRequest('Seed accounts cannot have guardians — they have no account contract');
    }
    if (input.kind === 'smart' && input.guardians?.length) {
      for (const g of input.guardians) {
        const check = validateAddress(g, 'evm');
        if (!check.valid) {
          throw AppError.badRequest(`Invalid guardian address: ${check.reason ?? 'malformed'}`);
        }
      }
    }

    const existing = await this.prisma.wallet.findUnique({
      where: { chainId_address: { chainId: input.chainId, address: validation.normalised } },
    });
    if (existing) {
      // Do not confirm that an address is already registered to a user.
      throw AppError.conflict('That address is already registered on this network');
    }

    const first = (await this.prisma.wallet.count({ where: { userId } })) === 0;

    return this.prisma.wallet.create({
      data: {
        userId,
        address: validation.normalised,
        chainId: input.chainId,
        kind: input.kind,
        label: input.label ?? null,
        guardians: input.guardians?.map((g) => g.toLowerCase()) ?? [],
        isPrimary: first,
      },
      select: { id: true, address: true, chainId: true, kind: true, label: true, guardians: true, isPrimary: true },
    });
  }

  /** Public addresses only. Values are base-unit strings; never floats. */
  async setBalance(userId: string, walletId: string, assetId: string, balanceRaw: string) {
    if (!/^\d+(\.\d+)?$/.test(balanceRaw)) {
      throw AppError.badRequest('balanceRaw must be a non-negative decimal string');
    }
    const wallet = await this.prisma.wallet.findFirst({ where: { id: walletId, userId } });
    if (!wallet) throw AppError.notFound('Wallet not found');

    const asset = await this.prisma.asset.findUnique({ where: { assetId } });
    if (!asset) throw AppError.notFound('Asset not in the registry');

    return this.prisma.walletAccount.upsert({
      where: { walletId_assetId: { walletId, assetId: asset.id } },
      update: { balanceRaw, lastSyncedAt: new Date() },
      create: { walletId, assetId: asset.id, balanceRaw, lastSyncedAt: new Date() },
      select: { balanceRaw: true, lastSyncedAt: true, assetId: true },
    });
  }

  async setLabel(userId: string, walletId: string, label: string) {
    const { count } = await this.prisma.wallet.updateMany({
      where: { id: walletId, userId }, data: { label },
    });
    if (count === 0) throw AppError.notFound('Wallet not found');
    return this.findById(userId, walletId);
  }

  async setPrimary(userId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findFirst({ where: { id: walletId, userId } });
    if (!wallet) throw AppError.notFound('Wallet not found');
    await this.prisma.$transaction([
      this.prisma.wallet.updateMany({ where: { userId }, data: { isPrimary: false } }),
      this.prisma.wallet.update({ where: { id: walletId }, data: { isPrimary: true } }),
    ]);
    return this.findById(userId, walletId);
  }

  /**
   * Revoke wallet registration. This is a watch-list operation — it removes
   * Correnthian's view, and never touches on-chain funds, which remain where
   * they are. Stated explicitly so no user expects otherwise.
   */
  async deregister(userId: string, walletId: string) {
    const { count } = await this.prisma.wallet.deleteMany({ where: { id: walletId, userId } });
    if (count === 0) throw AppError.notFound('Wallet not found');
  }

  /**
   * Addresses a user controls, in the shape the user should read them.
   * This is the first vertical slice: register, store, display, read balance.
   */
  async portfolio(userId: string) {
    const wallets = await this.list(userId);
    return {
      wallets,
      totalWallets: wallets.length,
      notice: 'Balances are public blockchain data. Correnthian holds no keys for these addresses.',
    };
  }
}

/** Chain id -> address family. Mirrors the adapter registry. */
export const FAMILIES: Record<string, AddressFamily> = {
  '1': 'evm',
  '8453': 'evm',
  '11155111': 'evm',
  '56': 'evm',
  '137': 'evm',
  '42161': 'evm',
  '10': 'evm',
};
