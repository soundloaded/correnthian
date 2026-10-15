import { createCorrenthianClient } from "@correnthian/api-client"
import { canAccessConsole, clearSession, getSession, setSession } from "./auth"

/**
 * API origin. Explicitly configured in development; in production a missing
 * variable falls back to the serving origin rather than a localhost
 * constant that would silently point every request at the operator's own
 * machine. Same-origin deploys work; split origins must set VITE_API_URL.
 */
export const apiBaseUrl =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

/**
 * The one API client. Versioned base, bearer from the console session, and
 * response types inferred from the contract registry — screens never
 * hand-write a response shape.
 */
export const api = createCorrenthianClient({
  baseUrl: apiBaseUrl,
  getToken: () => getSession()?.token ?? null,
})

/** Sign in against the live API and refuse non-staff before any session exists. */
export async function login(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await api.request("POST /api/v1/auth/login", {
    auth: false,
    body: { email, password },
  })

  if (result.status === "unauthorised") {
    return { ok: false, error: "Those credentials were not accepted." }
  }
  if (result.status === "unavailable") {
    return { ok: false, error: "Cannot reach the Correnthian API. Check that it is running, then try again." }
  }
  if (result.status !== "ok") {
    return { ok: false, error: result.status === "forbidden" ? result.message : (result.message ?? "Sign-in failed. Try again.") }
  }

  const { user, token, expiresAt } = result.data
  if (!canAccessConsole(user.role)) {
    return { ok: false, error: "This account does not have access to the operations console." }
  }
  setSession({ token, userId: user.id, email: user.email, role: user.role, expiresAt })
  return { ok: true }
}

/** Best-effort server revoke, then the local session goes regardless. */
export async function logout(): Promise<void> {
  // Raw fetch, not the typed client: logout answers 204 with no body, and
  // the contract registry only describes routes with response bodies.
  const session = getSession()
  if (session) {
    try {
      await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      })
    } catch {
      // The session below is ours to drop either way.
    }
  }
  clearSession()
}
