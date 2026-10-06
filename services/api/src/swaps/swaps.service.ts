import { Inject, Injectable, Logger } from '@nestjs/common';
import { deriveAssetId } from '@correnthian/assets';
import { AppError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProvidersService } from '../providers/providers.service.js';
import { FeesService } from '../fees/fees.service.js';
import {
  isWithinStoreRange, MoneyError, notionalUsd as notionalFromRaw, parseUsd, type Usd,
} from '../fees/money.js';
import type { ListQuotesDto } from './dto/list-quotes.dto.js';

export interface QuoteRequestInput {
  userId?: string;
  fromAssetId: string;
  toAssetId: string;
  fromAmountRaw: string;
  /**
   * The caller's own idea of the notional.
   *
   * Stored on the quote as a display field and **never** used as a fee base.
   * A percentage fee computed from a number the payer states is a percentage
   * the payer sets: `notionalUsd: "0.01"` would cost almost nothing. The fee
   * base is derived server-side from a recorded reference price — see
   * `deriveNotionalUsd` — and where it cannot be derived the breakdown says
   * the fee is unknown rather than trusting this.
   */
  notionalUsd?: string;
  slippageBps?: number;
}

/** Reject anything that is not a plain positive decimal string. */
const DECIMAL = /^\d+(\.\d+)?$/;

/**
 * A price older than this is not a price.
 *
 * Matches `PricingService.MAX_AGE_SECONDS`. Spelled out here rather than
 * imported because that service hands back a `number`, and this module will
 * not do arithmetic on one — see `fees/money.ts`.
 */
const PRICE_MAX_AGE_SECONDS = 300;

/** The keyset position: both halves of the sort key, because either alone is ambiguous. */
interface QuoteCursor {
  createdAt: Date;
  id: string;
}

