import { z } from 'zod';

/**
 * One-time link wire shapes — BE-203.
 *
 * The request side carries an address; the consume side carries the token
 * that arrived in the email. Neither carries a password, a session, or
 * anything else the flow does not need.
 */
export const requestLinkSchema = z.object({
  email: z.string().email('A valid email is required').max(320),
});

export const consumeLinkSchema = z.object({
  /** The raw token from the link. The database only ever held its digest. */
  token: z.string().min(10).max(400),
});

export const confirmResetSchema = z.object({
  token: z.string().min(10).max(400),
  /** The same floor as registration: a new password is a new password. */
  password: z.string().min(12, 'Use at least 12 characters').max(200),
});

export type RequestLinkDto = z.infer<typeof requestLinkSchema>;
export type ConsumeLinkDto = z.infer<typeof consumeLinkSchema>;
export type ConfirmResetDto = z.infer<typeof confirmResetSchema>;
