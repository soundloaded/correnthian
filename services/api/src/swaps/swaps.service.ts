import { Inject, Injectable, Logger } from '@nestjs/common';
import { deriveAssetId } from '@correnthian/assets';
import {
  encodeErc20Approve,
  encodeExactInputSingle,
  type UniswapV3FeeTier,
  type UnsignedTransaction,
} from '@correnthian/blockchain';
import { AppError } from '../common/errors.js';
import { isOperatorRole } from '../common/roles.js';
import { decodeCursor, encodeCursor, KEYSET_ORDER, keysetAfter } from '../common/keyset.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '../config/config.service.js';
import { FeesService } from '../fees/fees.service.js';
import { SystemSettingsService } from '../settings/system-settings.service.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import type { PublicFeeBreakdown, PublicFeeLine } from '../fees/fee-breakdown.js';
import {
  isWithinStoreRange, MoneyError, notionalUsd as notionalFromRaw, parseUsd, type Usd,
  formatUsd,
  sumUsd,
} from '../fees/money.js';
import type { ListQuotesDto } from './dto/list-quotes.dto.js';
import { TOKEN_ALLOWANCE, type TokenAllowance } from './token-allowance.js';
import { UniswapV3Quoter, type DexQuoteResult } from './uniswap-v3-quoter.js';

function storedCall(value: unknown): { to: string; value: string; data: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.to !== 'string' || typeof record.value !== 'string' || typeof record.data !== 'string') {
    return null;
  }
  return { to: record.to, value: record.value, data: record.data };
}

/** The unsigned payload `recordAssembly` stored, or null when the row was never finished. */
function replayUnsigned(chainId: string, metadata: unknown): UnsignedTransaction | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const build = (metadata as Record<string, unknown>).build;
  if (!build || typeof build !== 'object' || Array.isArray(build)) return null;
  const payload = storedCall((build as Record<string, unknown>).payload);
  if (!payload) return null;
  const chain = Number(chainId);
  if (!Number.isInteger(chain)) return null;
  const record = build as Record<string, unknown>;
  const unsigned: UnsignedTransaction = { ...payload, chainId: chain };
  if (typeof record.nonce === 'number') unsigned.nonce = record.nonce;
  if (typeof record.gas === 'string') unsigned.gas = record.gas;
  if (typeof record.maxFeePerGas === 'string') unsigned.maxFeePerGas = record.maxFeePerGas;
  if (typeof record.maxPriorityFeePerGas === 'string') {
    unsigned.maxPriorityFeePerGas = record.maxPriorityFeePerGas;
  }
  return unsigned;
}

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


/**
 * Accept a fee payload in either historical shape and return the one the
 * wire contract promises.
 *
 * The contract fixes three lines — network, provider, Correnthian, in §37's
 * order — because a UI that must decide how to lay out the fee panel cannot
 * discover the shape at runtime. Legacy rows hold `[{ label, amountUsd, kind }]`
 * and predate both the fee engine and that convention: their amounts are
 * already decimal strings so no precision is lost in the conversion, but
 * `basis` and `rateBps` were never stored and are reported as absent rather
 * than reconstructed.
 */
