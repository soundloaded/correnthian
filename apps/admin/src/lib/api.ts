import { createCorrenthianClient } from "@correnthian/api-client"
import { canAccessConsole, clearSession, getSession, setSession } from "./auth"

/**
 * The one API client. Versioned base, bearer from the console session, and
 * response types inferred from the contract registry — screens never
 * hand-write a response shape.
 */
export const api = createCorrenthianClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
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
      await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      })
    } catch {
      // The session below is ours to drop either way.
    }
  }
  clearSession()
}
