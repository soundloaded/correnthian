import { describe, expect, it } from 'vitest';
import { errorSchema, idempotencyConflictSchema } from './schemas.js';

describe('error envelopes', () => {
  it('the shared envelope requires code, message, path and timestamp', () => {
    const base = { error: { code: 'not_found', message: 'nope' }, path: '/x', timestamp: new Date().toISOString() };
    expect(errorSchema.safeParse(base).success).toBe(true);
    expect(errorSchema.safeParse({ ...base, error: { code: 'not_found' } }).success).toBe(false);
  });

  it('idempotency conflicts name a reason from the closed set', () => {
    expect(idempotencyConflictSchema.safeParse({
      error: { code: 'conflict', message: 'm', detail: { reason: 'in_progress' } },
      path: '/x', timestamp: new Date().toISOString(),
    }).success).toBe(true);
    expect(idempotencyConflictSchema.safeParse({
      error: { code: 'conflict', message: 'm', detail: { reason: 'whatever' } },
      path: '/x', timestamp: new Date().toISOString(),
    }).success).toBe(false);
  });
});
