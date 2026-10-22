import { z } from 'zod';

/**
 * The system-settings registry.
 *
 * ## What a setting is
 *
 * A named value the platform's behaviour depends on: how long a transaction
 * intent stays actionable, how stale a sanctions screen may be, whether the
 * platform is in maintenance. These change for business reasons, not code
 * reasons, and a value compiled into a service needs a release to change.
 *
 * ## Why the definition lives here and the value lives in the database
 *
 * The definition — key, type, bounds, default — is code. The database holds
 * only *overrides*: where an operator has replaced a default. The effective
 * value is `override ?? default`.
 *
 * That split is what stops a setting from becoming a row nobody reads. A row
 * is never the definition of a setting; this file is. A key that no service
 * reads is caught by a test that fails the build, not by an operator noticing
 * six weeks later.
 *
 * ## The three rules this file has to keep
 *
 * 1. **Every default equals today's behaviour.** The fallback for a stored
 *    value that no longer validates is the default, and that fallback is only
 *    safe because the default is what the platform was already doing. The
 *    first key whose default is not today's behaviour turns the fallback into
 *    a silent change with no audit line.
 * 2. **Every key is read by code.** A setting with no reader is a control
 *    that saves nowhere — the defect this whole feature exists to remove.
 * 3. **Only `src/settings/` may touch `prisma.systemSetting`.** The value
 *    column is `Json`, so the database enforces nothing; a read that bypasses
 *    this file skips the validation and the fallback.
 *
 * ## Adding a key
 *
 * Declare it here with a default that is the value in use today, read it from
 * the service that needs it, and add it to the reader test. Nothing else is
 * needed: no migration, no column, and no way to invent the key at runtime.
 */

export type SettingType = 'boolean' | 'number' | 'string';

/** The shape every declaration must have. */
interface SettingDefinitionShape {
  /**
   * Namespaced and lowercase, like the flag keys: `area.thing-name`, with the
   * first segment the area. Grepping `compliance.` finds every setting in that
   * area, and a key never collides with a later one the way a bare `gold`
   * would.
   */
  readonly key: string;
  /** The area the setting belongs to. The console groups by it. */
  readonly category: string;
  /** The name an operator reads. */
  readonly label: string;
  /** What the value does, and what changing it does. */
  readonly description: string;
  readonly type: SettingType;
  /**
   * Whether the value may be published to unauthenticated clients.
   *
   * False by default, and false for everything that is not plainly a client
   * concern. This is a disclosure decision per key, so it is written down
   * rather than inferred: publishing a setting is publishing it to anyone.
   */
  readonly clientVisible: boolean;
  /** The value in use today. Never a number this change introduces. */
  readonly default: unknown;
  /** What an override must satisfy. */
  readonly schema: z.ZodType;
  /** Bounds, for a number. The console renders the input from these. */
  readonly min?: number;
  readonly max?: number;
}

/** Keeps the literal types of each declaration while checking the shape. */
function define<const T extends SettingDefinitionShape>(definition: T): T {
  return definition;
}

