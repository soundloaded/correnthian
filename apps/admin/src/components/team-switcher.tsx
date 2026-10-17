"use client"

import { Link } from "@tanstack/react-router"
import { ShieldCheckIcon } from "lucide-react"

import { siteConfig } from "@/config/site"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@correnthian/ui/components/sidebar"

/**
 * Single-organisation brand block. Correnthian operates one console, so
 * there is nothing to switch — the reference dropdown and its fake teams
 * are gone. The arrangement (mark + name + caption) is unchanged, and the
 * block links home the way brand marks do.
 */
export function TeamSwitcher() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          render={<Link to="/dashboard" />}
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheckIcon className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{siteConfig.name}</span>
            <span className="truncate text-xs">Operations</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
