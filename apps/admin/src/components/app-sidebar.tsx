"use client"

import { visibleNavigation } from "@/config/navigation"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@correnthian/ui/components/sidebar"

import { ScrollArea } from "@correnthian/ui/components/scroll-area"

import { getSession } from "@/lib/auth"

/**
 * Console shell sidebar. Brand block, grouped navigation, operator
 * identity. NavProjects/NavSecondary were reference decoration — nothing
 * feeds them, so they are gone. The role gate is cosmetic; the API
 * enforces.
 */
export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const session = getSession()
  const groups = visibleNavigation(session?.role ?? "support")

  return (
    <Sidebar variant="inset" {...props} collapsible="icon">
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-full">
          <NavMain groups={groups} />
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      <SidebarRail className="hover:bg-transparent hover:after:bg-transparent" />
    </Sidebar>
  )
}
