import { z } from 'zod';

export const listAllDevicesSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']).optional(),
  /** Matched against the owning account's email. */
  search: z.string().max(200).optional(),
  includeRevoked: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export type ListAllDevicesDto = z.infer<typeof listAllDevicesSchema>;
