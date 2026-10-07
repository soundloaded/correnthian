/**
 * The permission table, and the two gates built on it.
 *
 * This lives apart from `lib/api-server` deliberately: that module is marked
 * `server-only`, which makes the rank table untestable in isolation, and the
 * rank table is the one thing an agent is most likely to fork. There is
 * already one duplicate of this hierarchy in the API (`common/roles.ts`) and it
 * drifted once; two copies in the admin would drift the same way.
 */

/** Role rank, mirroring the API's hierarchy. UI gates mirror the server's. */
export const RANK: Record<string, number> = {
  user: 0,
  support: 1,
  compliance: 2,
  admin: 3,
  owner: 4,
};

export const roleAtLeast = (actual: string | undefined, required: string): boolean =>
  (actual ? (RANK[actual] ?? -1) : -1) >= (RANK[required] ?? Infinity);

/**
 * The operations console is staff-only. `user` is a customer account: it holds
 * metal, it does not operate the registry.
 *
 * Fail-closed. An unrecognised role is denied rather than admitted, so a role
 * the API grows before this file learns about it cannot walk into the shell.
 */
export const CONSOLE_MIN_ROLE = 'support';

/**
 * Whether a session may enter the console shell.
 *
 * **This is a UX gate, not a security control.** `getSession()` reads an
 * unsigned cookie, so the role it reports is display state that a determined
 * client could edit. That is acceptable only because the API re-checks
 * authorisation on every call — this decides which shell to render, never
 * whether data is served.
 */
export const canAccessConsole = (role: string | null | undefined): boolean =>
  roleAtLeast(role ?? undefined, CONSOLE_MIN_ROLE);