function normalizeFees(stored: unknown): PublicFeeBreakdown {
  if (stored && typeof stored === 'object' && !Array.isArray(stored) && 'lines' in stored) {
    return stored as PublicFeeBreakdown;
  }

  const legacy = Array.isArray(stored) ? stored : [];
  const kinds = ['network', 'provider', 'correnthian'] as const;

  const lines: PublicFeeLine[] = kinds.map((kind) => {
    const raw = legacy.find((l) => (l as { kind?: unknown } | null)?.kind === kind) as
      | { label?: unknown; amountUsd?: unknown }
      | undefined;
    const amount = raw?.amountUsd;
    const known = amount !== null && amount !== undefined && amount !== '';
    return {
      kind,
      label: typeof raw?.label === 'string' ? raw.label : labelFor(kind),
      basis: null,
      rateBps: null,
      // `formatUsd` keeps the 8-decimal form the contract requires; a legacy
      // amount is already stored at that scale so this is a re-serialisation.
      amountUsd: known ? formatUsd(parseUsd(String(amount))) : null,
      status: known ? 'computed' : 'unknown',
      reason: known
        ? null
        : 'Recorded before the fee engine existed; the amount was never captured.',
    };
  });

  const unknown = lines
    .filter((l) => l.status === 'unknown')
    .map((l) => ({ kind: l.kind, reason: l.reason ?? 'Amount not captured.' }));
  const known = lines.filter((l) => l.status === 'computed');

  // Known is a *subtotal* and named as one, so no caller can sell it as a
  // total. `totalUsd` stays null while anything is unknown — a partial sum is
  // the number a UI headlines and a customer reads as the price.
  // Seeded with ZERO_USD, not 0n: `Usd` is a branded bigint so a plain one
  // cannot be passed to formatUsd. That is the brand doing its job.
  // `sumUsd` rather than a hand-rolled reduce: `Usd + Usd` types as `bigint`,
  // which would drop the brand and then fail at every `formatUsd` call.
  const subtotal = sumUsd(known.map((l) => parseUsd(l.amountUsd ?? '0')));

  return {
    operation: 'swap',
    notionalUsd: null,
    lines,
    totalUsd: unknown.length === 0 ? formatUsd(subtotal) : null,
    knownSubtotalUsd: formatUsd(subtotal),
    complete: unknown.length === 0,
    unknown,
    rulesetVersion: 'legacy-rows',
  } as PublicFeeBreakdown;
}

function labelFor(kind: 'network' | 'provider' | 'correnthian'): string {
  return kind === 'network' ? 'Network fee' : kind === 'provider' ? 'Provider fee' : 'Correnthian fee';
}

/** Integer base units. A decimal point is a display amount, and the quoter cannot encode one. */
const BASE_UNITS = /^[1-9]\d*$/;

function listsDex(rails: readonly string[] | undefined): boolean {
  return Array.isArray(rails) && rails.includes('dex');
}

