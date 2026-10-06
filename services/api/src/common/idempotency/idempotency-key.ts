import { createHash } from 'node:crypto';
import { AppError } from '../errors.js';

/**
 * Idempotency key handling.
 *
 * Two rules govern everything here:
 *
 * 1. The key is never logged, never echoed and never persisted in a form it
 *    can be recovered from. It is an opaque client-supplied string; a client
 *    that puts something sensitive in it has to be able to trust us not to
 *    store it. What operators get instead is a short digest, which is enough
 *    to correlate two requests in a log and useless for anything else.
 *
 * 2. The fingerprint has to be stable under key ordering. A client that
 *    serialises `{a,b}` once and `{b,a}` the next time has sent the same
 *    request, and failing it as a conflict would teach users that retrying is
 *    dangerous — the exact habit this feature exists to make safe.
 */

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/** Domain-separated so a digest here can never collide with another hash here. */
const DIGEST_NAMESPACE = 'correnthian/idempotency/v1';

export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Long enough to outlast a slow provider call, short enough to bound a stuck claim. */
export const DEFAULT_LEASE_MS = 30_000;

/** How long a duplicate waits for the in-flight original before giving up. */
export const DUPLICATE_WAIT_MS = 5_000;

export const POLL_INTERVAL_MS = 25;

/**
 * Printable ASCII, no spaces.
 *
 * Deliberately stricter than "any string": the value ends up in logs, headers
 * and comparisons, and a header carrying a newline is a header injection.
 */
const KEY_SHAPE = /^[\x21-\x7E]{1,255}$/;

/**
 * Accept and normalise the header value.
 *
 * Express hands over a string or an array of strings for a repeated header. An
 * array is ambiguous — which one is the key? — so it is rejected rather than
 * guessed at.
 */
export function normaliseKey(raw: string | string[] | undefined): string | null {
  if (raw === undefined) return null;
  if (Array.isArray(raw)) {
    throw AppError.badRequest(
      `${IDEMPOTENCY_KEY_HEADER} was sent more than once; exactly one key per request`,
    );
  }
  const key = raw.trim();
  if (!KEY_SHAPE.test(key)) {
    // The offending value is deliberately not echoed. A key is exactly the kind
    // of string that ends up in a log line, and the client that sent it does
    // not need it back to fix its bug.
    throw AppError.badRequest(
      `${IDEMPOTENCY_KEY_HEADER} must be 1-255 printable ASCII characters with no spaces`,
    );
  }
  return key;
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * A short, non-reversible label for a key, safe to put in a log line.
 *
 * Twelve hex characters is 48 bits — enough to tell two keys apart in a log,
 * and not enough to be used to reconstruct either.
 */
export function keyFingerprint(scope: string, key: string): string {
  return keyHash(scope, key).slice(0, 12);
}

/**
 * The stored identity of a key, scoped to its actor.
 *
 * Scoping matters: two accounts that happen to generate the same UUID must not
 * share a claim, or account B's request would replay account A's purchase
 * response. Including the actor in the digest is what makes the key unique per
 * caller without a second unique index.
 */
export function keyHash(scope: string, key: string): string {
  return sha256(`${DIGEST_NAMESPACE}/key\n${scope}\n${key}`);
}

/**
 * Deterministic JSON: object keys sorted, `undefined` dropped.
 *
 * Not a general-purpose canonicalisation — just enough that two encodings of
 * the same request hash the same.
 */
function canonical(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

/**
 * Method + path + body hash.
 *
 * The path is the routed path (`baseUrl + path`), not the raw URL: it is
 * identical whether the client arrived at `/api/v1/swaps/quotes` or through the
 * transitional unversioned alias, so moving a client onto the versioned prefix
 * does not invalidate keys it already holds.
 */
export function requestFingerprint(method: string, path: string, body: unknown): string {
  return sha256(`${DIGEST_NAMESPACE}/request\n${method.toUpperCase()}\n${path}\n${canonical(body)}`);
}