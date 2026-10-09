import { z } from 'zod';
import { TX_STATES } from '../transaction-lifecycle.js';

/** Mirrors the Prisma `TxState` enum. Kept in one place so it cannot drift. */
export const txStateSchema = z.enum(TX_STATES);

export const txDirectionSchema = z.enum(['in', 'out', 'internal']);

/**
 * A positive decimal string, never a number.
 *
 * Base-unit amounts reach 10^27 and a JS number cannot hold them. Every other
 * service in this codebase takes the string form for the same reason.
 */
const positiveDecimal = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string');

/** Hashes differ per family; 0x + 64 hex is the EVM case, the narrowest. */
const txHash = z.string().min(16).max(200);

export const createTransactionSchema = z.object({
  /** The wallet value leaves from, or arrives at. */
  walletId: z.string().min(1),
  /** Derived asset identity, e.g. `1:0xabc…:cuid`. */
  assetId: z.string().min(1),
  direction: txDirectionSchema.default('out'),

  amountRaw: positiveDecimal,
  amountUsd: positiveDecimal.optional(),

  /**
   * Public address. Required for an outbound movement — a send with no
   * destination cannot be acted on, and leaving it nullable would let a row
   * exist that no one can ever complete.
   */
  destination: z.string().min(1).max(200).optional(),

  feeRaw: positiveDecimal.optional(),
  feeUsd: positiveDecimal.optional(),

  /** Provider slug. Only for a fill a provider actually settled. */
  providerSlug: z.string().min(1).max(80).optional(),

  /** Raise the family default for a large value. Never lower it. */
  requiredConfirmations: z.coerce.number().int().min(1).max(1000).optional(),

  /** How long an unsigned intent stays actionable. */
  expiresInMinutes: z.coerce.number().int().min(1).max(10080).optional(),

  /** Chain data. Redacted before it is stored, and never a signed payload. */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;

/**
 * A state change.
 *
 * `to` is the whole point of the route; the rest is the evidence that belongs
 * with it. A broadcast without a hash and a failure without a code would both
 * be states nothing downstream could act on.
 */
export const transitionSchema = z.object({
  to: txStateSchema,

  /** Required to reach `broadcast`. */
  txHash: txHash.optional(),

  errorCode: z.string().min(1).max(80).optional(),
  errorMessage: z.string().min(1).max(500).optional(),

  amountUsd: positiveDecimal.optional(),
  feeRaw: positiveDecimal.optional(),
  feeUsd: positiveDecimal.optional(),

  metadata: z.record(z.string(), z.unknown()).optional(),

  /** Mandatory for the transitions that move a settled record backwards. */
  reason: z.string().min(1).max(500).optional(),
});

export type TransitionDto = z.infer<typeof transitionSchema>;

/**
 * What a node reports about a transaction.
 *
 * This is the observation path and it is deliberately separate from
 * `transition`: depth and block height are facts read off a chain, not claims
 * made by an operator, and conflating the two is how a record ends up moved by
 * someone who only believed they had.
 */
export const observationSchema = z.object({
  txHash: txHash,
  confirmations: z.coerce.number().int().min(0).max(1_000_000),
  /** BigInt at the storage layer, so a decimal string on the wire. */
  blockNumber: z.string().regex(/^\d+$/, 'Must be a whole number as a string').optional(),
  blockTime: z.string().datetime().optional(),

  outcome: z.enum(['seen', 'dropped', 'reverted', 'replaced']).default('seen'),

  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Required when a human forces a reorg-driven demotion. */
  reason: z.string().min(1).max(500).optional(),
});

export type ObservationDto = z.infer<typeof observationSchema>;

/**
 * A payload the account holder's device already signed.
 *
 * Hex and nothing else — RLP is validated by decoding it, not by this shape:
 * `decodeSignedTransaction` is where "bytes that are a transaction" is
 * decided, because only there does the rest of the platform's chain
 * knowledge live.
 */
export const broadcastSchema = z.object({
  signed: z
    .string()
    .regex(/^0x[0-9a-fA-F]+$/, 'A signed payload is hex-prefixed'),
});

export type BroadcastDto = z.infer<typeof broadcastSchema>;