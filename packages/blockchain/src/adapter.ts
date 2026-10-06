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

export interface TransactionRecord {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed' | 'dropped';
  blockNumber: bigint | null;
  confirmations: number;
  /** Block timestamp when known, ISO-8601. */
  blockTime: string | null;
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

  getTransaction(hash: string): Promise<TransactionRecord>;
  getBlockNumber(): Promise<bigint>;

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
