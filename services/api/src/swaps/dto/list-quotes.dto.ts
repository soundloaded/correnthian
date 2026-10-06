import { z } from 'zod';

/** Mirrors the Prisma `QuoteState` enum. */
export const quoteStateSchema = z.enum([
  'quoted',
  'awaiting_payment',
  'broadcast',
  'settled',
  'failed',
  'expired',
]);

/** Mirrors the Prisma `RailKind` enum. */
export const railKindSchema = z.enum(['provider', 'dex', 'cex', 'otc']);

/**
 * The operator's quote table.
 *
 * `limit` is capped rather than trusted: this route is `support`-reachable and
 * an unbounded page size on a table that only grows is a cheap way for one
 * console load to take the database down.
 */
export const listQuotesSchema = z.object({
  state: quoteStateSchema.optional(),
  railKind: railKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  /** Opaque. Encodes the keyset position — see `SwapsService.listAll`. */
  cursor: z.string().max(400).optional(),
});

export type ListQuotesDto = z.infer<typeof listQuotesSchema>;