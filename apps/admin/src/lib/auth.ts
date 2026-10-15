/**
 * Console session for the SPA shell.
 *
 * The app runs in SPA mode, so there is no server to hold an httpOnly
 * cookie: the bearer token lives in memory, mirrored to sessionStorage so a
 * reload keeps the operator signed in without surviving the tab's death the
 * way localStorage would. An XSS hole could still read it, which is why the
 * console must never render untrusted HTML — admin defence in depth, stated
 * once here instead of per page.
 */

export interface ConsoleSession {
  token: string;
  userId: string;
  email: string;
  role: string;
  expiresAt: string;
}

const STORAGE_KEY = 'correnthian.admin.session';

let memory: ConsoleSession | null = null;

export function getSession(): ConsoleSession | null {
  if (memory && !isExpired(memory)) return memory;
  memory = null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsoleSession>;
    if (typeof parsed?.token !== 'string' || !parsed.token) return null;
    memory = parsed as ConsoleSession;
    if (isExpired(memory)) {
      clearSession();
      return null;
    }
    return memory;
  } catch {
    return null;
  }
}

function isExpired(session: ConsoleSession): boolean {
  const at = Date.parse(session.expiresAt);
  return Number.isNaN(at) || at <= Date.now();
}

export function setSession(session: ConsoleSession): void {
  memory = session;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private windows and blocked storage lose reload persistence only.
  }
}

export function clearSession(): void {
  memory = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing persisted, nothing to clear.
  }
}

const RANK: Record<string, number> = {
  user: 0,
  support: 1,
  compliance: 2,
  admin: 3,
  owner: 4,
};

/** Fail-closed: an unrecognised role is denied, never admitted. */
export function canAccessConsole(role: string): boolean {
  return (RANK[role.trim().toLowerCase()] ?? -1) >= 1;
}
