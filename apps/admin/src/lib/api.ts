import { createCorrenthianClient } from "@correnthian/api-client"
import { canAccessConsole, clearSession, getSession, setSession } from "./auth"

/**
 * API origin. Explicitly configured in development; in production a missing
 * variable falls back to the serving origin rather than a localhost
 * constant that would silently point every request at the operator's own
 * machine. Same-origin deploys work; split origins must set VITE_API_URL.
 *
 * The development fallback is the API's port (3100, from
 * `services/api/.env`), not the console's own. It used to point at 3000 —
 * the admin's own port — so `pnpm dev` with no `.env` produced a console
 * that called itself, and every request 404'd. The failure looks like a dead
 * API rather than a misdirected one.
 */
export const apiBaseUrl =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3100" : window.location.origin)

export function signOutAndLeave(): void {
  clearSession()
  window.location.href = "/auth/login"
}

/**
 * The one API client. Versioned base, bearer from the console session, and
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
 * Sign in against the live API and refuse non-staff before any session
 * exists. Failure answers are deliberately generic: backend detail never
 * reaches the form, so no message can become an enumeration oracle.
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
  if (!canAccessConsole(user.role)) {
    // The server already minted a bearer for this account. Refusing it
    // client-side without revoking would orphan a live 30-day token nobody
    // holds a handle to, so it is revoked here before refusing.
    try {
      await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // Revocation is best-effort; the refusal stands either way.
    }
    return { ok: false, error: "This account does not have access to the operations console." }
  }
  setSession({ token, userId: user.id, email: user.email, role: user.role, expiresAt })
  return { ok: true }
}

/**
 * Best-effort server revoke, then the local session goes regardless.
 * Returns whether the server confirmed the revoke — callers surface a
 * warning on false rather than claiming a sign-out the server never saw.
 */
export async function logout(): Promise<boolean> {
  // Raw fetch, not the typed client: logout answers 204 with no body, and
  // the contract registry only describes routes with response bodies.
  const session = getSession()
  let revoked = true
  if (session) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      })
      revoked = response.ok
    } catch {
      revoked = false
    }
  }
  clearSession()
  return revoked
}
