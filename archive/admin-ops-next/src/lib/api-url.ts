const API_URL = process.env.API_URL ?? 'http://localhost:3000';

/**
 * Versioned API URL. Every console call goes through this so no page can
 * drift back onto the unversioned alias (removed 2026-12-01). Idempotent:
 * a path that already carries the prefix passes through, so callers never
 * have to know which form they hold.
 *
 * Pure and framework-free, kept out of `api-server` (which is `server-only`
 * and therefore untestable) so this mapping carries its own spec.
 */
export function apiUrl(path: string): string {
  const base = API_URL.replace(/\/+$/, '');
  const versioned = path.startsWith('/api/v1/')
    ? path
    : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  return `${base}${versioned}`;
}
