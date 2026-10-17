import * as React from "react"
import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"

import {
  SidebarInset,
  SidebarProvider,
} from "@correnthian/ui/components/sidebar"

import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import {
  canAccessConsole,
  clearSession,
  getSession,
  setSession,
  type ConsoleSession,
} from "@/lib/auth"
import { api } from "@/lib/api"

/**
 * The shell gate. Every admin route inherits it, so a new page cannot be
 * added without protection.
 *
 * Two tiers, deliberately asymmetric. The stored session (role-bearing, but
 * only as fast as localStorage) decides the shell on its own: if it is
 * present and staff, the shell renders immediately and the API still
 * authorises every call underneath. Re-validation against `/auth/me` runs
 * in the background and only ever *narrows* — a demoted role loses the
 * shell via a targeted redirect, never a session wipe. Anything failing
 * the stored check returns to sign-in with nothing retained, which is the
 * one case where clearing is safe: no live session existed to destroy.
 *
 * The previous shape awaited `/auth/me` inside this gate and wiped the
 * session on any non-OK answer. A transient API failure (restart, blip,
 * slow first query) then read as a dead session: the operator was signed
 * out on navigation by an outage, and every other tab followed through
 * the storage event. A guard must fail closed for strangers and fail open
 * for a session it already holds — the API enforces per call either way.
 */
export const Route = createFileRoute("/_admin")({
  beforeLoad: () => {
    const session = getSession()
    if (!session || !canAccessConsole(session.role)) {
      clearSession()
      throw redirect({ to: "/auth/login" })
    }
    return { session }
  },
  component: AdminLayout,
})

/**
 * Background re-validation, fired once per shell mount. Narrows only:
 * a demotion clears and redirects (the local role is stale and the shell
 * would mislead); any other failure — network, 500, expired token — leaves
 * the session alone. The per-call 401 handler stays the one place that
 * drops a session, because only a real API answer proves it is dead.
 */
function useSessionValidator(session: ConsoleSession) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  React.useEffect(() => {
    let live = true
    void (async () => {
      let role: string | null = null
      try {
        const result = await api.request("GET /api/v1/auth/me")
        if (result.status === "ok") role = result.data.role
        else if (result.status === "unauthorised" || result.status === "forbidden") return
        else return
      } catch {
        return
      }
      if (!live) return
      if (!role || !canAccessConsole(role)) {
        clearSession()
        await navigate({ to: "/auth/login" })
        return
      }
      if (role !== session.role) {
        setSession({ ...session, role })
        await queryClient.invalidateQueries()
      }
    })()
    return () => {
      live = false
    }
  }, [queryClient, navigate, session])
}

function AdminLayout() {
  const { session } = Route.useRouteContext()
  useSessionValidator(session)
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar />

      <SidebarInset className="overflow-hidden">
        <AppHeader />

        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}