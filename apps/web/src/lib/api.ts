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
