"use client"

import { Link, useNavigate } from "@tanstack/react-router"
import {
  ChevronsUpDownIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
} from "@correnthian/ui/components/avatar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@correnthian/ui/components/dropdown-menu"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@correnthian/ui/components/sidebar"

import { ThemeToggle } from "@correnthian/ui/components/theme-toggle"

import { logout } from "@/lib/api"
import { useApiQuery } from "@/lib/use-api-query"

/**
 * Live operator identity. The session holds email + role; `auth/me`
 * re-validates both against the API (`{ id, email, role }` — no display
 * name, so the email's local part reads as the name). While the read is
 * pending, the session email shows — never a hardcoded placeholder.
 */
export function NavUser() {
  const { isMobile } = useSidebar()
  const navigate = useNavigate()

  const me = useApiQuery("GET /api/v1/auth/me")
  const live = me.status === "success" ? me.data : null
  const email = live?.email ?? ""
  const role = live?.role ?? ""
  const name = email ? email.split("@")[0] ?? email : "Operator"
  const initials = name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "OP"

  const handleLogout = () => {
    void (async () => {
      await logout()
      await navigate({ to: "/auth/login" })
    })()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="
                border border-border
                bg-background
                hover:bg-muted

                group-data-[collapsible=icon]:border-0
                group-data-[collapsible=icon]:bg-transparent
                group-data-[collapsible=icon]:!p-0
              "
              />
            }
          >
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>

            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {name}
              </span>

              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            </div>

            <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-56 p-2"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {/* User Info */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>

                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {name}
                    </span>

                    <span className="truncate text-xs text-muted-foreground">
                      {email}
                    </span>
                  </div>
                </div>
                {role && (
                  <p className="px-1 pb-1 text-xs capitalize text-muted-foreground">
                    {role}
                  </p>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Theme */}
            <DropdownMenuGroup>
              <ThemeToggle />
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Settings */}
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={<Link to="/settings" />}
              >
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Logout */}
            <DropdownMenuItem
              variant="destructive"
              onClick={handleLogout}
            >
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
