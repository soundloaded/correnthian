/**
 * The bearer token on a request, or `null`.
 *
 * Three places parsed this by hand — `SessionGuard`, `RateLimitGuard` and
 * `POST /auth/logout` — each with its own slightly different empty-string
 * handling. One definition, so a change to the header format cannot leave two
 * of the three reading a token the third does not.
 *
 * Returns `null` rather than `''` for "present but empty": callers test truth
 * either way, and a caller that starts doing `token.length` should not find a
 * distinction that does not exist.
 */
export function bearerToken(authorization: string | undefined | null): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}
