/**
 * Human guidance for API failures. Only the path + message of the first
 * validation issue ever cross — values, stacks and bodies stay server-side.
 */
export function describeApiError(
  body: { error?: { message?: string; code?: string; detail?: unknown } } | null,
  status: number,
): string {
  const fallback = body?.error?.message ?? `Request failed (${status})`;
  const detail = body?.error?.detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { path?: unknown; message?: unknown };
    if (typeof first?.path === 'string' && typeof first?.message === 'string') {
      return `${fallback}: ${first.path} — ${first.message}`;
    }
  }
  return fallback;
}
