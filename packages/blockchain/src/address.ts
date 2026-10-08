import { getAddress, keccak256, toHex } from 'viem';

/**
 * Address validation.
 *
 * A mistyped address is not a user error to be shrugged off — it is a
 * permanent, irreversible loss of funds. Every address that enters the system
 * is validated here, before it is stored or displayed, rather than at the
 * point of signing where it is too late to be useful.
 *
 * EVM addresses are checked against EIP-55. That check catches the majority
 * of typos: if a user pastes a mixed-case address with one character
 * transposed, the checksum will not match and the address is rejected, instead
 * of being silently sent to a valid-looking address nobody controls.
 */

export type AddressFamily = 'evm' | 'bitcoin' | 'solana';

export interface AddressValidation {
  valid: boolean;
  family: AddressFamily | null;
  /** Present only when `valid` is false, and safe to show to a user. */
  reason: string | null;
  /** Normalised form — EVM lower-cased for storage, others as supplied. */
  normalised: string | null;
}

const ok = (family: AddressFamily, normalised: string): AddressValidation =>
  ({ valid: true, family, reason: null, normalised });

const bad = (family: AddressFamily | null, reason: string): AddressValidation =>
  ({ valid: false, family, reason, normalised: null });

// --- EVM ------------------------------------------------------------------

/**
 * EIP-55, verified against keccak-256 — Ethereum's digest, not NIST `sha3-256`.
 *
 * The two are different algorithms producing different hashes, so Node's
 * `crypto` cannot stand in for the one EIP-55 is defined against: substituting
 * it would accept mistyped addresses, which is the exact failure this module
 * exists to prevent. `viem`'s `keccak256` supplies the real one.
 *
 * The rule is EIP-55's own:
 *   - no mixed case (all lower, or all upper) — there is no checksum to
 *     evaluate, so the address is accepted and normalised to lowercase;
 *   - mixed case — reconstructed from the hash and compared. A mismatch is
 *     rejected, because a transposed digit still reads as valid hex.
 *
 * This is exercised against the canonical vectors in
 * `__tests__/address.test.ts`, including a transposition that keeps valid hex.
 */

export function validateEvmAddress(address: string): AddressValidation {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return bad('evm', 'An EVM address is 0x followed by exactly 40 hex characters');
  }

  const body = address.slice(2);
  const isLower = body === body.toLowerCase();
  const isUpper = body === body.toUpperCase();

  if (isLower || isUpper) return ok('evm', `0x${body.toLowerCase()}`);

  const expected = toChecksum(body);
  return expected === body
    ? ok('evm', address)
    : bad('evm', 'EIP-55 checksum mismatch — the address is very likely mistyped');
}

/**
 * keccak-256, the digest EIP-55 is defined against — not NIST sha3-256, which
 * is a different algorithm and produces a different hash.
 *
 * viem applies the correct one. An earlier version of this file reconstructed
 * the hash from a checksummed address's casing, which is circular: it agrees
 * with whatever it is fed. Verification has to come from the hash itself.
 */
function keccak256Hex(input: string): string {
  return keccak256(toHex(input)).slice(2);
}

/** Uppercase the hex digits whose keccak nibble is >= 8 — EIP-55's rule. */
function toChecksum(body: string): string {
  const lower = body.toLowerCase();
  const hash = keccak256Hex(lower);
  let out = '';
  for (let i = 0; i < lower.length; i++) {
    const nibble = hash[i] ?? '0';
    out += parseInt(nibble, 16) >= 8 ? lower[i]!.toUpperCase() : lower[i]!;
  }
  return out;
}

// --- Bitcoin --------------------------------------------------------------

const BECH32 = /^bc1[02-9ac-hj-np-z]{11,71}$/;
const BASE58 = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

export function validateBitcoinAddress(address: string): AddressValidation {
  if (BECH32.test(address)) return ok('bitcoin', address);
  if (BASE58.test(address)) return ok('bitcoin', address);
  return bad('bitcoin', 'Not a recognised Bitcoin address format (bech32 or base58)');
}

// --- Solana ---------------------------------------------------------------

const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validateSolanaAddress(address: string): AddressValidation {
  // Format-only for now. A base58 decode to confirm the exact 32-byte
  // ed25519 public key length belongs here too; see the CHECKSUM_AVAILABLE
  // note above for why nothing is faked in the meantime.
  if (!SOLANA.test(address)) return bad('solana', 'Not a recognised Solana address');
  return ok('solana', address);
}

// --- Dispatch -------------------------------------------------------------

/**
 * Validate against a chain family. Unknown families are rejected rather than
 * passed through: an address we cannot check is an address we cannot trust.
 */
export function validateAddress(address: string, family: AddressFamily): AddressValidation {
  const trimmed = address.trim();
  if (!trimmed) return bad(null, 'Address is empty');

  switch (family) {
    case 'evm': return validateEvmAddress(trimmed);
    case 'bitcoin': return validateBitcoinAddress(trimmed);
    case 'solana': return validateSolanaAddress(trimmed);
    default: return bad(null, `Unsupported address family: ${String(family)}`);
  }
}

/** Display form: 0xAbCd…1234. Never use this in a transaction. */
export function formatAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}
