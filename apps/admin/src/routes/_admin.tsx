import {
  Outlet,
  createFileRoute,
  redirect,
} from "@tanstack/react-router"

import {
  SidebarInset,
  SidebarProvider,
} from "@correnthian/ui/components/sidebar"

import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { canAccessConsole, clearSession, getSession, setSession } from "@/lib/auth"
import { api } from "@/lib/api"

export const Route = createFileRoute("/_admin")({
  /**
   * The shell gate. Every admin route inherits it, so a new page cannot be
   * added without protection. Local storage is only the fast path: the
   * session is re-validated against the API on every navigation, so a
   * revoked token or a demoted role loses the shell at the next click, not
   * at the next login. Anything failing that check returns to sign-in with
   * nothing retained. This decides which shell renders; the API still
   * authorises every call.
   */
  beforeLoad: async () => {
    const session = getSession()
    if (!session || !canAccessConsole(session.role)) {
      clearSession()
      throw redirect({ to: "/auth/login" })
    }
    const me = await api.request("GET /api/v1/auth/me").catch(() => null)
    if (!me || me.status !== "ok" || !canAccessConsole(me.data.role)) {
      clearSession()
      throw redirect({ to: "/auth/login" })
    }
    if (me.data.role !== session.role) {
      setSession({ ...session, role: me.data.role })
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
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