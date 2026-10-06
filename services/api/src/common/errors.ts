/**
 * Error taxonomy.
 *
 * Every error crossing the HTTP boundary becomes one of these. Internal
 * messages are never forwarded to a client — a stack trace or a provider
 * error string can leak configuration and topology.
 */

export type ErrorCode =
  | 'bad_request'
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'jurisdiction_blocked'
  | 'provider_unavailable'
  | 'internal';

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  jurisdiction_blocked: 451,
  provider_unavailable: 503,
  internal: 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    /** Safe to send to the client. Never put internal detail here. */
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  get status(): number {
    return STATUS[this.code];
  }

  static badRequest(m: string, d?: unknown) { return new AppError('bad_request', m, d); }
  static unauthorized(m = 'Authentication required') { return new AppError('unauthorized', m); }
  static forbidden(m = 'Not permitted') { return new AppError('forbidden', m); }
  static notFound(m = 'Not found') { return new AppError('not_found', m); }
  static conflict(m: string, d?: unknown) { return new AppError('conflict', m, d); }
  static rateLimited(m = 'Too many requests') { return new AppError('rate_limited', m); }
  static jurisdictionBlocked(m: string, d?: unknown) { return new AppError('jurisdiction_blocked', m, d); }
  static providerUnavailable(m = 'Provider unavailable') { return new AppError('provider_unavailable', m); }
}

export class ValidationError extends AppError {
  constructor(readonly issues: Array<{ path: string; message: string }>) {
    super('validation_failed', 'Request validation failed', issues);
    this.name = 'ValidationError';
  }
}

/**
 * The one builder for the wire error shape.
 *
 * Three places produce this envelope — the exception filter, the API-version
 * middleware and the not-found handler — and the middle two run outside Nest's
 * exception zone, so they cannot rely on the filter to shape their output.
 * Two hand-written literals would drift the first time a field was added, and
 * the drift would only show up in a client that parses `error.code`.
 */
export interface ErrorEnvelope {
  error: { code: string; message: string; detail?: unknown };
  path: string;
  timestamp: string;
}

export function errorEnvelope(params: {
  code: string;
  message: string;
  detail?: unknown;
  path: string;
  timestamp?: string;
}): ErrorEnvelope {
  return {
    error: {
      code: params.code,
      message: params.message,
      detail: params.detail,
    },
    path: params.path,
    timestamp: params.timestamp ?? new Date().toISOString(),
  };
}

/** The path without its query string, for messages that are read aloud. */
export function pathOnly(url: string): string {
  const cut = url.indexOf('?');
  return cut === -1 ? url : url.slice(0, cut);
}
