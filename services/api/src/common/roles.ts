/**
 * The role hierarchy, in one place.
 *
 * `user < support < compliance < admin < owner`. A role satisfies a
 * requirement if it is equal or higher.
 *
 * This map used to exist twice — privately in `guards/roles.guard.ts` and
 * again as `ROLE_RANK` in `transactions/transactions.service.ts` — because the
 * second copy could not import the first. Two copies of a permission hierarchy
 * are two chances to disagree about who may approve a physical gold shipment,
 * so the hierarchy lives here and both callers import it.
 *
 * Fail-closed by construction, and deliberately so in both directions:
 *
 * - An **unknown held** role ranks `-1`, below `user`. A role this file does
 *   not know about is not an operator, whatever the caller thinks.
 * - An **unknown required** role ranks `Infinity`, which nothing satisfies. A
 *   requirement misspelled in a decorator denies everyone rather than
 *   quietly letting everyone through.
 */

/**
 * `as const` so the known ranks are non-optional at literal keys. A
 * `Record<string, number>` makes even `ROLE_RANK.support` `number | undefined`
 * under noUncheckedIndexedAccess, which pushes callers toward `!` or a default
 * that could silently be wrong for a permission check.
 */
export const ROLE_RANK = {
  user: 0,
  support: 1,
  compliance: 2,
  admin: 3,
  owner: 4,
} as const;

export type RoleName = keyof typeof ROLE_RANK;

/**
 * The same ranks opened to arbitrary strings, for dynamic lookups. An unknown
 * key is absent here, and every caller treats absence as a failure rather
 * than as a default — see `rankOf` and `roleSatisfies`.
 */
const RANK_LOOKUP: Record<string, number> = ROLE_RANK;

/** Numeric standing of a role. Unknown or absent roles rank below `user`. */
export function rankOf(role: string | null | undefined): number {
  return role ? (RANK_LOOKUP[role] ?? -1) : -1;
}

/**
 * Whether `role` satisfies `required`.
 *
 * An unknown `required` is unsatisfiable — see the note on `Infinity` above.
 */
export function roleSatisfies(role: string | null | undefined, required: string): boolean {
  return rankOf(role) >= (RANK_LOOKUP[required] ?? Infinity);
}

/**
 * Whether `role` is an operator of the platform rather than a customer.
 *
 * `support` and above: the roles that act on other people's records. Used by
 * the transaction lifecycle engine to decide whose transitions need a reason
 * and whose do not.
 */
export function isOperatorRole(role: string | null | undefined): boolean {
  return rankOf(role) >= ROLE_RANK.support;
}
