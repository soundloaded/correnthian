/**
 * Console session for the SPA shell.
 *
 * The app runs in SPA mode, so there is no server to hold an httpOnly
 * cookie: the bearer token lives in memory, mirrored to localStorage so the
 * operator stays signed in across tabs and reloads. That mirror is readable
 * by any script running on this origin, which is the accepted cost — it is
 * why the console must never render untrusted HTML, why stored sessions die
 * at expiry, and why the shell re-validates against the API on every
 * navigation. sessionStorage was tried first and rejected: it isolates tabs,
 * so signing in on one tab left every other tab signed out.
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
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function armExpiry(session: ConsoleSession): void {
  disarmExpiry();
  const at = Date.parse(session.expiresAt);
  if (Number.isNaN(at)) return;
  const delay = at - Date.now();
  if (delay <= 0) return;
  // One shot at the deadline, cleared on sign-out — not an interval.
  expiryTimer = setTimeout(() => clearSession(), delay);
}

function disarmExpiry(): void {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}

export function getSession(): ConsoleSession | null {
  if (memory && !isExpired(memory)) return memory;
  memory = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsoleSession>;
    if (typeof parsed?.token !== 'string' || !parsed.token) return null;
    memory = parsed as ConsoleSession;
    if (isExpired(memory)) {
      clearSession();
      return null;
    }
    armExpiry(memory);
    return memory;
  } catch {
    // A corrupt or planted value must not survive to be re-parsed forever.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage itself is unavailable; nothing to clean.
    }
    return null;
  }
}

function isExpired(session: ConsoleSession): boolean {
  const at = Date.parse(session.expiresAt);
  return Number.isNaN(at) || at <= Date.now();
}

export function setSession(session: ConsoleSession): void {
  memory = session;
  armExpiry(session);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private windows and blocked storage lose reload persistence only.
  }
}

export function clearSession(): void {
  memory = null;
  disarmExpiry();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing persisted, nothing to clear.
  }
}

if (typeof window !== 'undefined') {
  // Another tab signing out must sign this one out too: without this, a tab
  // keeps calling the API on a revoked token until its next navigation.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue === null) {
      memory = null;
      disarmExpiry();
    }
  });
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
