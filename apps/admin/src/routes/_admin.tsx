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
import { canAccessConsole, clearSession, getSession } from "@/lib/auth"

export const Route = createFileRoute("/_admin")({
  /**
   * The shell gate. Every admin route inherits it, so a new page cannot be
   * added without protection. A missing session — or a session whose role no
   * longer clears the console — returns to sign-in with nothing retained.
   * This decides which shell renders; the API still authorises every call.
   */
  beforeLoad: () => {
    const session = getSession()
    if (!session || !canAccessConsole(session.role)) {
      clearSession()
      throw redirect({ to: "/auth/login" })
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