function encodeCursor(row: { id: string; createdAt: Date }): string {
  return Buffer.from(JSON.stringify({ t: row.createdAt.toISOString(), i: row.id }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): QuoteCursor {
  let parsed: { t?: unknown; i?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { t?: unknown; i?: unknown };
  } catch {
    throw AppError.badRequest('cursor is not a valid pagination cursor');
  }
  const createdAt = new Date(String(parsed?.t));
  if (typeof parsed?.i !== 'string' || Number.isNaN(createdAt.getTime())) {
    // Silently restarting at page one would hide a client bug behind a page
    // that looks fine, so this is an error rather than a default.
    throw AppError.badRequest('cursor is not a valid pagination cursor');
  }
  return { createdAt, id: parsed.i };
}

@Injectable()
export class SwapsService {
  private readonly logger = new Logger(SwapsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProvidersService) private readonly providers: ProvidersService,
    @Inject(FeesService) private readonly fees: FeesService,
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

    // The fee is resolved before the quote is written and stored with it.
    //
    // Every line is itemised and every line says what it is: a configured zero
    // is `computed` at "0.00000000", and a fee nobody has configured is
    // `unknown` with `amountUsd: null` and a reason. The three are always
    // present — network, provider, Correnthian — because a kind that is
    // silently absent from a quote is exactly the hardcoded zero this
    // replaces.
    //
    // `throwIfConflicting` rather than a fallback: two rules that both claim
    // to price this quote cannot be resolved without guessing, and guessing a
    // fee is the one thing this engine is not allowed to do. The request
    // fails with a code the operator can act on instead of a quote carrying a
    // number nobody chose.
    const breakdown = await this.fees.breakdown({
      operation: 'swap',
      // The **from** asset: a fee is levied on what is being converted, not on
      // what is received. Its category is resolved inside `FeesService`, so a
      // rule written against `metal` matches a gold token without this module
      // having to know that `Asset.category` and `FeeAssetCategory` are two
      // names for the same values.
      assetId: from.assetId,
      notionalUsd: (await this.deriveNotionalUsd(from, input.fromAmountRaw)) ?? null,
    });

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
        // The caller's stated notional, kept as a display field. The fees
        // above were computed from `breakdown.notionalUsd`, which is derived
        // and is not this.
        notionalUsd: input.notionalUsd ?? null,
        priceImpactBps: 0,
        slippageBps: input.slippageBps ?? 50,
        minReceivedRaw: '0',
        fees: breakdown as object,
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

  /**
   * The operator's quote table — every account's quotes, not just the caller's.
   *
   * Keyset on `createdAt`, tie-broken by `id`. `createdAt` alone is not unique:
   * two quotes written in the same millisecond are ordinary, and a bare
   * `createdAt < cursor` predicate then skips or repeats one at every page
   * boundary. The cursor carries both halves of the sort key.
   *
   * Assets and the provider are resolved here rather than in the console. An
   * admin that joins three tables to render one table has no way to distinguish
   * "this quote has no provider" from "we forgot to look one up", and the
   * difference is exactly what an operator is checking.
   */
  async listAll(query: ListQuotesDto) {
    const limit = Math.min(query.limit, 100);
    const after = query.cursor ? decodeCursor(query.cursor) : null;

    const rows = await this.prisma.swapQuote.findMany({
      where: {
        ...(query.state ? { state: query.state } : {}),
        ...(query.railKind ? { railKind: query.railKind } : {}),
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.createdAt } },
                { createdAt: after.createdAt, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        createdAt: true,
        state: true,
        railKind: true,
        railId: true,
        provider: { select: { slug: true, name: true } },
        fromAsset: { select: { assetId: true, symbol: true } },
        toAsset: { select: { assetId: true, symbol: true } },
        fromAmountRaw: true,
        toAmountRaw: true,
        notionalUsd: true,
        priceImpactBps: true,
        slippageBps: true,
        sizeCapUsd: true,
        executionQuality: true,
        expiresAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    return {
      items: page.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        state: row.state,
        railKind: row.railKind,
        railId: row.railId,
        provider: row.provider,
        fromAsset: row.fromAsset,
        toAsset: row.toAsset,
        fromAmountRaw: row.fromAmountRaw,
        toAmountRaw: row.toAmountRaw,
        // Prisma decimals are Decimal objects; a JSON number is what a client
        // can format without a decimal library.
        notionalUsd: row.notionalUsd === null ? null : Number(row.notionalUsd),
        priceImpactBps: row.priceImpactBps,
        slippageBps: row.slippageBps,
        sizeCapUsd: row.sizeCapUsd === null ? null : Number(row.sizeCapUsd),
        executionQuality: row.executionQuality,
        executable: row.executionQuality !== 'none' && Number(row.toAmountRaw) > 0,
        expiresAt: row.expiresAt.toISOString(),
      })),
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
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

  /**
   * The USD notional the fees will be computed from, derived server-side.
   *
   * `amountRaw` is the caller's amount in base units; the price is the most
   * recent reference price we have on record for the **from** asset. Both are
   * combined in exact integer arithmetic — `fees/money.ts:notionalUsd` — and
   * the result is an exact 10^-8 USD amount or `null`.
   *
   * `null` is the honest answer whenever this cannot be computed exactly: no
   * price on record, a price older than `PRICE_MAX_AGE_SECONDS`, or an amount
   * that is not a plain count of base units. In every one of those cases a
   * percentage fee resolves as `unknown` with a reason, which is true, rather
   * than as a number derived from a figure the payer supplied, which would be
   * whatever the payer wanted it to be.
   */
  private async deriveNotionalUsd(
    from: { id: string; decimals: number },
    fromAmountRaw: string,
  ): Promise<Usd | null> {
    if (!/^\d+$/.test(fromAmountRaw)) {
      this.logger.warn(
        `Quote for ${from.id} carries fromAmountRaw "${fromAmountRaw}", which is not a count of ` +
          `base units, so no notional can be derived and percentage fees will be reported unknown.`,
      );
      return null;
    }

    const row = await this.prisma.assetPrice.findFirst({
      where: { assetId: from.id },
      orderBy: { capturedAt: 'desc' },
      select: { priceUsd: true, capturedAt: true },
    });
    if (!row) {
      this.logger.debug(`No reference price on record for ${from.id}; fees will be reported unknown`);
      return null;
    }

    const ageSeconds = Math.round((Date.now() - row.capturedAt.getTime()) / 1000);
    if (ageSeconds > PRICE_MAX_AGE_SECONDS) {
      // A stale price is not a current price. Pricing an operation on one is
      // how a user is charged against a number that no longer exists.
      this.logger.warn(
        `Reference price for ${from.id} is ${ageSeconds}s old; fees will be reported unknown ` +
          `rather than computed from it.`,
      );
      return null;
    }

    try {
      // `priceUsd` is a Prisma Decimal, exact but trimmed by `toString()`.
      // Round-tripping through `parseUsd` puts it on the 10^-8 scale the rest
      // of the engine speaks.
      const priceUnits = parseUsd(row.priceUsd.toString());
      const units = notionalFromRaw(fromAmountRaw, from.decimals, priceUnits);
      return isWithinStoreRange(units) ? units : null;
    } catch (cause) {
      if (cause instanceof MoneyError) {
        this.logger.warn(`Cannot price ${from.id}: ${cause.message}`);
        return null;
      }
      throw cause;
    }
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
      /**
       * The itemised breakdown: one line per fee, a total only when every line
       * is real, and `complete: false` whenever any line is unknown.
       *
       * Passed through as stored. Quote rows written before the fee engine
       * landed still hold the old `[{ label, amountUsd, kind }]` array; they
       * are not rewritten, because a rewritten history is worse than an old
       * shape. Anything this service writes from now on is a
       * `PublicFeeBreakdown`.
       */
      fees: quote.fees,
      executionQuality: quote.executionQuality,
      sizeCapUsd: quote.sizeCapUsd === null ? null : Number(quote.sizeCapUsd),
      state: quote.state,
      expiresAt: quote.expiresAt.toISOString(),
      executable: quote.executionQuality !== 'none' && Number(quote.toAmountRaw) > 0,
    };
  }
}
