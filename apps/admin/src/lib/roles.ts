/**
 * Role rank for the operations console.
 *
 * This mirrors the API's `RolesGuard` table. The API is the real boundary:
 * this only decides which controls a screen offers, so an operator below the
 * required role is not shown a button that will only bounce. Both sides fail
 * closed — an unrecognised role ranks -1, an unrecognised requirement is
 * unsatisfiable, so a new server-side role hides the controls here rather
 * than exposing them.
 */
const RANK: Record<string, number> = {
  user: 0,
  support: 1,
  compliance: 2,
  admin: 3,
  owner: 4,
};

export function rankAtLeast(
  actual: string | undefined,
  required: string,
): boolean {
  return (RANK[(actual ?? "").trim().toLowerCase()] ?? -1) >= (RANK[required] ?? 99);
}
