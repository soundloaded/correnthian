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
  static conflict(m: string) { return new AppError('conflict', m); }
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
