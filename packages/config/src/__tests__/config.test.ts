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

  it('separates the sign-in ceiling from the general one', () => {
    // DEF-004: both were validated here while the guard hardcoded its own
    // values, so an operator could set them all day and change nothing.
    const r = parseConfig(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.rateLimit).toEqual({
      windowSeconds: 60,
      maxRequests: 120,
      authMaxRequests: 10,
    });
  });

  it('reads RATE_LIMIT_AUTH_MAX_REQUESTS', () => {
    const r = parseConfig({ ...valid, RATE_LIMIT_AUTH_MAX_REQUESTS: '3' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.rateLimit.authMaxRequests).toBe(3);
  });

  it('refuses a zero sign-in ceiling instead of disabling the limiter', () => {
    // A coerced `0` would pass `min(1)` as a number but admit everything, and
    // `.env` files are full of `=0` meaning "off".
    const r = parseConfig({ ...valid, RATE_LIMIT_AUTH_MAX_REQUESTS: '0' });
    expect(r.ok).toBe(false);
  });

  it('reads the window separately from either ceiling', () => {
    const r = parseConfig({ ...valid, RATE_LIMIT_WINDOW_SECONDS: '5' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.rateLimit.windowSeconds).toBe(5);
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
