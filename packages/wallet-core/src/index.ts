import type { AccountDescriptor, SmartAccountDescriptor } from '@correnthian/types';

/**
 * THE KEY BOUNDARY
 * ================
 *   private key / seed  ->  user device  ->  local signing  ->  signed tx  ->  network
 *
 * Nothing in this package accepts an HTTP client, an RPC endpoint, or a
 * provider credential. That is enforced structurally rather than by review:
 * if a network capability is ever added to this package's dependency graph,
 * the boundary has been broken and the architecture is no longer what the
 * threat model describes.
 *
 * This package must remain free of: React, Next.js, React Native, fetch,
 * axios, and every provider SDK.
 */

export interface Signer {
  /** Produce a signature over `payload` using key material held in this container. */
  sign(payload: SignablePayload): Promise<Signature>;
}

export interface SignablePayload {
  /** Chain- and scheme-specific payload to be signed. */
  readonly body: string;
  readonly chainId?: number;
}

export interface Signature {
  readonly scheme: 'eip712' | 'eip191' | 'bip341' | 'ed25519';
  readonly value: string;
}

export interface KeyContainer {
  /** Never leaves the device. Never serialized to a transport. */
  readonly id: string;
  listAccounts(): Promise<readonly AccountDescriptor[]>;
  getAccount(chainId: number | string): Promise<AccountDescriptor | undefined>;
  signer(account: AccountDescriptor): Signer;
  lock(): Promise<void>;
  isLocked(): boolean;
}

/**
 * ERC-4337 smart accounts. Passkey-unlocked, with guardians.
 *
 * Every EVM holding lives here. There is no seed phrase on this path, so
 * there is nothing for a user to write down, photograph, or be phished for.
 */
export interface SmartAccountManager {
  /** Compute the deterministic CREATE2 address without touching the network. */
  deriveAddress(ownerPublicKey: string, chainId: number): `0x${string}`;
  /** Deploy if not yet on-chain. Must be safe to call repeatedly. */
  ensureDeployed(account: SmartAccountDescriptor): Promise<SmartAccountDescriptor>;
  guardians(): Promise<readonly string[]>;
}

/**
 * Seed-derived accounts, required for Bitcoin and Solana.
 *
 * Kept deliberately separate from SmartAccountManager so that "which recovery
 * model protects this holding" is answerable without inspecting the chain.
 */
export interface SeedAccountManager {
  derive(chainId: number | string, index: number): Promise<AccountDescriptor>;
  accounts(): Promise<readonly AccountDescriptor[]>;
}

export class WalletLockedError extends Error {
  constructor() {
    super('Wallet is locked');
    this.name = 'WalletLockedError';
  }
}
