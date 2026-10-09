/**
 * Secret redaction - SEC-004.
 *
 * The goal is that a developer cannot accidentally ship a seed phrase into a
 * log, an analytics event, a crash report or an API request. The practical
 * version of that goal: nothing secret ever becomes an ordinary string.
 */

/**
 * Endpoints, including their query string.
 *
 * Not key material, and still withheld: an RPC URL is a metered quota
 * (`BlockchainService` never returns one), and provider errors arrive
 * wearing theirs — viem's standard failure body contains `URL: http://…`.
 * The whole URL goes, query string included, because credentials ride in
 * query parameters at least as often as in headers.
 */
const URL = /\b(?:https?:\/\/|wss?:\/\/)[^\s"'<>\]]+/gi;

const SEED_PHRASE = /\b(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b/gi;
const HEX_KEY = /\b(?:0x)?[0-9a-f]{64}\b/gi;
const BECH32 = /\b(?:bc1[a-z0-9]{25,62}|0x[a-z0-9]{40})\b/gi;

export type Redacted = string;

/** Replace anything that looks like key material with a marker. */
export function redact(input: string): Redacted {
  return input
    .replace(URL, '[REDACTED:URL]')
    .replace(SEED_PHRASE, '[REDACTED:SEED_PHRASE]')
    .replace(HEX_KEY, '[REDACTED:HEX_KEY]')
    .replace(BECH32, (m) => (m.startsWith('bc1') ? '[REDACTED:BTC_ADDRESS]' : m));
}

/** Deep-redact a structure before it is logged. */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redact(value) as unknown as T;
  if (Array.isArray(value)) return value.map(redactDeep) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = /seed|mnemonic|privatekey|secret|password|passphrase/i.test(k)
        ? '[REDACTED]'
        : redactDeep(v);
    }
    return out as T;
  }
  return value;
}

export const log = {
  info: (scope: string, data?: unknown) => console.info(`[${scope}]`, redactDeep(data)),
  warn: (scope: string, data?: unknown) => console.warn(`[${scope}]`, redactDeep(data)),
  error: (scope: string, data?: unknown) => console.error(`[${scope}]`, redactDeep(data)),
};
