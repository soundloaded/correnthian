import { Inject, Injectable, Logger } from '@nestjs/common';
import { redact } from '@correnthian/security';
import { validateAddress, type BuildTransactionRequest, type UnsignedTransaction } from '@correnthian/blockchain';
import { BlockchainService } from '../blockchain/blockchain.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/errors.js';
import { decodeCursor, encodeCursor, KEYSET_ORDER, keysetAfter } from '../common/keyset.js';
import { isOperatorRole } from '../common/roles.js';
import type { Transaction } from '../generated/prisma/client.js';

/**
 * A transaction row at the HTTP boundary. Identical to the Prisma row except
 * `blockNumber`: a BigInt cannot cross `JSON.stringify` (it throws), so the
 * service maps it to a decimal string on every read that can reach a
 * response. Reads that never leave the process keep the raw type.
 */
export type TransactionRow = Omit<Transaction, 'blockNumber'> & {
  blockNumber: string | null;
};
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateTransactionDto, ObservationDto, TransitionDto,
} from './dto/create-transaction.dto.js';
import type { ListTransactionsDto } from './dto/list-transactions.dto.js';
import {
  allowedTransitions, DEFAULT_CONFIRMATIONS, DEFAULT_INTENT_TTL_MINUTES,
  reporterFor, reasonRequired, SYSTEM_ROLE,
  type TxState,
} from './transaction-lifecycle.js';

/**
 * The wire shape of one operator-table row.
 *
 * Declared rather than inferred: `listAll` returns a mapped array and
 * `presentRow` takes its element, so inferring either from the other is a
 * circular definition TypeScript refuses. Naming it also makes the contract
 * the thing `packages/contracts` is checked against.
 */
export interface TransactionListItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  state: TxState;
  direction: 'in' | 'out' | 'internal';
  user: { id: string; email: string };
  wallet: { id: string; address: string };
  chain: { id: string; name: string; family: string; explorerUrl: string | null };
  asset: { assetId: string; symbol: string; name: string };
  provider: { slug: string; name: string } | null;
  amountRaw: string;
  amountUsd: number | null;
  destination: string | null;
  txHash: string | null;
  feeRaw: string | null;
  confirmations: number;
  requiredConfirmations: number;
  dropCount: number;
  droppedAt: string | null;
  lastSeenAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  expiresAt: string | null;
  signedAt: string | null;
  broadcastAt: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
  /** States this row may legally move to next. Computed, never stored. */
  permittedNext: readonly TxState[];
}

/** The detail adds the chain data the table withholds. */
export interface TransactionDetail extends TransactionListItem {
  metadata: unknown;
}

/** The caller of a state change, whoever it turns out to be. */
export interface TransactionActor {
  id: string;
  role: string;
}

const SYSTEM_ACTOR: TransactionActor = { id: SYSTEM_ROLE, role: SYSTEM_ROLE };

/**
 * One transfer as the chain reported it, for a row that does not exist yet.
 *
 * Deliberately not `CreateTransactionDto`: that shape describes an intent
 * someone filed, and every field it requires — an expiry, a transferable
 * asset, a destination — is a question nobody asked about a deposit that has
 * already happened.
 */
export interface ObservedTransactionInput {
  walletId: string;
  /** `Asset.assetId`, the derived registry key — not the contract address. */
  assetKey: string;
  txHash: string;
  direction: 'in' | 'out' | 'internal';
  /** Where the value went. Null for an inbound transfer, whose value came here. */
  destination?: string | null;
  /** Base units, as a positive decimal string. Never a float. */
  amountRaw: string;
  blockNumber: bigint;
  /** Depth at the supplied head. The state decision stays in `observe`. */
  confirmations: number;
  /** `logIndex` and how many transfers this hash carried. Facts, not guesses. */
  metadata?: Record<string, unknown>;
}

/**
 * Whether the caller is platform staff rather than a customer is decided by
 * `isOperatorRole` in `common/roles.ts` — the same map the HTTP guard reads.
 * This module used to keep its own copy of `RANK`, which is the kind of
 * duplication that only surfaces when the two disagree about whether someone
 * may move a gold redemption forward.
 */

const POSITIVE_DECIMAL = /^\d+(\.\d+)?$/;

/**
 * The relations every read projection resolves.
 *
 * Shared on purpose: the console renders one row shape, so the list, the
 * detail and an account's own history must agree about what a row is. The
 * alternative — a different `include` per route — is how a table renders
 * "no provider" for a quote that has one.
 */
const ROW_INCLUDE = {
  asset: { select: { assetId: true, symbol: true, name: true } },
  chain: { select: { id: true, name: true, family: true, explorerUrl: true } },
  wallet: { select: { id: true, address: true } },
  provider: { select: { slug: true, name: true } },
  user: { select: { id: true, email: true } },
} as const;


