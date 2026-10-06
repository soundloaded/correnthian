/**
 * Which operations owe the trail a stated reason.
 *
 * §55's example is the whole argument:
 *
 *     SECURITY ADMIN
 *     Changed:  Provider X → Disabled
 *     Reason:   Provider outage
 *
 * Without the third line the record says an asset was disabled and nothing
 * about why, which is the half an investigator six weeks later actually needs.
 * "Which operations qualify" is therefore a decision, not a per-call-site
 * judgement — so it lives here as data rather than in every service's head.
 *
 * Two rules of matching, both deliberately conservative:
 *
 *  1. An action is destructive when its final dot-separated segment is a
 *     destructive verb. That covers `provider.disabled`,
 *     `provider.status.disabled` and any future `chain.disabled` without
 *     having to register each spelling.
 *  2. Operations whose verb is neutral get an explicit name below. A generic
 *     `.changed` would otherwise make every provider status nudge — including
 *     active → degraded during a blip — demand a justification, and a rule
 *     that fires on ordinary work gets ignored, which defeats the point.
 */

/**
 * Where these are owed, and where they are not yet collected.
 *
 * The taxonomy and the enforcement both live in this module, but the handlers
 * below belong to other modules. Each needs two lines: `@RequireAuditReason(...)`
 * on the route, and `audit.recordChange(...)` around the mutation with the row
 * before and after. Until then those operations are audited by the global
 * interceptor — recorded, but with no reason and no before/after, which is the
 * gap §55 describes.
 *
 *   ASSET_DISABLED        assets.controller.ts   PATCH :assetId/enabled
 *   CHAIN_DISABLED        chains.controller.ts   PATCH :id/enabled
 *   PROVIDER_DISABLED     providers.controller.ts PATCH :slug/status
 *   ACCOUNT_SUSPENDED     users.controller.ts    PATCH :id/status
 *   VERIFIED_TIER_CHANGED issuers.controller.ts  PATCH :slug/verification
 */
export const DESTRUCTIVE_ACTIONS = {
  /** Turning a listed asset off. Users stop being able to see or buy it. */
  ASSET_DISABLED: 'asset.disabled',
  /** Taking a chain out of service. Every wallet on it stops working. */
  CHAIN_DISABLED: 'chain.disabled',
  /** Taking a provider out of service. §55's worked example. */
  PROVIDER_DISABLED: 'provider.disabled',
  /** Freezing an account. */
  ACCOUNT_SUSPENDED: 'account.suspended',
  /**
   * Moving an issuer or asset up or down a trust tier. This one is worth a
   * reason in both directions: the design spec treats the tier as the product,
   * so quietly lowering it is as consequential as disabling the asset.
   */
  VERIFIED_TIER_CHANGED: 'verifiedTier.changed',
} as const;

export type DestructiveAction = (typeof DESTRUCTIVE_ACTIONS)[keyof typeof DESTRUCTIVE_ACTIONS];

const EXPLICIT: ReadonlySet<string> = new Set(Object.values(DESTRUCTIVE_ACTIONS));

/**
 * Verbs that destroy or freeze something, whatever the resource is called.
 *
 * Note what is absent: `changed`, `set` and `updated`. They fire on ordinary
 * work, and a requirement that fires on ordinary work gets waived.
 */
const DESTRUCTIVE_VERBS: ReadonlySet<string> = new Set([
  'disabled',
  'suspended',
  'revoked',
  'deactivated',
  'removed',
  'deleted',
  'terminated',
]);

export function isDestructive(action: string): boolean {
  if (EXPLICIT.has(action)) return true;
  const tail = action.split('.').at(-1) ?? '';
  return DESTRUCTIVE_VERBS.has(tail);
}

/**
 * Short enough that "x" fails and long enough that "test" is not a reason.
 * Operators type sentences; this exists only to reject a placeholder.
 */
export const MIN_REASON_LENGTH = 8;

export function isUsableReason(reason: unknown): reason is string {
  return typeof reason === 'string' && reason.trim().length >= MIN_REASON_LENGTH;
}