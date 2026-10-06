import { SetMetadata } from '@nestjs/common';
import { DEFAULT_TTL_MS } from './idempotency-key.js';

export const IDEMPOTENCY_METADATA_KEY = 'correnthian:idempotency';

export interface IdempotencyOptions {
  /**
   * Reject requests that arrive without a key instead of executing them.
   *
   * Off by default because §61 says financial POSTs should *support* the
   * header, and requiring it today would reject every client that has not been
   * updated yet — which reintroduces exactly the outage versioning was meant to
   * prevent. It is a one-word change per route once the admin and mobile both
   * send keys, and no client change after that.
   */
  required?: boolean;
  /** How long the key stays replayable. 24 hours. */
  ttlMs?: number;
}

/**
 * Mark a route as idempotent.
 *
 * Applied to the three operations that either move money or create a financial
 * commitment: quoting a swap, requesting physical redemption, and quoting a
 * fiat purchase. Applied by decorator rather than by a URL list so that a new
 * financial endpoint is visibly *not* covered until someone adds it, instead of
 * being covered by accident or omitted by accident.
 */
export const Idempotent = (options: IdempotencyOptions = {}) =>
  SetMetadata(IDEMPOTENCY_METADATA_KEY, { ttlMs: DEFAULT_TTL_MS, ...options });