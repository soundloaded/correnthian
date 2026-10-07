import { createHash } from 'node:crypto';

/**
 * The on-disk identity of a session token.
 *
 * `Session.tokenHash` is indexed and unique, and it is what
 * `AuthService.resolveSession` looks a token up by. Exposing it means the
 * rate limiter can key on exactly the value the database already stores,
 * instead of inventing a second hash of the same secret and hoping the two
 * never drift.
 *
 * One-way, so a Redis dump does not hand out live sessions: `sha256` over a
 * 32-byte random token has no useful inversion, and the value is already
 * persisted in Postgres today.
 */
export function hashSessionToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
