import { z } from 'zod';

export const listUsersSchema = z.object({
  role: z.enum(['user', 'support', 'compliance', 'admin', 'owner']).optional(),
  kycStatus: z.enum(['not_started', 'pending', 'approved', 'rejected', 'expired']).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export type ListUsersDto = z.infer<typeof listUsersSchema>;
