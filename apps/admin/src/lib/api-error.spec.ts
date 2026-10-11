import { describe, expect, it } from 'vitest';
import { describeApiError } from './api-error.js';

describe('describeApiError', () => {
  it('appends the first validation issue path and message', () => {
    expect(describeApiError(
      { error: { message: 'Request validation failed', code: 'validation_failed', detail: [{ path: 'state', message: 'Invalid option' }] } },
      422,
    )).toBe('Request validation failed: state — Invalid option');
  });

  it('ignores malformed detail and falls back to the message', () => {
    expect(describeApiError({ error: { message: 'Request validation failed', code: 'validation_failed', detail: [{ nope: 1 }] } }, 422)).toBe('Request validation failed');
    expect(describeApiError({ error: { message: 'Nope' } }, 400)).toBe('Nope');
    expect(describeApiError(null, 503)).toBe('Request failed (503)');
  });

  it('never echoes values, only path and message', () => {
    const msg = describeApiError({
      error: { message: 'Request validation failed', code: 'x', detail: [{ path: 'a', message: 'm', value: 'SECRET' }] },
    }, 422);
    expect(msg).not.toContain('SECRET');
  });
});
