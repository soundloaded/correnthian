import { createCorrenthianClient } from "@correnthian/api-client"
import { clearSession, getSession, setSession } from "./auth"

/**
 * API origin. Explicitly configured in development; in production a missing
 * variable falls back to the serving origin rather than a localhost
 * constant that would silently point every request at the holder's own
 * machine. Same-origin deploys work; split origins must set
 * NEXT_PUBLIC_API_URL.
 *
 * The development fallback is the API's port (3100, from
 * `services/api/.env`), not the wallet's own. It used to point at 3000 —
 * the admin's own port — so a console calling itself returned 404s that
 * looked like a dead API rather than a misdirected one. This client does
 * not repeat that shape.
 */
export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3100"
    : typeof window === "undefined"
      ? ""
      : window.location.origin)

export function signOutAndLeave(): void {
  clearSession()
  window.location.href = "/signin"
}

/**
 * The one API client. Versioned base, bearer from the wallet session, and
 * response types inferred from the contract registry — screens never
 * hand-write a response shape. Any 401 anywhere drops the session and
 * leaves for sign-in: a revoked token must never keep a shell rendered.
 */
export const api = createCorrenthianClient({
  baseUrl: apiBaseUrl,
  getToken: () => getSession()?.token ?? null,
  onUnauthorised: () => signOutAndLeave(),
})

/**
 * Sign in against the live API. Failure answers are deliberately generic:
 * backend detail never reaches the form, so no message can become an
 * enumeration oracle.
 */
export async function login(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await api.request("POST /api/v1/auth/login", {
    auth: false,
    body: { email, password },
  })

  if (result.status !== "ok") {
    return { ok: false, error: "Those credentials were not accepted." }
  }

  const { user, token, expiresAt } = result.data
  setSession({ token, userId: user.id, email: user.email, role: user.role, expiresAt })
  return { ok: true }
}

/**
 * Register against the live API, then hold the returned session.
 */
export async function register(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await api.request("POST /api/v1/auth/register", {
    auth: false,
    body: { email, password },
  })

  if (result.status !== "ok") {
    return { ok: false, error: "Registration was not accepted." }
  }

  const { user, token, expiresAt } = result.data
  setSession({ token, userId: user.id, email: user.email, role: user.role, expiresAt })
  return { ok: true }
}

/**
 * Ask for a sign-in link. The answer never says whether the address is
 * known — the API's enumeration rule — so the form always reports "check
 * your inbox" on success and a generic failure otherwise.
 */
export async function requestMagicLink(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await api.request("POST /api/v1/auth/magic-link", {
    auth: false,
    body: { email },
  })
  if (result.status !== "ok") return { ok: false, error: "That request was not accepted." }
  return { ok: true }
}

/**
 * Exchange a sign-in link token for a session, then hold it like a login.
 */
export async function consumeMagicLink(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await api.request("POST /api/v1/auth/magic-link/consume", {
    auth: false,
    body: { token },
  })
  if (result.status !== "ok") {
    return { ok: false, error: "That link is no longer valid. Ask for a fresh one." }
  }
  const { user, token: sessionToken, expiresAt } = result.data
  setSession({ token: sessionToken, userId: user.id, email: user.email, role: user.role, expiresAt })
  return { ok: true }
}

/**
 * Ask for a password-reset link. Same enumeration rule as the sign-in
 * link: success always reads as "check your inbox".
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await api.request("POST /api/v1/auth/password-reset", {
    auth: false,
    body: { email },
  })
  if (result.status !== "ok") return { ok: false, error: "That request was not accepted." }
  return { ok: true }
}

/**
 * Set a new password under a reset token. The link is single-use and every
 * old session is revoked server-side; the caller lands back at sign-in to
 * open a fresh one.
 */
export async function confirmPasswordReset(
  token: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await api.request("POST /api/v1/auth/password-reset/confirm", {
    auth: false,
    body: { token, password },
  })
  if (result.status !== "ok") {
    return { ok: false, error: "That link is no longer valid. Ask for a fresh one." }
  }
  return { ok: true }
}

/**
 * Best-effort server revoke, then the local session goes regardless.
 * The query cache is cleared too: it holds the last holder's balances,
 * and on a shared device the next sign-in must not render them from
 * cache before its own refetch lands.
 */
export async function logout(): Promise<void> {
  const session = getSession()
  if (session) {
    try {
      await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      })
    } catch {
      // Revocation is best-effort; the local session goes either way.
    }
  }
  try {
    const { getQueryClient } = await import("./query-client")
    getQueryClient().clear()
  } catch {
    // Cache clear is hygiene, not correctness; the session still goes.
  }
  signOutAndLeave()
}
