import { describe, expect, it } from 'vitest';
import { apiUrl } from './api-url';

describe('apiUrl', () => {
  it('prefixes console paths with the versioned base', () => {
    expect(apiUrl('/fees/rules')).toContain('/api/v1/fees/rules');
  });

  it('leaves already-versioned paths untouched', () => {
    const once = apiUrl('/fees/rules');
    expect(apiUrl('/api/v1/fees/rules')).toBe(once);
  });

  it('keeps query strings after the versioned path', () => {
    expect(apiUrl('/audit?limit=200')).toContain('/api/v1/audit?limit=200');
  });
});