/**
 * The transaction lifecycle engine — §21, §62.
 *
 * Two properties are structural here rather than documented:
 *
 * **It never signs.** There is no method that takes a private key, a
 * signature, or a payload to sign, and there is no dependency that could
 * produce one. `markSigned` records that the account holder's *device*
 * reported signing, and calls the state it records `signed` — a report, not a
 * fact Correnthian verified. It cannot verify one: verification needs the
 * signed payload, and storing that payload here would make this table the
 * best target in the system (see the `Transaction` doc comment in
 * `schema.prisma`). `key-boundary.spec.ts` asserts the absence structurally.
 *
 * **Transitions are a table.** `transaction-lifecycle.ts` is the only place
 * that knows which edges exist. Every rejection below is that table saying no,
 * which is why the error message can name the edge rather than describe a
 * condition someone forgot to write.
 */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(BlockchainService) private readonly blockchain: BlockchainService,
  ) {}

  // --- creation ------------------------------------------------------------

  /**
   * Record an intended movement.
   *
   * The owner is taken from the wallet, never from the input: who filed a
   * transaction is a property of the request, whose money moves is a property
   * of the wallet, and only the second one may go in the column.
   */
  async create(input: CreateTransactionDto, userId: string) {
    if (!POSITIVE_DECIMAL.test(input.amountRaw) || /^0+(\.0+)?$/.test(input.amountRaw)) {
      throw AppError.badRequest('amountRaw must be a positive decimal string');
    }

    const [wallet, asset] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { id: input.walletId }, include: { chain: true } }),
      this.prisma.asset.findUnique({ where: { assetId: input.assetId } }),
    ]);

    // Not "forbidden": a caller probing another account's wallet ids should
    // not learn that the id exists.
    if (!wallet || wallet.userId !== userId) throw AppError.notFound('Wallet not found');
    if (!wallet.chain.enabled) {
      throw AppError.badRequest(`Chain ${wallet.chainId} is not enabled`);
    }
    if (!asset) throw AppError.notFound('Asset not in the registry');
    if (!asset.enabled) throw AppError.badRequest(`${asset.symbol} is not currently enabled`);
    if (!asset.transferSupported) {
      throw AppError.badRequest(`${asset.symbol} cannot be transferred`);
    }
    // The registry is keyed by chain, so this should be impossible — but a
    // transaction recorded against the wrong chain would be unresolvable
    // later, and "should be impossible" is not a constraint.
    if (asset.chainId !== wallet.chainId) {
      throw AppError.badRequest(
        `${asset.symbol} is on chain ${asset.chainId}, not ${wallet.chainId}`,
      );
    }

    const direction = input.direction ?? 'out';
    const destination = input.destination ? this.validateDestination(input.destination, wallet.chain.family) : null;
    if (!destination && direction !== 'in') {
      throw AppError.badRequest('An outbound transaction needs a destination address');
    }

    const provider = input.providerSlug
      ? await this.prisma.provider.findUnique({ where: { slug: input.providerSlug } })
      : null;
    if (input.providerSlug && !provider) {
      throw AppError.notFound(`Unknown provider: ${input.providerSlug}`);
    }

    const familyDefault = DEFAULT_CONFIRMATIONS[wallet.chain.family] ?? 1;
    const requiredConfirmations = Math.max(input.requiredConfirmations ?? familyDefault, familyDefault);

    const created = await this.prisma.transaction.create({
      data: {
        userId: wallet.userId,
        walletId: wallet.id,
        assetId: asset.id,
        chainId: wallet.chainId,
        providerId: provider?.id ?? null,
        direction,
        destination,
        state: 'created',
        amountRaw: input.amountRaw,
        amountUsd: input.amountUsd ?? null,
        feeRaw: input.feeRaw ?? null,
        feeUsd: input.feeUsd ?? null,
        requiredConfirmations,
        ...(input.metadata ? { metadata: input.metadata as object } : {}),
        expiresAt: new Date(
          Date.now() + (input.expiresInMinutes ?? DEFAULT_INTENT_TTL_MINUTES) * 60_000,
        ),
      },
    });

    await this.audit.record({
      actorId: userId,
      action: 'transaction.created',
      targetType: 'Transaction',
      targetId: created.id,
      after: { state: 'created', direction, amountRaw: created.amountRaw, destination },
      metadata: {
        chainId: created.chainId, assetId: asset.assetId, symbol: asset.symbol,
        provider: provider?.slug ?? null,
      },
    });

    return created;
  }

  /**
   * The client says it signed.
   *
   * Correnthian neither signs nor verifies. It has no key to sign with, and it
   * deliberately stores nothing that would let it verify — a signed
   * transaction is a replayable authorisation while its nonce is unspent, and
   * it is not shaped like a secret, so `redactDeep()` would not stop it.
   *
   * So this writes exactly two things: that the owner of this wallet reported
   * it, and when. The audit entry reads `transaction.signed` with a derived
   * before/after, and the `before` is `created` — the record says the report
   * happened, which is all Correnthian is in a position to know.
   */
  async markSigned(id: string, actor: TransactionActor) {
    return this.apply(id, 'signed', actor, { signedAt: new Date() });
  }

  /**
   * The client says it put the transaction on the network.
   *
   * A hash is required and is bound to this row by `(chainId, txHash)`. Two
   * transactions claiming the same hash is not a race we resolve by
   * last-write-wins — it is a conflict, and the database is what says so.
   */
  async reportBroadcast(id: string, actor: TransactionActor, input: TransitionDto) {
    if (!input.txHash) throw AppError.badRequest('A broadcast needs the transaction hash');
    return this.apply(id, 'broadcast', actor, {
      txHash: input.txHash,
      broadcastAt: new Date(),
      ...this.moneyPatch(input),
    });
  }

  /**
   * Advance the machine. Every state change goes through here.
   *
   * The caller states which state they believe the transaction is in; this
   * table decides whether that is a claim it will act on.
   */
  async transition(id: string, to: TxState, actor: TransactionActor, input: TransitionDto) {
    if (to === 'created') {
      throw AppError.badRequest('`created` is only reachable by creating a transaction');
    }
    return this.apply(id, to, actor, {
      ...this.moneyPatch(input),
      ...this.stateTimestamps(to),
      ...(to === 'failed'
        ? {
            errorCode: input.errorCode ?? null,
            // Provider and RPC error strings can carry endpoints and topology.
            errorMessage: input.errorMessage ? this.summariseError(input.errorMessage) : null,
          }
        : {}),
      ...(input.txHash ? { txHash: input.txHash } : {}),
    }, input.reason);
  }

  // --- BE-602: the server assembles, the device signs ----------------------

  /**
   * Assemble an unsigned intent into something a device can sign.
   *
   * Read-only with respect to the lifecycle: the row stays in `created`,
   * because assembling is not signing and nothing exists on the network
   * until the owner's device says so. What *is* written is the fee this
   * account holder was shown — `feeRaw` as gas × fee cap, exact, in base
   * units — because a fee reconstructed later from a different fee market
   * is a fee the user never agreed to.
   *
   * Encoding happens behind the adapter: a service that hand-built ERC-20
   * calldata would have reached past `BlockchainAdapter` and picked up
   * knowledge that belongs to a chain family.
   */
  async assemble(id: string, userId: string) {
    const tx = await this.load(id);
    if (tx.state !== 'created') {
      throw AppError.conflict(
        `This transaction is "${tx.state}"; only an unsigned intent can be assembled`,
      );
    }
    if (tx.direction === 'in') {
      // An inbound transfer arrived on its own. There is no device holding a
      // key on that side of it — offering to assemble one would invite the
      // client to ask *who* should sign a deposit they already received.
      throw AppError.badRequest('An inbound transfer already happened; there is nothing to sign');
    }

    const [wallet, asset] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { id: tx.walletId }, include: { chain: true } }),
      this.prisma.asset.findUnique({ where: { id: tx.assetId } }),
    ]);
    // Not "forbidden": a caller probing another account's ids should not learn
    // the id exists — same rule as `create`. The wallet is the ownership
    // authority (`Transaction.userId` is denormalised from it), so this single
    // check is the whole authorisation: an earlier one on the row itself would
    // have said the same thing in a second place to keep correct.
    if (!wallet || wallet.userId !== userId) throw AppError.notFound('Transaction not found');
    if (!asset || !tx.destination) throw AppError.notFound('Transaction not found');

    const adapter = await this.blockchain.forChain(tx.chainId);
    const request = this.intentRequest(tx, wallet.address, asset.contractAddress);

    let unsigned: UnsignedTransaction;
    try {
      unsigned = await adapter.buildTransaction(request);
    } catch (err) {
      throw this.assemblyFailure(err);
    }

    const feeRaw =
      unsigned.gas && unsigned.maxFeePerGas
        ? (BigInt(unsigned.gas) * BigInt(unsigned.maxFeePerGas)).toString()
        : null;

    const previous = (tx.metadata as Record<string, unknown> | null) ?? {};
    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: {
        ...(feeRaw ? { feeRaw } : {}),
        metadata: {
          ...previous,
          build: {
            nonce: unsigned.nonce ?? null,
            gas: unsigned.gas ?? null,
            maxFeePerGas: unsigned.maxFeePerGas ?? null,
            maxPriorityFeePerGas: unsigned.maxPriorityFeePerGas ?? null,
            builtAt: new Date().toISOString(),
          },
        },
      },
    });

    await this.audit.record({
      actorId: userId,
      action: 'transaction.assembled',
      targetType: 'Transaction',
      targetId: tx.id,
      metadata: {
        chainId: tx.chainId,
        feeRaw,
        nonce: unsigned.nonce ?? null,
      },
    });

    return {
      id: tx.id,
      state: tx.state,
      chainId: tx.chainId,
      walletAddress: wallet.address,
      assetId: asset.assetId,
      destination: tx.destination,
      amountRaw: tx.amountRaw,
      unsigned,
      fee: feeRaw ? { raw: feeRaw, nativeSymbol: wallet.chain.nativeSymbol } : null,
    };
  }

  /**
   * Relay a payload the device signed, after checking it is the one this
   * server assembled.
   *
   * The relay itself never touches a key — the payload arrives already
   * signed, which is the whole shape of the boundary (ADR-001). But a relay
   * that would send *any* bytes it is handed would make the ledger's
   * destination and amount columns decoration: the row says what the intent
   * said, the chain does what the bytes said, and nothing connects them.
   *
   * So three facts are checked against the intent before anything reaches
   * the network — who signed (recovered from the signature, so a payload
   * edited after signing recovers someone else), which chain, and whether
   * `to`/`value`/`data` equal the payload `assemblePayload` derives from
   * this same intent. The node gets the last word on validity; this is the
   * server's word on *identity*.
   *
   * A failed relay leaves the row in `signed`, so the device can retry.
   */
  async relay(id: string, userId: string, signed: string) {
    const tx = await this.load(id);
    if (tx.userId !== userId) throw AppError.notFound('Transaction not found');
    if (tx.state !== 'signed') {
      throw AppError.conflict(
        tx.state === 'created'
          ? 'Report the signature first: this transaction has not been reported as signed'
          : `This transaction is "${tx.state}" and can no longer be broadcast`,
      );
    }

    const [wallet, asset] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { id: tx.walletId } }),
      this.prisma.asset.findUnique({ where: { id: tx.assetId } }),
    ]);
    if (!wallet || !asset) throw AppError.notFound('Transaction not found');
    const destination = tx.destination;
    if (!destination) throw AppError.notFound('Transaction not found');

    const adapter = await this.blockchain.forChain(tx.chainId);

    let facts: Awaited<ReturnType<typeof adapter.decodeSignedTransaction>>;
    try {
      facts = await adapter.decodeSignedTransaction(signed);
    } catch (err) {
      throw this.assemblyFailure(err);
    }

    if (facts.chainId !== Number(tx.chainId)) {
      throw AppError.badRequest(
        `This payload was signed for chain ${facts.chainId}, not ${tx.chainId}`,
      );
    }
    if (facts.from.toLowerCase() !== wallet.address.toLowerCase()) {
      throw AppError.badRequest(
        'This payload was signed by a different account than the wallet it is filed against',
      );
    }

    const expected = adapter.assemblePayload(this.intentRequest(tx, wallet.address, asset.contractAddress));
    if (
      facts.to?.toLowerCase() !== expected.to.toLowerCase() ||
      facts.value !== expected.value ||
      facts.data.toLowerCase() !== expected.data.toLowerCase()
    ) {
      throw AppError.badRequest(
        'This payload does not match the transaction it is filed against — ' +
          'the destination, amount or token transfer differ from what was assembled',
      );
    }

    let hash: string;
    try {
      hash = await adapter.broadcastTransaction(signed);
    } catch (err) {
      throw this.assemblyFailure(err);
    }

    return this.reportBroadcast(tx.id, { id: userId, role: 'user' }, {
      to: 'broadcast',
      txHash: hash,
    });
  }

  /** The chain-neutral request this intent assembles to. */
  private intentRequest(
    tx: TransactionRow,
    from: string,
    contractAddress: string,
  ): BuildTransactionRequest {
    if (!tx.destination) {
      throw AppError.badRequest('This transaction has no destination to assemble');
    }
    // A native asset is the empty contract address — the registry's spelling
    // for "no contract", and the one branch that decides value vs calldata.
    if (contractAddress === '') {
      return {
        chainId: tx.chainId,
        from,
        to: tx.destination,
        value: tx.amountRaw,
      };
    }
    return {
      chainId: tx.chainId,
      from,
      to: tx.destination,
      token: contractAddress,
      amount: tx.amountRaw,
    };
  }

  /**
   * An assembly or relay failure, split into the two kinds a client acts on
   * differently.
   *
   * Transport (pool exhausted, endpoint down) is not the caller's problem:
   * 503, retry later, and no detail — the pool's message carries our RPC
   * endpoints, which are a metered quota this API never returns.
   *
   * Everything else is the node declining the request — an estimateGas
   * revert, bytes that are not a transaction — and the caller can act on it:
   * 400 with the reason, through `summariseError`, which strips endpoints
   * and truncates. Viem's standard failure body is `URL: http://…` on its
   * second line, so this is the path where redaction has to be real.
   */
  private assemblyFailure(err: unknown): AppError {
    const message = err instanceof Error ? err.message : String(err);
    if (/All \d+ RPC endpoint\(s\) failed/.test(message)) {
      return AppError.providerUnavailable(
        'The chain could not be reached while processing this transaction',
      );
    }
    return AppError.badRequest(this.summariseError(message));
  }

  // --- observation ---------------------------------------------------------

  /**
   * Record a transfer the chain reported, rather than one anyone asked for.
   *
   * An account that *receives* gold has filed no intent, signed nothing and
   * broadcast nothing, so `create` cannot describe it: that method asks who
   * is sending, when the intent expires, and whether the asset may be
   * transferred at all — three questions about a deposit that is already on
   * chain. This is the path that writes a row from a hash and a depth alone.
   *
   * Three deliberate differences from `create`:
   *
   *  - **`transferSupported` is not checked.** That flag says whether
   *    Correnthian will *execute* a transfer of this asset. Recording one that
   *    already happened is not an execution, and refusing to write history
   *    because the asset is currently frozen would put a hole in the record
   *    exactly where an operator most needs to see it.
   *  - **The hash is present on the first write.** `@@unique([chainId,
   *    txHash])` is the idempotency mechanism, and a unique index on a column
   *    that is still NULL does not constrain anything — Postgres treats NULLs
   *    as distinct, so a row born without its hash can be written twice.
   *  - **It is born at the state its depth already warrants**, rather than in
   *    `created`. A first sighting of a transfer twelve blocks deep that wrote
   *    `pending` beside `confirmations: 12, requiredConfirmations: 12` would
   *    be a row contradicting itself until a later run noticed.
   *
   * It does not touch `expiresAt`, so `expireStale` cannot sweep a row that
   * represents something already settled on the network.
   */
  async recordObserved(input: ObservedTransactionInput, at: Date = new Date()) {
    if (!POSITIVE_DECIMAL.test(input.amountRaw) || /^0+(\.0+)?$/.test(input.amountRaw)) {
      throw AppError.badRequest('amountRaw must be a positive decimal string');
    }

    const [wallet, asset] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { id: input.walletId }, include: { chain: true } }),
      this.prisma.asset.findUnique({ where: { assetId: input.assetKey } }),
    ]);
    if (!wallet) throw AppError.notFound('Wallet not found');
    if (!wallet.chain.enabled) {
      throw AppError.badRequest(`Chain ${wallet.chainId} is not enabled`);
    }
    if (!asset) throw AppError.notFound('Asset not in the registry');
    if (asset.chainId !== wallet.chainId) {
      throw AppError.badRequest(
        `${asset.symbol} is on chain ${asset.chainId}, not ${wallet.chainId}`,
      );
    }

    const required = DEFAULT_CONFIRMATIONS[wallet.chain.family] ?? 1;
    const confirmations = Math.max(0, Math.trunc(input.confirmations));
    const settled = confirmations >= required;

    // Already written? Then this is a re-sighting, and `observe` owns that —
    // it is the single place that decides whether depth promotes or demotes.
    const existing = await this.prisma.transaction.findUnique({
      where: { chainId_txHash: { chainId: wallet.chainId, txHash: input.txHash } },
    });
    if (existing) {
      if (existing.userId !== wallet.userId || existing.walletId !== wallet.id) {
        // Two of our wallets on one hash. The schema permits one row per hash,
        // so it belongs to whichever wallet was written first; saying so beats
        // quietly re-pointing a row at a different account.
        this.logger.warn(
          `Transaction ${input.txHash} on ${wallet.chainId} already belongs to wallet ` +
            `${existing.walletId}; recording nothing for ${wallet.id}`,
        );
        return { id: existing.id, created: false, changed: false };
      }
      await this.observe(existing.id, SYSTEM_ACTOR, {
        txHash: input.txHash,
        confirmations,
        // The DTO takes a decimal string because it crosses HTTP; this path
        // already holds a bigint and must not be re-parsed into a float.
        blockNumber: input.blockNumber.toString(),
        outcome: 'seen',
        metadata: input.metadata,
      }, at);
      return { id: existing.id, created: false, changed: true };
    }

    const created = await this.prisma.transaction.create({
      data: {
        userId: wallet.userId,
        walletId: wallet.id,
        assetId: asset.id,
        chainId: wallet.chainId,
        providerId: null,
        direction: input.direction,
        destination: input.destination ?? null,
        txHash: input.txHash,
        state: settled ? 'confirmed' : 'pending',
        amountRaw: input.amountRaw,
        // No price for this block is held, and a deposit's dollar value is a
        // number an operator would read as settled fact. It stays null until
        // something that owns pricing fills it.
        amountUsd: null,
        blockNumber: input.blockNumber,
        confirmations,
        requiredConfirmations: required,
        lastSeenAt: at,
        ...(settled ? { confirmedAt: at } : {}),
        metadata: (input.metadata ?? {}) as object,
      },
    });

    await this.audit.record({
      actorId: SYSTEM_ACTOR.id,
      action: 'transaction.observed',
      targetType: 'Transaction',
      targetId: created.id,
      after: {
        state: created.state,
        direction: created.direction,
        amountRaw: created.amountRaw,
        txHash: created.txHash,
        confirmations: created.confirmations,
      },
      metadata: {
        chainId: created.chainId,
        assetId: asset.assetId,
        symbol: asset.symbol,
        blockNumber: created.blockNumber?.toString() ?? null,
      },
    });

    return { id: created.id, created: true, changed: true };
  }

  /**
   * Record what a node reports about a transaction.
   *
   * Kept apart from `transition` because depth is a fact read off a chain,
   * not a claim made by a person. Two consequences:
   *
   *  - Confirmation counting happens here and nowhere else. Reaching the
   *    required depth promotes the row; falling below it demotes a confirmed
   *    row back to `pending` and records a drop, which is what a reorg looks
   *    like from here.
   *  - A drop is not a state. The row keeps its identity and moves, so a
   *    transaction that leaves the mempool and is accepted again later is one
   *    transaction with `dropCount = 1`, not a dead record and a new one.
   */
  async observe(
    id: string,
    actor: TransactionActor,
    input: ObservationDto,
    /** The run's own clock. Defaults to the wall clock for an HTTP caller. */
    at: Date = new Date(),
  ) {
    const current = await this.load(id);
    // Same stranger rule as `apply`: observations bind a row to a hash for
    // life, so a foreign id must not even resolve.
    if (actor.role !== SYSTEM_ROLE && !isOperatorRole(actor.role) && current.userId !== actor.id) {
      throw AppError.notFound('Transaction not found');
    }
    this.assertOperator(actor, current, 'observe');

    // A row is bound to one hash for life. Two hashes on one row means one of
    // them is wrong, and last-write-wins would silently pick.
    if (current.txHash && current.txHash !== input.txHash) {
      throw AppError.conflict(
        `This transaction is already bound to hash ${current.txHash}`,
      );
    }

    const seenAt = at;
    const patch: Record<string, unknown> = {
      txHash: input.txHash,
      confirmations: input.confirmations,
      // A drop is a report that the node cannot see it. `lastSeenAt` means the
      // opposite, so it is deliberately not touched on that path.
      ...(input.outcome === 'dropped' ? {} : { lastSeenAt: seenAt }),
      ...(input.blockNumber ? { blockNumber: BigInt(input.blockNumber) } : {}),
      ...(input.blockTime ? { blockTime: new Date(input.blockTime) } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    if (input.outcome === 'dropped') {
      patch['droppedAt'] = seenAt;
      patch['dropCount'] = { increment: 1 };
    }

    // A node reporting a failure is a chain fact, not an opinion.
    if (input.outcome === 'reverted' || input.outcome === 'replaced') {
      return this.apply(id, 'failed', actor, {
        ...patch,
        failedAt: seenAt,
        errorCode: input.outcome,
        errorMessage:
          input.reason ??
          `Reported by a chain node: the transaction was ${input.outcome === 'reverted' ? 'reverted' : 'replaced'}.`,
      }, input.reason);
    }

    const settled = input.confirmations >= current.requiredConfirmations;

    if (current.state === 'created') {
      // First sighting of an inbound transfer: the chain, not the client, is
      // what tells us it exists, so the hash is attached here rather than at a
      // broadcast nobody performed. An outbound row in `created` has no such
      // edge, and the lifecycle table refuses it below.
      return this.apply(id, 'pending', actor, { ...patch, broadcastAt: seenAt });
    }

    if (current.state === 'broadcast') {
      // Seen on the network but not yet mined at any depth.
      return this.apply(id, 'pending', actor, { ...patch });
    }

    if (current.state === 'signed') {
      // The client normally reports its own broadcast. If the indexer gets
      // there first, the chain saying so is better evidence than the client
      // saying so — and the client's report will then be an idempotent no-op.
      return this.apply(id, 'broadcast', actor, { ...patch, broadcastAt: seenAt });
    }

    if (settled && current.state === 'pending') {
      return this.apply(id, 'confirmed', actor, { ...patch, confirmedAt: seenAt });
    }

    if (!settled && current.state === 'confirmed') {
      // The depth fell back below the threshold. `confirmed > pending` demands
      // a reason; here the reason is the chain itself, so it is stated rather
      // than invented.
      return this.apply(id, 'pending', actor, {
        ...patch,
        confirmedAt: null,
        droppedAt: seenAt,
        dropCount: { increment: 1 },
      }, `Chain reorg: confirmation depth fell to ${input.confirmations}, below the required ${current.requiredConfirmations}.`);
    }

    // Ordinary depth update on a row already in the right state.
    const { count } = await this.prisma.transaction.updateMany({
      where: { id, state: current.state },
      data: patch,
    });
    if (count === 0) {
      throw AppError.conflict('This transaction changed while the observation was in flight');
    }
    return this.load(id);
  }

  /**
   * Expire unsigned intents nobody acted on.
   *
   * The sweep exists so `expired` is reachable without an operator having to
   * notice. It only touches states where nothing exists on the network — a
   * broadcast transaction is never expired, because expiring it would be a
   * claim about money that may still be moving.
   */
  async expireStale(now = new Date()) {
    const stale = await this.prisma.transaction.findMany({
      where: { state: { in: ['created', 'signed'] }, expiresAt: { lt: now } },
      select: { id: true },
      take: 200,
    });

    const expired: string[] = [];
    for (const row of stale) {
      try {
        await this.apply(row.id, 'expired', SYSTEM_ACTOR, {}, 'Unsigned intent passed its expiry.');
        expired.push(row.id);
      } catch (err) {
        // One row that moved underneath us must not abandon the rest of the
        // sweep; the next run picks it up.
        this.logger.warn(
          `Could not expire transaction ${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { expired: expired.length, ids: expired, at: now.toISOString() };
  }

  // --- reads ---------------------------------------------------------------

  /**
   * One transaction, in the same shape the list uses.
   *
   * `metadata` is the exception: it is arbitrary chain data, so it is read one
   * row at a time rather than put in a table.
   *
   * Scoped to owner-or-operator: the row carries amounts, destinations and
   * the owner's email, so an unscoped read is a cross-account leak, not a
   * missing filter. A stranger gets 404 rather than 403, so probing ids
   * learns nothing — the same rule as `create`.
   */
  async detail(id: string, actor: TransactionActor): Promise<TransactionDetail> {
    const row = await this.prisma.transaction.findUnique({ where: { id }, include: ROW_INCLUDE });
    if (!row) throw AppError.notFound('Transaction not found');
    if (row.userId !== actor.id && !isOperatorRole(actor.role)) {
      throw AppError.notFound('Transaction not found');
    }
    return { ...this.presentRow(row), metadata: row.metadata ?? null };
  }

  /**
   * An account's own history.
   *
   * The same projection as the console's, because a user and an operator
   * disagreeing about what happened is the failure this whole module exists to
   * prevent.
   */
  async findForUser(
    userId: string,
    query: { state?: TxState; direction?: 'in' | 'out' | 'internal'; limit: number },
  ): Promise<TransactionListItem[]> {
    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        ...(query.state ? { state: query.state } : {}),
        ...(query.direction ? { direction: query.direction } : {}),
      },
      orderBy: [...KEYSET_ORDER],
      take: Math.min(query.limit, 100),
      include: ROW_INCLUDE,
    });
    return rows.map((row) => this.presentRow(row));
  }

  /**
   * The operator table.
   *
   * Keyset, not offset: an offset skips or repeats a row at every page
   * boundary on a table that is being written to continuously. The cursor
   * carries both halves of the sort key, because either alone is ambiguous.
   */
  async listAll(query: ListTransactionsDto): Promise<{
    items: TransactionListItem[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(query.limit, 100);
    const after = query.cursor ? decodeCursor(query.cursor) : null;

    const rows = await this.prisma.transaction.findMany({
      where: {
        ...(query.state ? { state: query.state } : {}),
        ...(query.direction ? { direction: query.direction } : {}),
        ...(query.chainId ? { chainId: query.chainId } : {}),
        ...(query.walletId ? { walletId: query.walletId } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
                ...keysetAfter(after, 'createdAt'),
      },
      orderBy: [...KEYSET_ORDER],
      take: limit + 1,
      include: ROW_INCLUDE,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    return {
      items: page.map((row) => this.presentRow(row)),
      nextCursor: hasMore && last ? encodeCursor({ id: last.id, at: last.createdAt }) : null,
    };
  }

  /** Counters for the operations overview. */
  async stats() {
    const [total, byState, byDirection] = await Promise.all([
      this.prisma.transaction.count(),
      this.prisma.transaction.groupBy({ by: ['state'], _count: { _all: true } }),
      this.prisma.transaction.groupBy({ by: ['direction'], _count: { _all: true } }),
    ]);
    return {
      total,
      byState: Object.fromEntries(byState.map((r) => [r.state, r._count._all])),
      byDirection: Object.fromEntries(byDirection.map((r) => [r.direction, r._count._all])),
    };
  }

  /**
   * Per-day counts and settled USD volume for the dashboard chart.
   *
   * One query, grouped in the process: `days` caps at 90, so the row set
   * stays small. `amountUsd` is a Decimal — it crosses as the float the
   * Prisma row already maps it to in `presentRow`, rounded to cents here
   * so a float tail never reaches the chart.
   */
  async daily(days: number): Promise<Array<{ date: string; count: number; volumeUsd: number }>> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const rows = await this.prisma.transaction.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, state: true, amountUsd: true },
    });
    const buckets = new Map<string, { count: number; volumeUsd: number }>();
    for (let i = 0; i < days; i += 1) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + i);
      buckets.set(day.toISOString().slice(0, 10), { count: 0, volumeUsd: 0 });
    }
    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.count += 1;
      if (row.state === 'confirmed' && row.amountUsd != null) {
        bucket.volumeUsd += Number(row.amountUsd.toString());
      }
    }
    return [...buckets.entries()].map(([date, bucket]) => ({
      date,
      count: bucket.count,
      volumeUsd: Math.round(bucket.volumeUsd * 100) / 100,
    }));
  }

  // --- the machine ---------------------------------------------------------

  /**
   * The one place a state changes.
   *
   * Order is the argument:
   *
   *   1. read the current row,
   *   2. is this caller entitled to say this,
   *   3. does the table allow the edge,
   *   4. is a reason owed,
   *   5. compare-and-swap on the state we read,
   *   6. only then write the audit entry.
   *
   * Step 5 is what makes concurrent updates safe. `updateMany` with the
   * expected state in the `where` is a single atomic statement: if two
   * operators read `pending` at the same moment and one moves it to
   * `confirmed`, the other's update matches zero rows and it is told so. The
   * lossy alternative — read, then unconditional `update` — silently lets the
   * second write overwrite the first, which is the exact disagreement §62
   * exists to make visible.
   */
  private async apply(
    id: string,
    to: TxState,
    actor: TransactionActor,
    patch: Record<string, unknown> = {},
    reason?: string | null,
  ): Promise<TransactionRow> {
    const current = await this.load(id);
    const from = current.state;

    // A non-operator asking about another account's row learns nothing —
    // not even that it exists. Same rule as `create` and `detail`, and it
    // sits ahead of entitlement so the 403s below keep their reasons for
    // callers with a legitimate row to ask about.
    if (actor.role !== SYSTEM_ROLE && !isOperatorRole(actor.role) && current.userId !== actor.id) {
      throw AppError.notFound('Transaction not found');
    }

    this.assertEntitled(actor, current, to);

    // Re-applying the state a row is already in is not a transition. Indexers
    // and webhooks redeliver, and a duplicate delivery must not be an error —
    // but it is not a change either, so nothing is written.
    if (from === to) return current;

    const permitted = allowedTransitions(current.direction, from);
    if (!permitted.includes(to)) {
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        action: `transaction.transition.rejected.${to}`,
        targetType: 'Transaction',
        targetId: id,
        outcome: 'failure',
        before: { state: from },
        after: { state: to },
        reason: reason ?? `Refused: "${from}" → "${to}" is not a permitted transition.`,
        metadata: { permitted },
      });
      throw AppError.badRequest(
        `Cannot move a ${current.direction} transaction from "${from}" to "${to}". ` +
          `Permitted from "${from}": ${permitted.length ? permitted.join(', ') : 'nothing — it is final'}.`,
        { from, to, permitted },
      );
    }

    if (reasonRequired(from, to)) {
      // Throws before the write, so the row never moves with no explanation.
      this.audit.assertReason(`transaction.${from}>${to}`, reason);
    }

    const data: Record<string, unknown> = { state: to, ...patch };

    // A re-broadcast is this same transaction coming back after a drop. Counted
    // here rather than at the call site so the reporting path and the
    // observation path cannot disagree about what a re-broadcast means.
    if (to === 'broadcast' && from !== 'signed') {
      data['droppedAt'] = new Date();
      data['dropCount'] = { increment: 1 };
    }

    const { count } = await this.prisma.transaction.updateMany({
      where: { id, state: from },
      data: data as never,
    });

    if (count === 0) {
      const latest = await this.load(id);
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'transaction.transition.conflict',
        targetType: 'Transaction',
        targetId: id,
        outcome: 'failure',
        before: { state: from },
        after: { state: latest.state },
        reason: reason ?? null,
        metadata: { attempted: to },
      });
      throw AppError.conflict(
        `Transaction was "${from}" when this request read it and is "${latest.state}" now — ` +
          `someone else moved it to "${latest.state}" first. ` +
          `Re-read it before trying to move it to "${to}".`,
      );
    }

    const updated = await this.load(id);

    // Every state change is a state change, so it goes through `recordChange`
    // and gets a derived before/after. Nothing here hand-builds the pair.
    await this.audit.recordChange({
      actorId: actor.id,
      actorRole: actor.role,
      action: `transaction.${to}`,
      targetType: 'Transaction',
      targetId: id,
      reason: reason ?? null,
      before: this.auditSnapshot(current),
      after: this.auditSnapshot(updated),
      metadata: { direction: current.direction, txHash: updated.txHash },
    });

    return updated;
  }

  /**
   * Is this caller entitled to assert `to`?
   *
   * `owner` means the wallet's own account. `operator` means `support` and
   * above. `system` means the scheduler, and is not available to a user at
   * any role — a caller cannot reach it by claiming to be something.
   */
  private assertEntitled(actor: TransactionActor, tx: TransactionRow, to: TxState): void {
    const required = reporterFor(to);

    // `system` is not a user role: no session can carry it, so a caller cannot
    // reach this branch by claiming anything.
    if (actor.role === SYSTEM_ROLE) return;

    if (required === 'system') {
      throw AppError.forbidden(`Only the scheduler may assert "${to}"`);
    }

    if (isOperatorRole(actor.role)) return;

    if (required === 'owner' && actor.id === tx.userId) return;

    throw AppError.forbidden(
      `Reporting "${to}" on a transaction requires ${required === 'owner' ? 'its owner or support' : 'support'}`,
    );
  }

  private assertOperator(actor: TransactionActor, tx: TransactionRow, what: string): void {
    // The same rule `assertEntitled` applies, for the same reason: `system` is
    // the scheduler, and no session can carry that role because it is not in
    // `ROLE_RANK` at all — `rankOf` would give it -1 either way. Without this
    // line `observe` rejected the one caller it exists for, while `apply`
    // accepted it, so an indexer could record a transaction it could never
    // advance. The asymmetry went unnoticed only because nothing scheduled
    // called `observe` until now.
    if (actor.role === SYSTEM_ROLE) return;
    if (isOperatorRole(actor.role)) return;
    if (actor.id === tx.userId) {
      throw AppError.forbidden(`Only support may ${what} a transaction's chain state`);
    }
    throw AppError.forbidden('Not permitted');
  }

  private async load(id: string): Promise<TransactionRow> {
    const row = await this.prisma.transaction.findUnique({ where: { id } });
    if (!row) throw AppError.notFound('Transaction not found');
    return { ...row, blockNumber: row.blockNumber?.toString() ?? null };
  }

  private validateDestination(destination: string, family: 'evm' | 'bitcoin' | 'solana'): string {
    const result = validateAddress(destination, family);
    if (!result.valid || !result.normalised) {
      // A mistyped address is an irreversible loss of funds, so this is
      // checked before the row exists rather than at the point of signing,
      // where it is too late to be useful.
      throw AppError.badRequest(result.reason ?? 'Not a valid address for this chain');
    }
    return result.normalised;
  }

  /**
   * Provider and RPC errors can carry endpoints, keys and topology. The
   * failure is recorded; the internals are not.
   */
  private summariseError(message: string): string {
    // Redact first, then truncate: the order matters, because truncation
    // only hides an endpoint that happens to sit past the cut — and viem
    // puts `URL: http://…` in the first two lines of a failure.
    const safe = redact(message);
    return safe.length > 200 ? `${safe.slice(0, 197)}...` : safe;
  }

  private moneyPatch(input: TransitionDto): Record<string, unknown> {
    return {
      ...(input.amountUsd ? { amountUsd: input.amountUsd } : {}),
      ...(input.feeRaw ? { feeRaw: input.feeRaw } : {}),
      ...(input.feeUsd ? { feeUsd: input.feeUsd } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };
  }

  private stateTimestamps(to: TxState): Record<string, unknown> {
    const now = new Date();
    switch (to) {
      case 'signed': return { signedAt: now };
      case 'broadcast': return { broadcastAt: now };
      case 'pending': return { confirmedAt: null };
      case 'confirmed': return { confirmedAt: now };
      case 'failed': return { failedAt: now };
      default: return {};
    }
  }

  /**
   * The columns that go into `before`/`after`.
   *
   * An explicit list rather than the whole row: a snapshot of every column
   * would put `metadata` — arbitrary chain data we did not write — into the
   * audit trail on every state change, and would keep growing as columns are
   * added. `diffState` trims this to what actually differs anyway; the list
   * keeps the surface predictable.
   */
  private auditSnapshot(tx: TransactionRow) {
    return {
      state: tx.state,
      txHash: tx.txHash,
      direction: tx.direction,
      confirmations: tx.confirmations,
      requiredConfirmations: tx.requiredConfirmations,
      droppedAt: tx.droppedAt?.toISOString() ?? null,
      dropCount: tx.dropCount,
      errorCode: tx.errorCode,
      errorMessage: tx.errorMessage,
      feeRaw: tx.feeRaw,
      confirmedAt: tx.confirmedAt?.toISOString() ?? null,
    };
  }

  private presentRow(row: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    state: TxState;
    direction: 'in' | 'out' | 'internal';
    user: { id: string; email: string };
    wallet: { id: string; address: string };
    chain: { id: string; name: string; family: string; explorerUrl: string | null };
    asset: { assetId: string; symbol: string; name: string };
    provider: { slug: string; name: string } | null;
    amountRaw: string;
    amountUsd: { toString(): string } | null;
    destination: string | null;
    txHash: string | null;
    feeRaw: string | null;
    confirmations: number;
    requiredConfirmations: number;
    dropCount: number;
    droppedAt: Date | null;
    lastSeenAt: Date | null;
    errorCode: string | null;
    errorMessage: string | null;
    expiresAt: Date | null;
    signedAt: Date | null;
    broadcastAt: Date | null;
    confirmedAt: Date | null;
    failedAt: Date | null;
  }): TransactionListItem {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      state: row.state,
      direction: row.direction,
      user: { id: row.user.id, email: row.user.email },
      wallet: { id: row.wallet.id, address: row.wallet.address },
      chain: {
        id: row.chain.id, name: row.chain.name,
        family: row.chain.family, explorerUrl: row.chain.explorerUrl,
      },
      asset: { assetId: row.asset.assetId, symbol: row.asset.symbol, name: row.asset.name },
      provider: row.provider ? { slug: row.provider.slug, name: row.provider.name } : null,
      amountRaw: row.amountRaw,
      amountUsd: row.amountUsd === null ? null : Number(row.amountUsd),
      destination: row.destination,
      txHash: row.txHash,
      feeRaw: row.feeRaw,
      confirmations: row.confirmations,
      requiredConfirmations: row.requiredConfirmations,
      dropCount: row.dropCount,
      droppedAt: row.droppedAt?.toISOString() ?? null,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      signedAt: row.signedAt?.toISOString() ?? null,
      broadcastAt: row.broadcastAt?.toISOString() ?? null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      /** The states this row may legally move to next. Computed, never stored. */
      permittedNext: allowedTransitions(row.direction, row.state),
    };
  }
}