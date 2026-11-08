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

  it('leaves Persona unconfigured when no Persona variables are set', () => {
    // No vendor is contracted in every environment. Absent credentials must
    // parse to an explicitly unconfigured provider — never to a half-filled
    // one — so the gate can fail closed on "no screening available" instead
    // of failing open on a client that cannot authenticate.
    const r = parseConfig(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.persona.apiKey).toBeUndefined();
      expect(r.config.persona.webhookSecret).toBeUndefined();
      expect(r.config.persona.configured).toBe(false);
    }
  });

  it('reads Persona credentials when they are set', () => {
    const r = parseConfig({
      ...valid,
      PERSONA_API_KEY: 'persona_key_123',
      PERSONA_WEBHOOK_SECRET: 'whsec_456',
      PERSONA_TEMPLATE_ID: 'itmpl_123',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.persona.apiKey).toBe('persona_key_123');
      expect(r.config.persona.webhookSecret).toBe('whsec_456');
      expect(r.config.persona.configured).toBe(true);
    }
  });

  it('refuses a half-configured Persona rather than running impaired', () => {
    // An API key with no webhook secret would verify inquiries but accept
    // unsigned webhooks; a secret with no key is the mirror. Either half
    // alone is worse than neither, because the provider would look
    // configured while one direction was unauthenticated.
    const r = parseConfig({ ...valid, PERSONA_API_KEY: 'persona_key_123' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join(' ')).toContain('PERSONA_WEBHOOK_SECRET');
  });

  it('defaults the Persona base URL to the documented API host', () => {
    // api.withpersona.com, not withpersona.com — the docs put the API on
    // its own host, and guessing the host wrong fails every call at once.
    const r = parseConfig(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.persona.baseUrl).toBe('https://api.withpersona.com/api/v1');
  });

  it('leaves observability unconfigured when no DSN or endpoint is set', () => {
    // SENTRY_DSN and OTEL_EXPORTER_OTLP_ENDPOINT were read by nothing for
    // the whole project history. Absent means explicitly off — never a
    // half-initialised SDK phoning nowhere.
    const r = parseConfig(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.observability.sentryDsn).toBeUndefined();
      expect(r.config.observability.otelEndpoint).toBeUndefined();
      expect(r.config.observability.enabled).toBe(false);
    }
  });

  it('reads observability endpoints independently of each other', () => {
    // Either may be set alone: error reporting without tracing and tracing
    // without error reporting are both coherent deployments. Coupling them
    // would force an operator to buy both to get either.
    const sentryOnly = parseConfig({ ...valid, SENTRY_DSN: 'https://x@sentry.io/1' });
    expect(sentryOnly.ok).toBe(true);
    if (sentryOnly.ok) {
      expect(sentryOnly.config.observability.sentryDsn).toBe('https://x@sentry.io/1');
      expect(sentryOnly.config.observability.otelEndpoint).toBeUndefined();
      expect(sentryOnly.config.observability.enabled).toBe(true);
    }
    const otelOnly = parseConfig({ ...valid, OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318' });
    expect(otelOnly.ok).toBe(true);
    if (otelOnly.ok) {
      expect(otelOnly.config.observability.otelEndpoint).toBe('http://collector:4318');
      expect(otelOnly.config.observability.sentryDsn).toBeUndefined();
    }
  });

  it('reads the inquiry template id when set, and stays unconfigured without it', () => {
    // Inquiry creation requires a template; without one the adapter cannot
    // open inquiries, so configured-ness includes it. Credentials alone
    // with no template would look ready and fail at the first real user.
    const credsOnly = parseConfig({
      ...valid,
      PERSONA_API_KEY: 'persona_key_123',
      PERSONA_WEBHOOK_SECRET: 'whsec_456',
    });
    expect(credsOnly.ok).toBe(true);
    if (credsOnly.ok) {
      expect(credsOnly.config.persona.templateId).toBeUndefined();
      expect(credsOnly.config.persona.configured).toBe(false);
    }
    const full = parseConfig({
      ...valid,
      PERSONA_API_KEY: 'persona_key_123',
      PERSONA_WEBHOOK_SECRET: 'whsec_456',
      PERSONA_TEMPLATE_ID: 'itmpl_123',
    });
    expect(full.ok).toBe(true);
    if (full.ok) {
      expect(full.config.persona.templateId).toBe('itmpl_123');
      expect(full.config.persona.configured).toBe(true);
    }
  });

  it('defaults notifications to the console sink, which never claims to send', () => {
    const r = parseConfig(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.notifications.provider).toBe('console');
      expect(r.config.notifications.configured).toBe(true);
      expect(r.config.notifications.from).toBeUndefined();
    }
  });

  it('rejects a malformed Chainlink feed and leaves an absent feed unset', () => {
    // A feed address is a proxy contract. Anything else must fail at boot,
    // and leaving the variable out must stay "no feed", not a default proxy.
    const malformed = parseConfig({ ...valid, CHAINLINK_XAU_USD_FEED: '0xnot-an-address' });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.issues.join(' ')).toContain('CHAINLINK_XAU_USD_FEED');

    const absent = parseConfig(valid);
    expect(absent.ok).toBe(true);
    if (absent.ok) expect(absent.config.chainlink.xauUsd).toBeUndefined();

    const xau = `0x${'Ab'.repeat(20)}`;
    const xag = `0x${'cd'.repeat(20)}`;
    const present = parseConfig({
      ...valid,
      CHAINLINK_XAU_USD_FEED: xau,
      CHAINLINK_XAG_USD_FEED: xag,
    });
    expect(present.ok).toBe(true);
    if (present.ok) {
      expect(present.config.chainlink.xauUsd).toBe(xau);
      expect(present.config.chainlink.xagUsd).toBe(xag);
    }

    const badSilver = parseConfig({ ...valid, CHAINLINK_XAG_USD_FEED: '0x1234' });
    expect(badSilver.ok).toBe(false);
    if (!badSilver.ok) expect(badSilver.issues.join(' ')).toContain('CHAINLINK_XAG_USD_FEED');
  });

  it('refuses an smtp transport that cannot send', () => {
    // A transport that boots unconfigured discovers it at 3am, from a
    // user's complaint. Refuse at boot instead.
    const hostOnly = parseConfig({
      ...valid,
      NOTIFICATIONS_PROVIDER: 'smtp',
      MAIL_HOST: 'smtp.example.com',
    });
    expect(hostOnly.ok).toBe(false);
    if (!hostOnly.ok) {
      expect(hostOnly.issues.join(' ')).toContain('MAIL_FROM');
    }
    const full = parseConfig({
      ...valid,
      NOTIFICATIONS_PROVIDER: 'smtp',
      MAIL_FROM: 'no-reply@example.com',
      MAIL_HOST: 'smtp.example.com',
    });
    expect(full.ok).toBe(true);
    if (full.ok) {
      expect(full.config.notifications.host).toBe('smtp.example.com');
      expect(full.config.notifications.configured).toBe(true);
    }
  });
});
