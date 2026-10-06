import { z } from 'zod';
import { txDirectionSchema, txStateSchema } from './create-transaction.dto.js';

/**
 * The operator's transaction table.
 *
 * Capped rather than trusted, for the same reason the quote list is: this
 * route is `support`-reachable and the table only ever grows.
 */
export const listTransactionsSchema = z.object({
  state: txStateSchema.optional(),
  direction: txDirectionSchema.optional(),
  chainId: z.string().max(64).optional(),
  walletId: z.string().max(64).optional(),
  userId: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  /** Opaque. Encodes the keyset position — see `TransactionsService.listAll`. */
  cursor: z.string().max(400).optional(),
});

export type ListTransactionsDto = z.infer<typeof listTransactionsSchema>;

/** A single account's own history. Never takes a `userId`. */
export const listMyTransactionsSchema = z.object({
  state: txStateSchema.optional(),
  direction: txDirectionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});