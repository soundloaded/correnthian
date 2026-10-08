import type { AddressFamily } from './address.js';

/**
 * Blockchain access.
 *
 * This interface is the only way the rest of Correnthian talks to a network.
 * Everything above it — portfolio, pricing, wallets, the admin — is chain
 * agnostic, so adding Bitcoin or Solana means implementing this and nothing
 * else changes.
 *
 * Read operations are safe to call anywhere. Signing is deliberately absent:
 * producing a transaction belongs to the user's device, not to a server that
 * holds no key and therefore cannot honestly sign one. `buildTransaction`
 * assembles an unsigned payload for the client to sign.
 */

export interface Balance {
  /** Base units, as a decimal string. Never a float — an 18-decimal balance in a
   * double has already lost the low digits before anyone formats it. */
  raw: string;
  decimals: number;
}

/**
 * A token transfer observed on-chain in which a watched address participates.
 *
 * Chain-neutral on purpose: an adapter over UTXOs or Solana instructions would
 * synthesise this same shape from its own primitives, so nothing above this
 * line has to learn how a particular network reports that value moved.
 */
export interface ObservedTokenTransfer {
  /** Transaction hash — unique per chain, and the idempotency key above. */
  txHash: string;
  /** Position of this transfer within its transaction. A tx may move several. */
  logIndex: number;
  /** Block it was mined in. Used for confirmation depth and reorg detection. */
  blockNumber: bigint;
  /** Contract address of the token, not its ticker. An identity, not a label. */
  token: string;
  from: string;
  to: string;
  /** Base units, as a decimal string — never a float. */
  amountRaw: string;
}

export interface FeeEstimate {
  /** Native-currency amount, in wei-equivalent base units. */
  raw: string;
  /** What the fee is worth in the chain's native currency, for display. */
  nativeSymbol: string;
}

export interface UnsignedTransaction {
  /** Chain-specific payload, ready for the client to sign. */
  to: string;
  value: string;
  data: string;
  chainId: number;
  /** Populated where the family uses one. */
    nonce?: number;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gas?: string;
}

/**
 * One transaction, as a node that has it reports it.
 *
 * **Absence is the `null` return, not a status.** `status: 'dropped'` used to
 * be declared here and could never be produced: a node that does not have a
 * transaction answers with `result: null`, which `viem` turns into an
 * exception, and `RpcPool` wraps every exception identically — so "the chain
 * does not have this" and "the chain did not answer" were the same failure to
 * its caller. `getTransaction` now answers that distinction directly, which is
 * the only thing drop detection can be built on.
 *
 * `confirmations` and `blockTime` were also here, hard-coded to `0` and
 * `null`: this adapter does not know the chain head and never fetches a block,
 * so neither could ever be filled. A field that is always zero reads as a
 * measurement, so they are gone rather than documented — the caller already
 * holds the head when it needs depth, and a block timestamp is a separate
 * read for whoever wants one.
 */
export interface TransactionRecord {
  hash: string;
  /**
   * `pending` — in the mempool, no block yet.
   * `confirmed` — mined, and the receipt reports success.
   * `failed` — mined, and the receipt reports a revert. Mined is not the same
   * as succeeded, and recording a reverted send as confirmed would tell an
   * account holder their money moved when it did not.
   */
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber: bigint | null;
  from: string;
  to: string | null;
  valueRaw: string;
}

export interface ChainDescriptor {
  chainId: string;
  family: AddressFamily;
  nativeSymbol: string;
  decimals: number;
  explorerUrl: string | null;
  /** Whether this chain is enabled for users. */
  enabled: boolean;
  isTestnet: boolean;
}

export interface BlockchainAdapter {
  readonly id: string;
  readonly family: AddressFamily;

  describe(): ChainDescriptor;

  /** Native balance of an address. */
  getBalance(address: string): Promise<Balance>;
  /** ERC-20 balance. Returns zero for an unknown contract rather than throwing. */
  getTokenBalance(address: string, contract: string): Promise<Balance>;
  /** Balances for several contracts in one pass, keyed by contract. */
  getTokenBalances(address: string, contracts: readonly string[]): Promise<Record<string, Balance>>;

  estimateFee(tx: Omit<UnsignedTransaction, 'maxFeePerGas' | 'maxPriorityFeePerGas' | 'gas'>): Promise<FeeEstimate>;

  /**
   * Assemble an unsigned transaction. Never signs — Correnthian's servers hold
   * no key, so a signed payload here would be a lie about the architecture.
   */
  buildTransaction(req: BuildTransactionRequest): Promise<UnsignedTransaction>;

  /** Submit a payload the client already signed. */
  broadcastTransaction(signed: string): Promise<string>;

  /**
   * Look one transaction up by hash.
   *
   * Resolves `null` when a node that answered correctly does not have it —
   * a definitive answer, not a failure, and deliberately not routed through
   * the failover path. Anything else it cannot determine throws, because an
   * unknown is not an absence.
   */
  getTransaction(hash: string): Promise<TransactionRecord | null>;
  getBlockNumber(): Promise<bigint>;

  /**
   * Token transfers where one of `addresses` is the sender or the receiver,
   * over an inclusive block range. At most one RPC page per address list —
   * callers are expected to page, not to ask for a year of blocks at once.
   *
   * Used to index observed activity for registered addresses. **It observes
   * and never acts:** there is no signing path in it and none could be added
   * without reaching the key boundary.
   *
   * Native-coin transfers are deliberately absent. They are not in a token
   * contract's logs, so surfacing them needs a block-by-block scan or a tracing
   * endpoint — a different cost and a different correctness story. Native
   * holdings are covered by balance sync until that exists, and the gap is
   * documented rather than papered over with a zero.
   */
  getTokenTransfers(params: {
    /** Addresses to watch, in any case the adapter normalises internally. */
    addresses: readonly string[];
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<ObservedTokenTransfer[]>;

  /** Whether the chain is reachable right now. Drives the readiness probe. */
  isHealthy(): Promise<boolean>;
}

export interface BuildTransactionRequest {
  chainId: string;
  to: string;
  value?: string;
  data?: string;
  from?: string;
}

/** Narrowing helper so callers cannot pass an EVM adapter where Bitcoin is meant. */
export function supportsFamily(adapter: BlockchainAdapter, family: AddressFamily): boolean {
  return adapter.family === family;
}
