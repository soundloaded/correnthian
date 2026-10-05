import type { ChainId } from './asset.js';
/**
 * Account model.
 *
 * Two orthogonal things share the word "account" and confusing them is a
 * security bug:
 *
 *  1. The Correnthian Account - server-side profile, devices, preferences,
 *     notifications. NEVER holds key material.
 *  2. The Key Container - device-side. Holds the two account kinds below.
 *
 * Compromising a Correnthian Account must not yield funds.
 */
export type AccountKind = 
/** ERC-4337 smart account: passkey signer, guardians, session keys, gas sponsorship. */
'smart'
/** BIP-39 seed-derived accounts. Required for Bitcoin and Solana. */
 | 'seed';
export interface SmartAccountDescriptor {
    readonly kind: 'smart';
    readonly chainId: number;
    /** Deterministic via CREATE2; deterministic across wallets for the same owner. */
    readonly address: `0x${string}`;
    /** false until the account has been deployed on-chain. */
    readonly deployed: boolean;
    /** Guardian addresses able to restore access if the passkey is lost. */
    readonly guardianCount: number;
}
export interface SeedAccountDescriptor {
    readonly kind: 'seed';
    readonly chainId: ChainId;
    readonly address: string;
    readonly derivationPath: string;
}
export type AccountDescriptor = SmartAccountDescriptor | SeedAccountDescriptor;
/** Server-side. Knows nothing about keys. */
export interface CorrenthianAccount {
    readonly userId: string;
    readonly email: string;
    readonly displayName: string | null;
    readonly jurisdictions: readonly string[];
    readonly createdAt: string;
}
export interface DeviceRegistration {
    readonly deviceId: string;
    readonly platform: 'ios' | 'android' | 'web';
    readonly label: string;
    readonly lastSeenAt: string;
}
//# sourceMappingURL=account.d.ts.map