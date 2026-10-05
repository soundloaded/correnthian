import { describeBacking, deriveAssetId } from '@correnthian/assets';
import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toDomainAsset } from './assets.mapper.js';
import type { CreateAssetDto, ListAssetsDto } from './dto/list-assets.dto.js';

@Injectable()
export class AssetsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Every asset is returned with its disclosure string attached. An asset
   * without one is a bug: the UI must never be able to render a token as
   * metal without saying what it actually is.
   */
  async list(query: ListAssetsDto) {
    const rows = await this.prisma.asset.findMany({
      where: {
        ...(query.category ? { category: query.category } : {}),
        ...(query.chainId ? { chainId: query.chainId } : {}),
        ...(query.issuerId ? { issuer: { slug: query.issuerId } } : {}),
        ...(query.enabled === undefined ? {} : { enabled: query.enabled }),
      },
      include: { issuer: true },
      orderBy: [{ category: 'asc' }, { symbol: 'asc' }],
      take: query.limit,
    });

    return rows.map((row) => {
      const asset = toDomainAsset(row);
      return { asset, disclosure: describeBacking(asset) ?? 'Backing information unavailable.' };
    });
  }

  async findByAssetId(assetId: string) {
    const row = await this.prisma.asset.findUnique({
      where: { assetId },
      include: { issuer: true },
    });
    if (!row) throw AppError.notFound('Asset not found');

    const asset = toDomainAsset(row);
    return { asset, disclosure: describeBacking(asset) };
  }

  /**
   * Create an asset, deriving its canonical identity rather than accepting
   * one from the caller. Deriving in exactly one place is what stops
   * "USDT on five chains" collapsing into one ambiguous record.
   */
  async create(dto: CreateAssetDto) {
    const assetId = deriveAssetId({
      chainId: dto.chainId,
      contractAddress: dto.contractAddress,
      issuerId: dto.issuerId,
    });

    const existing = await this.prisma.asset.findUnique({ where: { assetId } });
    if (existing) throw AppError.conflict(`Asset already registered: ${assetId}`);

    const created = await this.prisma.asset.create({
      data: {
        assetId,
        chainId: dto.chainId,
        contractAddress: dto.contractAddress?.toLowerCase() ?? null,
        tokenStandard: dto.tokenStandard,
        symbol: dto.symbol.toUpperCase(),
        name: dto.name,
        decimals: dto.decimals,
        category: dto.category,
        issuerId: dto.issuerId,

        custodyModel: dto.custodyModel,
        custodian: dto.custodian,
        vaultLocations: dto.vaultLocations,
        proofOfReserveUrl: dto.proofOfReserveUrl,
        attestationCadence: dto.attestationCadence,
        lastAttestedAt: dto.lastAttestedAt,
        ouncesPerToken: dto.ouncesPerToken,
        gramsPerToken: dto.gramsPerToken,

        rails: dto.rails,
        swapSupported: dto.swapSupported,
        redeemSupported: dto.redeemSupported,
        verifiedTier: dto.verifiedTier,
        accentColor: dto.accentColor,
        iconUrl: dto.iconUrl,
      },
      include: { issuer: true },
    });

    const asset = toDomainAsset(created);
    return { asset, disclosure: describeBacking(asset) };
  }

  async setEnabled(assetId: string, enabled: boolean) {
    await this.prisma.asset.update({ where: { assetId }, data: { enabled } });
    return this.findByAssetId(assetId);
  }

  /**
   * Record a new attestation. Attestation history is the substance of the
   * trust claim, so the timestamp is server-set, never client-supplied.
   */
  async recordAttestation(assetId: string, at: Date, proofUrl?: string) {
    await this.prisma.asset.update({
      where: { assetId },
      data: {
        lastAttestedAt: at,
        ...(proofUrl ? { proofOfReserveUrl: proofUrl } : {}),
      },
    });
    return this.findByAssetId(assetId);
  }

  /** Registry health: how much of it is verified, and how stale are the attestations. */
  async stats() {
    const [total, enabled, byTier, metals] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.asset.count({ where: { enabled: true } }),
      this.prisma.asset.groupBy({ by: ['verifiedTier'], _count: { _all: true } }),
      this.prisma.asset.count({ where: { category: 'metal', enabled: true } }),
    ]);

    const staleBefore = new Date(Date.now() - 90 * 864e5);
    const staleAttestations = await this.prisma.asset.count({
      where: {
        category: 'metal',
        enabled: true,
        OR: [{ lastAttestedAt: null }, { lastAttestedAt: { lt: staleBefore } }],
      },
    });

    return {
      total,
      enabled,
      enabledMetals: metals,
      staleAttestations,
      byTier: Object.fromEntries(byTier.map((r) => [r.verifiedTier, r._count._all])),
    };
  }
}