function isTokenAddress(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function asAddress(value: string): `0x${string}` | null {
  return isTokenAddress(value) ? value : null;
}

function isFeeTier(fee: number | null): fee is UniswapV3FeeTier {
  return fee === 500 || fee === 3000 || fee === 10000;
}

/**
 * A quote that can be turned into a router call. `executionQuality: 'none'`
 * is the refusal already stored when the quoter did not fill, and preparing
 * it would invent a swap the quote said it does not have.
 */
function isPreparable(quote: {
  executionQuality: string;
  railId: string;
  chainId: string;
  poolFee: number | null;
  fromAmountRaw: string;
  toAmountRaw: string;
  minReceivedRaw: string;
}): boolean {
  return (
    quote.executionQuality !== 'none' &&
    quote.railId === 'uniswap-v3' &&
    quote.chainId === '1' &&
    isFeeTier(quote.poolFee) &&
    BASE_UNITS.test(quote.fromAmountRaw) &&
    BASE_UNITS.test(quote.toAmountRaw) &&
    /^\d+$/.test(quote.minReceivedRaw)
  );
}

@Injectable()
export class SwapsService {
  private readonly logger = new Logger(SwapsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FeesService) private readonly fees: FeesService,
    @Inject(SystemSettingsService) private readonly settings: SystemSettingsService,
    @Inject(UniswapV3Quoter) private readonly uniswap: UniswapV3Quoter,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(TOKEN_ALLOWANCE) private readonly allowances: TokenAllowance,
    @Inject(TransactionsService) private readonly transactions: TransactionsService,
  ) {
    // `ProvidersService` used to be injected here and was never read. It is
    // gone rather than left as a hint: the rail binding it implied is `BE-702`,
    // which is tracked, and an unused provider in a constructor is a comment
    // that costs a dependency and reads as a half-written feature.
  }

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

    // How long a quote can be executed for is a setting, so an operator can
    // change it without a release. It was an unnamed `60_000` here: a minute,
    // with nothing saying so.
    const ttlMs = (await this.settings.get('swaps.quote-ttl-minutes')) * 60_000;
    const expiresAt = new Date(Date.now() + ttlMs);

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
      // `Usd` is a bigint at 10^-8; this boundary wants a decimal string.
      // `formatUsd` and `parseNotional` are the inverse pair, so the exactness
      // survives the crossing with no float on either side.
      notionalUsd: await this.notionalString(from, input.fromAmountRaw),
    });

    const slippageBps = input.slippageBps ?? 50;
    const dex = await this.dexFill(from, to, input.fromAmountRaw, slippageBps);

    const quote = await this.prisma.swapQuote.create({
      data: {
        userId: input.userId ?? null,
        railKind: dex?.railKind ?? 'provider',
        railId: dex?.railId ?? 'unassigned',
        fromAssetId: from.id,
        toAssetId: to.id,
        chainId: from.chainId,
        fromAmountRaw: input.fromAmountRaw,
        // A dex quote records the quoter's amountOut. Anything else — no
        // pool, a revert, a non-integer amount — stays zero. A reference
        // price is not a received amount.
        toAmountRaw: dex?.toAmountRaw ?? '0',
        // The caller's stated notional, kept as a display field. The fees
        // above were computed from `breakdown.notionalUsd`, which is derived
        // and is not this.
        notionalUsd: input.notionalUsd ?? null,
        priceImpactBps: 0,
        slippageBps,
        minReceivedRaw: dex?.minReceivedRaw ?? '0',
        fees: breakdown as object,
        executionQuality: dex?.executionQuality ?? 'none',
        poolFee: dex?.poolFee ?? null,
        sizeCapUsd: null,
        state: 'quoted',
        expiresAt,
      },
    });

    return this.present(quote);
  }

  /**
   * One quote. Scoped to owner-or-operator like transaction detail: quotes
   * carry amounts, asset pairs and fee breakdowns — another account's
   * trading intent, not a public listing. A null owner (no account filed
   * it) is operators-only: with no one to claim it, fail closed.
   */
  async findById(id: string, actor: { id: string; role: string }) {
    const quote = await this.prisma.swapQuote.findUnique({ where: { id } });
    if (!quote) throw AppError.notFound('Quote not found');
    if (quote.userId !== actor.id && !isOperatorRole(actor.role)) {
      throw AppError.notFound('Quote not found');
    }
    return this.present(quote);
  }

  /**
   * File the unsigned calls a device signs for this quote.
   *
   * The server does not sign. Each row is a normal outbound transaction
   * whose calldata is the router `exactInputSingle`, plus an ERC-20
   * `approve` of that router when the wallet's allowance is lower than
   * `fromAmountRaw`. Assembly stores `{ to, value, data }` so relay can
   * check the signature against that payload rather than a token transfer.
   */
  async prepare(quoteId: string, actorId: string, walletId: string): Promise<{
    quoteId: string;
    transactions: Array<{ id: string; kind: 'approve' | 'swap'; unsigned: UnsignedTransaction }>;
  }> {
    const quote = await this.prisma.swapQuote.findUnique({
      where: { id: quoteId },
      include: { fromAsset: true, toAsset: true },
    });
    if (!quote || quote.userId !== actorId) throw AppError.notFound('Quote not found');
    // `>` and not `>=`: a quote that expires at this instant is already expired.
    if (!isPreparable(quote) || !isFeeTier(quote.poolFee) || !(quote.expiresAt.getTime() > Date.now())) {
      throw AppError.badRequest('This quote is not executable');
    }

    const router = this.config.value.uniswap.routerEthereum;
    if (router === undefined) {
      throw AppError.providerUnavailable('The swap router is not configured');
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.userId !== actorId) throw AppError.notFound('Wallet not found');
    if (wallet.chainId !== quote.chainId) {
      throw AppError.badRequest('This quote is not executable');
    }

    const tokenIn = asAddress(quote.fromAsset.contractAddress);
    const tokenOut = asAddress(quote.toAsset.contractAddress);
    const recipient = asAddress(wallet.address);
    if (!tokenIn || !tokenOut || !recipient) {
      throw AppError.badRequest('This quote is not executable');
    }

    const amountIn = BigInt(quote.fromAmountRaw);
    const amountOutMinimum = BigInt(quote.minReceivedRaw);

    // A repeated prepare, while the quote is still live, returns the pair
    // already filed. Estimating again would ask the node for the same nonce
    // and then write a second approve the first one has not spent.
    const filed = await this.prisma.transaction.findMany({
      where: {
        userId: actorId,
        walletId,
        metadata: { path: ['quoteId'], equals: quoteId },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (filed.some((row) => row.state !== 'created')) {
      throw AppError.conflict('This quote has already been prepared');
    }
    const replayed = filed.flatMap((row) => {
      const unsigned = replayUnsigned(row.chainId, row.metadata);
      if (!unsigned || !row.destination) return [];
      const kind = row.destination.toLowerCase() === tokenIn.toLowerCase() ? 'approve' as const : 'swap' as const;
      return [{ id: row.id, kind, unsigned }];
    });
    if (filed.length > 0 && replayed.length === filed.length) {
      return { quoteId, transactions: replayed };
    }
    if (filed.length > 0) {
      await this.transactions.discardCreated(filed.map((row) => row.id));
    }

    const allowance = await this.allowances.allowance(tokenIn, recipient, router);

    const calls: Array<{
      kind: 'approve' | 'swap';
      to: `0x${string}`;
      data: `0x${string}`;
    }> = [];
    if (allowance < amountIn) {
      calls.push({
        kind: 'approve',
        to: tokenIn,
        data: encodeErc20Approve(router, amountIn),
      });
    }
    calls.push({
      kind: 'swap',
      to: router,
      data: encodeExactInputSingle({
        tokenIn,
        tokenOut,
        fee: quote.poolFee,
        recipient,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      }),
    });

    // Estimate both calls before filing either row. The approve is still
    // unsigned when the swap is estimated, so the swap's gas is taken
    // against state that already includes that approve — SwapRouter02 pulls
    // the token with transferFrom. The node has not seen the approve, so
    // the swap also takes the next nonce rather than asking again and
    // receiving the same one. A failure writes nothing: a retry must not
    // find an approve row this attempt left behind.
    const approve = calls.find((call) => call.kind === 'approve');
    const drafted: Array<{
      kind: 'approve' | 'swap';
      to: `0x${string}`;
      data: `0x${string}`;
      unsigned: UnsignedTransaction;
    }> = [];
    let nextNonce: number | undefined;
    for (const call of calls) {
      const unsigned = await this.transactions.buildUnsigned({
        chainId: wallet.chainId,
        from: wallet.address,
        to: call.to,
        value: '0',
        data: call.data,
        ...(nextNonce === undefined ? {} : { nonce: nextNonce }),
        ...(call.kind === 'swap' && approve
          ? { priorCalls: [{ to: approve.to, data: approve.data, value: '0' }] }
          : {}),
      });
      if (typeof unsigned.nonce === 'number') nextNonce = unsigned.nonce + 1;
      drafted.push({ kind: call.kind, to: call.to, data: call.data, unsigned });
    }

    const transactions: Array<{ id: string; kind: 'approve' | 'swap'; unsigned: UnsignedTransaction }> = [];
    const written: string[] = [];
    try {
      for (const draft of drafted) {
        const created = await this.transactions.create(
          {
            walletId,
            assetId: quote.fromAsset.assetId,
            direction: 'out',
            amountRaw: quote.fromAmountRaw,
            destination: draft.to,
            metadata: { quoteId },
          },
          actorId,
          { preparedCall: { to: draft.to, value: '0', data: draft.data } },
        );
        written.push(created.id);
        await this.transactions.recordAssembly(created.id, actorId, draft.unsigned);
        transactions.push({ id: created.id, kind: draft.kind, unsigned: draft.unsigned });
      }
    } catch (err) {
      try {
        await this.transactions.discardCreated(written);
      } catch (discardErr) {
        this.logger.error(
          `Could not remove transactions filed before a failed prepare (${written.join(', ')})`,
        );
        this.logger.debug(discardErr instanceof Error ? discardErr.message : String(discardErr));
      }
      throw err;
    }

    return { quoteId, transactions };
  }

  async list(userId?: string, state?: string) {
    const rows = await this.prisma.swapQuote.findMany({
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
    // The same flag quote detail returns. `priceImpactBps` on this path is
    // a stored placeholder, and a list that omits the flag is how a client
    // reads that zero as a measurement.
    return rows.map((row) => ({ ...row, priceImpactMeasured: false }));
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
                ...keysetAfter(after, 'createdAt'),
      },
      orderBy: [...KEYSET_ORDER],
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
        // Zero bps on this path is a placeholder, not a measurement of the pool.
        priceImpactMeasured: false,
        slippageBps: row.slippageBps,
        sizeCapUsd: row.sizeCapUsd === null ? null : Number(row.sizeCapUsd),
        executionQuality: row.executionQuality,
        executable: row.executionQuality !== 'none' && Number(row.toAmountRaw) > 0,
        expiresAt: row.expiresAt.toISOString(),
      })),
      nextCursor: hasMore && last ? encodeCursor({ id: last.id, at: last.createdAt }) : null,
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
  /** `deriveNotionalUsd`, serialised for the wire boundary. */
  private async notionalString(from: Parameters<SwapsService['deriveNotionalUsd']>[0], fromAmountRaw: string): Promise<string | null> {
    const n = await this.deriveNotionalUsd(from, fromAmountRaw);
    return n === null ? null : formatUsd(n);
  }

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

  /**
   * A Uniswap v3 fill, or null when the request stays the unassigned refusal.
   *
   * Both assets must list `dex`, both must be on Ethereum, the quoter must
   * be configured, and `fromAmountRaw` must be a positive integer in base
   * units. A fractional amount never reaches the quoter. A null answer is
   * the same refusal: received amount zero, no fee tier. `toAmountRaw` is
   * the quoter's `amountOut` — a Chainlink reference price is not copied in.
   * A positive answer is `thin`. This path does not write `deep`.
   */
  private async dexFill(
    from: { chainId: string; rails: readonly string[]; contractAddress: string },
    to: { chainId: string; rails: readonly string[]; contractAddress: string },
    fromAmountRaw: string,
    slippageBps: number,
  ): Promise<{
    railKind: 'dex';
    railId: 'uniswap-v3';
    executionQuality: 'thin';
    poolFee: DexQuoteResult['poolFee'];
    toAmountRaw: string;
    minReceivedRaw: string;
  } | null> {
    if (!this.uniswap?.configured) return null;
    if (!BASE_UNITS.test(fromAmountRaw)) return null;
    if (from.chainId !== '1' || to.chainId !== '1') return null;
    if (!listsDex(from.rails) || !listsDex(to.rails)) return null;
    if (!isTokenAddress(from.contractAddress) || !isTokenAddress(to.contractAddress)) return null;

    const quoted = await this.uniswap.quote({
      tokenIn: from.contractAddress,
      tokenOut: to.contractAddress,
      amountIn: BigInt(fromAmountRaw),
    });
    if (quoted === null || quoted.amountOut <= 0n) return null;

    const minReceived = (quoted.amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
    return {
      railKind: 'dex',
      railId: 'uniswap-v3',
      executionQuality: 'thin',
      poolFee: quoted.poolFee,
      toAmountRaw: quoted.amountOut.toString(),
      minReceivedRaw: minReceived.toString(),
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
      // Zero bps on this path is a placeholder, not a measurement of the pool.
      priceImpactMeasured: false,
      minReceivedRaw: quote.minReceivedRaw,
      /**
       * The itemised breakdown: one line per fee, a total only when every line
       * is real, and `complete: false` whenever any line is unknown.
       *
       * Normalised, never passed through raw. Storage is left exactly as it
       * is: rows written before the fee engine landed hold the old
       * `[{ label, amountUsd, kind }]` array and are not rewritten, because
       * a rewritten history is worse than an old shape. But the *response* has
       * to be one shape the client can rely on, or every consumer needs a
       * branch for both and the contract suite has nothing to assert.
       *
       * `normalizeFees` accepts either and always returns a
       * `PublicFeeBreakdown`. A legacy line has no basis and no rate, so it is
       * reported as computed-with-no-rate rather than reconstructed.
       */
      fees: normalizeFees(quote.fees),
      executionQuality: quote.executionQuality,
      sizeCapUsd: quote.sizeCapUsd === null ? null : Number(quote.sizeCapUsd),
      state: quote.state,
      expiresAt: quote.expiresAt.toISOString(),
      executable: quote.executionQuality !== 'none' && Number(quote.toAmountRaw) > 0,
    };
  }
}
