import { z } from 'zod';

/**
 * What the list may sort on. Closed, not free-text: an arbitrary column name
 * would reach Prisma's `orderBy` unvalidated, and a direction outside asc/desc
 * is a runtime throw. Email and creation time are the only orders an
 * operator needs — role/KYC/status group better as filters than as sorts.
 */
export const userSortSchema = z.enum(['createdAt', 'email']).default('createdAt');
export const userSortOrderSchema = z.enum(['asc', 'desc']).default('desc');

export const listUsersSchema = z.object({
  role: z.enum(['user', 'support', 'compliance', 'admin', 'owner']).optional(),
  kycStatus: z.enum(['not_started', 'pending', 'approved', 'rejected', 'expired']).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  search: z.string().max(200).optional(),
  sort: userSortSchema,
  order: userSortOrderSchema,
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export type ListUsersDto = z.infer<typeof listUsersSchema>;
