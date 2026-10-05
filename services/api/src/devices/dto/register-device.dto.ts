import { z } from 'zod';

export const registerDeviceSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  label: z.string().min(1).max(120),
  /** Public key of a passkey signer. Never a private key. */
  publicKey: z.string().max(512).nullable().default(null),
  pushToken: z.string().max(512).nullable().default(null),
});

export type RegisterDeviceDto = z.infer<typeof registerDeviceSchema>;
