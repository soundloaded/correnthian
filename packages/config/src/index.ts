import { z } from 'zod';

/**
 * Runtime configuration, validated once at boot.
 *
 * Two rules this module exists to enforce:
 *
 *  1. Fail fast. A missing or malformed variable crashes the process at
 *     startup rather than surfacing as a confusing runtime error later.
 *  2. Never accept key material. There is deliberately no schema field for a
 *     seed phrase, private key or signing share. If Correnthian's servers ever
 *     hold such a value, this module should refuse to load.
 */

const splitTrim = (s: string): string[] =>
  s.split(',').map((v) => v.trim()).filter(Boolean);

/**
 * `.default()` is applied to the *input* here, before the transform. Putting
 * it after the transform would default the post-parse type, which is a
 * different thing entirely and does not typecheck in Zod 4.
 */
const csv = (def: string) => z.string().default(def).transform(splitTrim);
const csvOptional = () => z.string().optional().transform((v) => (v ? splitTrim(v) : undefined));

const port = z.coerce.number().int().min(1).max(65535);

/**
 * Error messages must name the environment variable, not the internal path.
 * An operator debugging a boot failure greps their shell for `DATABASE_URL`;
 * `database.url` sends them looking for a config file that does not exist.
 */
const required = (name: string, hint: string) =>
  z.string({ error: `${name} is required${hint ? ` (${hint})` : ''}` });

const toBool = (v: string): boolean => v === 'true' || v === '1';

const boolish = (def: 'true' | 'false') =>
  z.enum(['true', 'false', '1', '0']).default(def).transform(toBool);
const boolishOptional = () =>
  z.enum(['true', 'false', '1', '0']).optional().transform((v) => (v === undefined ? undefined : toBool(v)));

const schema = z.object({
  env: z.enum(['development', 'test', 'production']).default('development'),

  http: z.object({
    port: port.default(3000),
    host: z.string().default('0.0.0.0'),
    /** Comma-separated. Used for CORS and for the admin's allowed origins. */
    corsOrigins: csv('http://localhost:3001'),
    /** Set false only in local development behind no TLS terminator. */
    trustProxy: boolish('false'),
  }),

  database: z.object({
    url: required('DATABASE_URL', 'a postgres connection string'),
    /** Set in tests to avoid truncating a real database. */
    shadowDatabaseUrl: z.string().optional(),
  }),

  redis: z.object({
    url: required('REDIS_URL', 'a redis connection string'),
  }),

  auth: z.object({
    /** Argon2id parameters. Raising `memory` costs CPU per hash. */
    argon2Memory: z.coerce.number().int().min(19456).default(65536),
    argon2Time: z.coerce.number().int().min(1).default(3),
    argon2Parallelism: z.coerce.number().int().min(1).default(1),
    sessionTtlHours: z.coerce.number().int().min(1).default(720),
  }),

  log: z.object({
    level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    /** Pretty output is for humans in a terminal, never for production. */
    pretty: boolish('false'),
  }),

  persona: z
    .object({
      apiKey: z.string().min(1).optional(),
      webhookSecret: z.string().min(1).optional(),
      /** Inquiry creation requires a template; verified against the docs
       *  (create-an-inquiry: pass one of template-id /
       *  inquiry-template-id / inquiry-template-version-id). */
      templateId: z.string().min(1).optional(),
      /** Verified against the docs: the API lives on api.withpersona.com,
       *  not on withpersona.com. */
      baseUrl: z.string().default('https://api.withpersona.com/api/v1'),
    })
    .superRefine((v, ctx) => {
      // Half-configured is worse than unconfigured: a key with no secret
      // would verify inquiries but accept unsigned webhooks, and the
      // provider would look configured while one direction ran
      // unauthenticated. Refuse to boot impaired instead.
      if ((v.apiKey === undefined) !== (v.webhookSecret === undefined)) {
        ctx.addIssue({
          code: 'custom',
          message:
            'PERSONA_API_KEY and PERSONA_WEBHOOK_SECRET must be set together; refusing a half-configured Persona',
        });
      }
    })
    .transform((v) => ({
      ...v,
      // Credentials without a template can verify webhooks but cannot open
      // inquiries — half-capable, which reads as ready and fails at the
      // first real user. Configured means able to operate fully.
      configured: v.apiKey !== undefined && v.templateId !== undefined,
    })),

  rateLimit: z.object({
    windowSeconds: z.coerce.number().int().min(1).default(60),
    /** The general API budget. */
    maxRequests: z.coerce.number().int().min(1).default(120),
    /**
     * The sign-in budget, and it is deliberately not derived from
     * `maxRequests`. `/auth/*` exists to guess credentials, so its ceiling is
     * its own setting: raising the general budget for a bulk import must not
     * quietly open the same headroom to credential stuffing.
     *
     * This had no knob at all before — the guard hardcoded `10` — so the
     * constraint was invisible to an operator tuning `.env`.
     */
    authMaxRequests: z.coerce.number().int().min(1).default(10),
  }),
});

export type CorrenthianConfig = z.infer<typeof schema>;

export type ParseResult =
  | { ok: true; config: CorrenthianConfig }
  | { ok: false; issues: string[] };

/**
 * Parse from an explicit source. Taking the source as a parameter keeps this
 * testable and keeps `process.env` out of module scope, which makes the
 * validation path deterministic.
 */
export function parseConfig(source: NodeJS.ProcessEnv = process.env): ParseResult {
  const parsed = schema.safeParse({
    env: source['NODE_ENV'],
    http: {
      port: source['PORT'],
      host: source['HOST'],
      corsOrigins: source['CORS_ORIGINS'],
      trustProxy: source['TRUST_PROXY'],
    },
    database: {
      url: source['DATABASE_URL'],
      shadowDatabaseUrl: source['SHADOW_DATABASE_URL'],
    },
    redis: { url: source['REDIS_URL'] },
    auth: {
      argon2Memory: source['ARGON2_MEMORY'],
      argon2Time: source['ARGON2_TIME'],
      argon2Parallelism: source['ARGON2_PARALLELISM'],
      sessionTtlHours: source['SESSION_TTL_HOURS'],
    },
    log: { level: source['LOG_LEVEL'], pretty: source['LOG_PRETTY'] },
    persona: {
      apiKey: source['PERSONA_API_KEY'],
      webhookSecret: source['PERSONA_WEBHOOK_SECRET'],
      templateId: source['PERSONA_TEMPLATE_ID'],
      baseUrl: source['PERSONA_BASE_URL'],
    },
    rateLimit: {
      windowSeconds: source['RATE_LIMIT_WINDOW_SECONDS'],
      maxRequests: source['RATE_LIMIT_MAX_REQUESTS'],
      authMaxRequests: source['RATE_LIMIT_AUTH_MAX_REQUESTS'],
    },
  });

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
      ),
    };
  }
  return { ok: true, config: parsed.data };
}

/**
 * Parse or throw. Use at process startup; never inside a request handler.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): CorrenthianConfig {
  const result = parseConfig(source);
  if (!result.ok) {
    throw new Error(
      `Invalid Correnthian configuration:\n  - ${result.issues.join('\n  - ')}\n` +
        `Copy .env.example to .env.local and fill in the required values.`,
    );
  }
  return result.config;
}

export const configSchema = schema;