export const SETTING_DEFINITIONS = [
  define({
    key: 'transactions.intent-ttl-minutes',
    category: 'Transactions',
    label: 'Intent lifetime',
    description:
      'How long an unsigned transaction intent stays actionable before the expiry sweep moves it to "expired". A shorter window means a signature that arrives late is refused; a longer one holds a stale intent open for longer.',
    type: 'number',
    clientVisible: false,
    // Was `DEFAULT_INTENT_TTL_MINUTES` in `transactions/transaction-lifecycle.ts`.
    // The constant moved here rather than being imported, because this file is
    // the single place a default lives.
    default: 15,
    // An hour is a safety rail, not a product promise: past it, a caller that
    // cannot act on the intent is holding a slot open for nothing.
    min: 1,
    max: 1440,
    schema: z.number().int().min(1).max(1440),
  }),
  define({
    key: 'compliance.sanctions-rescreen-hours',
    category: 'Compliance',
    label: 'Sanctions screen freshness',
    description:
      'How long a clean sanctions screen counts as current. The gate re-screens inline once a screen is older than this, and the nightly job re-screens the accounts it covers. Lowering it is safe; raising it lengthens the window in which an unscreened person can move fiat, so the reason on the change matters more here than anywhere else.',
    type: 'number',
    clientVisible: false,
    // Was `SANCTIONS_TTL_MS` (24 * 60 * 60_000) in `compliance-gate.service.ts`.
    // That constant existed so the gate and the re-screen job could not drift
    // apart; this setting serves the same purpose, and both read it.
    default: 24,
    // A week is a safety rail: past it, "current" stops meaning anything.
    min: 1,
    max: 168,
    schema: z.number().int().min(1).max(168),
  }),
  define({
    key: 'swaps.quote-ttl-minutes',
    category: 'Swaps',
    label: 'Quote lifetime',
    description:
      'How long a quote can be executed for. A quote prices a specific amount at a specific moment; past this window the price it names is no longer the price. The expiry sweep moves the quote to "expired" on the same clock.',
    type: 'number',
    clientVisible: false,
    // Was an unnamed inline `60_000` in `swaps.service.ts` — one minute, with
    // nothing to say so.
    default: 1,
    // An hour is a safety rail: a quote anyone may still execute is a price
    // the platform is no longer standing behind.
    min: 1,
    max: 60,
    schema: z.number().int().min(1).max(60),
  }),
  define({
    key: 'platform.maintenance-mode',
    category: 'Platform',
    label: 'Maintenance mode',
    description:
      'When on, the API refuses everything except the paths an operator needs to turn it off again, and clients are told why. A platform that says "we are down" is better than one that answers 401.',
    type: 'boolean',
    clientVisible: true,
    default: false,
    schema: z.boolean(),
  }),
  define({
    key: 'platform.maintenance-message',
    category: 'Platform',
    label: 'Maintenance message',
    description:
      'What clients are told while the platform is in maintenance. Plain text: it is shown to whoever is waiting, and it is not a place for markup. An empty message means "no message set", and the client shows its own wording.',
    type: 'string',
    clientVisible: true,
    // Empty rather than null: a nullable string would need a JSON null in a
    // non-null column, and a special case in the store, the console and the
    // contract — for a value that means the same as "nothing to say".
    default: '',
    // A message is a sentence, not a document. Long enough to say what is
    // happening and when it will be over.
    max: 280,
    schema: z.string().max(280),
  }),
] as const;

export type SettingDefinition = (typeof SETTING_DEFINITIONS)[number];
export type SettingKey = SettingDefinition['key'];

/**
 * The widened shape of a declaration.
 *
 * The literal union above is what the value types are derived from; this is
 * what the rest of the code handles, because a union of declarations has no
 * `min` on the members that do not declare one.
 */
export type SettingShape = SettingDefinitionShape;

/** The value a key holds, as its schema declares it. */
export type SettingValue<K extends SettingKey> = z.infer<
  Extract<SettingDefinition, { key: K }>['schema']
>;

const BY_KEY = new Map<string, SettingShape>(
  SETTING_DEFINITIONS.map((definition) => [definition.key, definition]),
);

/** The declaration for a key, or `undefined` for a key nobody declared. */
export function settingDefinition(key: string): SettingShape | undefined {
  return BY_KEY.get(key);
}

/** Every declaration, in the order the console groups them. */
export function settingDefinitions(): readonly SettingShape[] {
  return SETTING_DEFINITIONS;
}

/** Every declared key. */
export function settingKeys(): SettingKey[] {
  return SETTING_DEFINITIONS.map((definition) => definition.key);
}

/**
 * Fail at boot, not at 3am.
 *
 * A default that does not satisfy its own schema is a mistake in this file,
 * and a mistake in this file would otherwise surface as a setting that reads
 * as the fallback for a value nobody set. Every default is checked when the
 * module loads, so the process refuses to start rather than serving a lie.
 */
for (const definition of SETTING_DEFINITIONS) {
  const parsed = definition.schema.safeParse(definition.default);
  if (!parsed.success) {
    throw new Error(
      `Settings registry: the default for "${definition.key}" does not satisfy its own schema. ` +
        `A default that fails its schema turns the fallback into a silent change.`,
    );
  }
}
