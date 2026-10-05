import { Inject, Injectable } from '@nestjs/common';
import { deriveAssetId } from '@correnthian/assets';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProvidersService } from '../providers/providers.service.js';

export interface QuoteRequestInput {
  userId?: string;
  fromAssetId: string;
  toAssetId: string;
  fromAmountRaw: string;
  notionalUsd?: string;
  slippageBps?: number;
}

/** Reject anything that is not a plain positive decimal string. */
const DECIMAL = /^\d+(\.\d+)?$/;

@Injectable()
export class SwapsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProvidersService) private readonly providers: ProvidersService,
  ) {}

  /**
   * Create a quote.
   *
   * This records the quote and its disclosure. It does NOT execute anything —
   * execution happens on-chain in the user's own wallet, and Correnthian's
   * role is to make the terms legible before the user signs.
   *
   * `sizeCapUsd` and `executionQuality` are mandatory. A thin-market quote that
   * does not disclose its own limit is how a user gets a filled order at a
   * materially worse price than they were shown.
   */
  async createQuote(input: QuoteRequestInput) {
    if (!DECIMAL.test(input.fromAmountRaw)) {
      throw AppError.badRequest('fromAmountRaw must be a positive decimal string');
    }
    if (input.fromAssetId === input.toAssetId) {
      throw AppError.badRequest('Cannot quote a conversion to the same asset');
    }

    const [from, to] = await Promise.all([
      this.prisma.asset.findUnique({ where: { assetId: input.fromAssetId } }),
      this.prisma.asset.findUnique({ where: { assetId: input.toAssetId } }),
    ]);
    if (!from || !to) throw AppError.notFound('One or both assets are not in the registry');
    if (!from.enabled || !to.enabled) {
      throw AppError.badRequest('One or both assets are not currently enabled');
    }

    const chain = await this.prisma.chain.findUnique({ where: { id: from.chainId } });
    if (!chain?.enabled) throw AppError.badRequest('The source chain is not enabled');

    const expiresAt = new Date(Date.now() + 60_000);
    const fees = [
      { label: 'Correnthian fee', amountUsd: 0, kind: 'correnthian' },
    ];

    const quote = await this.prisma.swapQuote.create({
      data: {
        userId: input.userId ?? null,
        railKind: 'provider',
        railId: 'unassigned',
        fromAssetId: from.id,
        toAssetId: to.id,
        chainId: from.chainId,
        fromAmountRaw: input.fromAmountRaw,
        // Placeholder until a provider rail is contracted. Never a fabricated
        // executable price — see the design spec: honest failure is the point.
        toAmountRaw: '0',
        notionalUsd: input.notionalUsd ?? null,
        priceImpactBps: 0,
        slippageBps: input.slippageBps ?? 50,
        minReceivedRaw: '0',
        fees,
        executionQuality: 'none',
        sizeCapUsd: null,
        state: 'quoted',
        expiresAt,
      },
    });

    return this.present(quote);
  }

  async findById(id: string) {
    const quote = await this.prisma.swapQuote.findUnique({ where: { id } });
    if (!quote) throw AppError.notFound('Quote not found');
    return this.present(quote);
  }

  list(userId?: string, state?: string) {
    return this.prisma.swapQuote.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(state ? { state: state as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        fromAsset: { select: { assetId: true, symbol: true, name: true } },
        toAsset: { select: { assetId: true, symbol: true, name: true } },
        provider: { select: { slug: true, name: true, status: true } },
      },
    });
  }

  async stats() {
    const [total, byState, byRail] = await Promise.all([
      this.prisma.swapQuote.count(),
      this.prisma.swapQuote.groupBy({ by: ['state'], _count: { _all: true } }),
      this.prisma.swapQuote.groupBy({ by: ['railKind'], _count: { _all: true } }),
    ]);
    return {
      total,
      byState: Object.fromEntries(byState.map((r) => [r.state, r._count._all])),
      byRail: Object.fromEntries(byRail.map((r) => [r.railKind, r._count._all])),
    };
  }

  /** The shape a client needs to render a quote honestly. */
  private present(quote: {
    id: string; railKind: string; railId: string; fromAmountRaw: string;
    toAmountRaw: string; slippageBps: number; priceImpactBps: number;
    minReceivedRaw: string; fees: unknown; executionQuality: string;
    sizeCapUsd: unknown; state: string; expiresAt: Date;
  }) {
    return {
      id: quote.id,
      rail: { kind: quote.railKind, id: quote.railId },
      fromAmountRaw: quote.fromAmountRaw,
      toAmountRaw: quote.toAmountRaw,
      slippageBps: quote.slippageBps,
      priceImpactBps: quote.priceImpactBps,
      minReceivedRaw: quote.minReceivedRaw,
      fees: quote.fees,
      executionQuality: quote.executionQuality,
      sizeCapUsd: quote.sizeCapUsd === null ? null : Number(quote.sizeCapUsd),
      state: quote.state,
      expiresAt: quote.expiresAt.toISOString(),
      executable: quote.executionQuality !== 'none' && Number(quote.toAmountRaw) > 0,
    };
  }
}
