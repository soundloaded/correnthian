import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('A valid email is required').max(320),
  password: z.string().min(12, 'Use at least 12 characters').max(200),
});

export const loginSchema = z.object({
  email: z.string().email().max(320),
  // No minimum here: validating strength on login would leak policy and
  // break existing users. Strength is enforced at registration only.
  password: z.string().min(1).max(200),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
