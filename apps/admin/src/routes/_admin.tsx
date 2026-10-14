import {
  Outlet,
  createFileRoute,
} from "@tanstack/react-router"

import {
  SidebarInset,
  SidebarProvider,
} from "@correnthian/ui/components/sidebar"

import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"

export const Route = createFileRoute("/_admin")({
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