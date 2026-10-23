/**
 * Web session for the wallet shell.
 *
 * The web app is a client-rendered wallet shell, so there is no server to
 * hold an httpOnly cookie: the bearer token lives in memory, mirrored to
 * localStorage so the holder stays signed in across tabs and reloads. That
 * mirror is readable by any script running on this origin, which is the
 * accepted cost — it is why the web app never renders untrusted HTML, why
 * stored sessions die at expiry, and why the shell re-validates against
 * `GET /api/v1/auth/me` on navigation. sessionStorage was rejected for the
 * same reason the admin rejected it: it isolates tabs, so signing in on
 * one tab left every other tab signed out.
 */

export interface WebSession {
  token: string;
  userId: string;
  email: string;
  role: string;
  expiresAt: string;
}

const STORAGE_KEY = 'correnthian.web.session';

let memory: WebSession | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

/** Largest delay setTimeout accepts: 2^31 - 1 ms, about 24.8 days. */
const MAX_TIMEOUT = 2_147_483_647;

function armExpiry(session: WebSession): void {
  disarmExpiry();
  const at = Date.parse(session.expiresAt);
  if (Number.isNaN(at)) return;
  const delay = at - Date.now();
  if (delay <= 0) return;
  // setTimeout takes a 32-bit delay: anything past ~24.8 days overflows and
  // fires immediately, which signed every user out at login (a 30-day TTL
  // overflows it). Clamp and re-arm on fire; the read path enforces expiry
  // regardless, so the timer is only promptness, not correctness.
  expiryTimer = setTimeout(tickExpiry, Math.min(delay, MAX_TIMEOUT));
}

function tickExpiry(): void {
  expiryTimer = null;
  if (!memory) return;
  if (isExpired(memory)) clearSession();
  else armExpiry(memory);
}

function disarmExpiry(): void {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}

export function getSession(): WebSession | null {
  if (memory && !isExpired(memory)) return memory;
  memory = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WebSession>;
    if (typeof parsed.token !== 'string' || !parsed.token) return null;
    memory = parsed as WebSession;
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

function isExpired(session: WebSession): boolean {
  const at = Date.parse(session.expiresAt);
  return Number.isNaN(at) || at <= Date.now();
}

export function setSession(session: WebSession): void {
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
