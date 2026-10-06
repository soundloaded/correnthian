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
  /**
   * Everything one HTTP request did. The `X-Request-Id` response header makes
   * this reachable from a support ticket without asking the reporter to know
   * anything about our internals.
   */
  requestId: z.string().max(128).optional(),
});

export type ListAuditDto = z.infer<typeof listAuditSchema>;