import { describe, expect, it } from 'vitest';
import { parseConfig, loadConfig } from '../index.js';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/correnthian',
  REDIS_URL: 'redis://localhost:6379',
};

describe('config parsing', () => {
  it('accepts a minimal valid environment', () => {
    const r = parseConfig(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.database.url).toContain('correnthian');
  });

  it('reports every missing required variable rather than the first', () => {
    const r = parseConfig({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.join(' ')).toContain('DATABASE_URL');
      expect(r.issues.join(' ')).toContain('REDIS_URL');
    }
  });

  it('rejects a non-numeric port instead of silently coercing', () => {
    const r = parseConfig({ ...valid, PORT: 'not-a-port' });
    expect(r.ok).toBe(false);
  });

  it('parses a comma-separated CORS list', () => {
    const r = parseConfig({ ...valid, CORS_ORIGINS: 'https://a.example, https://b.example' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.http.corsOrigins).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('enforces a floor on argon2 memory', () => {
    // 19 MiB is the argon2 minimum; anything lower is a security regression.
    const r = parseConfig({ ...valid, ARGON2_MEMORY: '1024' });
    expect(r.ok).toBe(false);
  });

  it('throws with actionable guidance when loaded and invalid', () => {
    expect(() => loadConfig({})).toThrow(/Copy \.env\.example/);
  });
});
