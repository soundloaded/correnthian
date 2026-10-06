import { z } from 'zod';

/**
 * The audit list.
 *
 * `limit` is capped here rather than trusted. The trail is append-only and
 * grows forever, so an uncapped page on a table with no deletions is a
 * slow query that stays slow.
 */
export const listAuditSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().max(80).optional(),
  outcome: z.enum(['success', 'failure', 'denied']).optional(),
});

export type ListAuditDto = z.infer<typeof listAuditSchema>;