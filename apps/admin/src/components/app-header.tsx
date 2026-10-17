"use client"

import { useLocation } from "@tanstack/react-router"
import { SidebarTrigger } from "@correnthian/ui/components/sidebar"

import { navigation } from "@/config/navigation"
import { HeaderNotifications } from "@/components/header-notifications"
import { HeaderCreate } from "@/components/header-create"
import { HeaderSearch } from "@/components/header-search"

type NavEntry = { title: string; url: string }

/**
 * The sidebar config is the console's route catalogue, so the title is
 * derived from it rather than repeated here. Sub-items are included because
 * several pages (pipeline, new lead) only exist as sub-entries.
 */
function catalogue(): NavEntry[] {
  const out: NavEntry[] = []
  for (const group of navigation) {
    for (const item of group.items) {
      out.push({ title: item.title, url: item.url })
      // Optional sub-nav: the type marks it optional, and "in" narrows the
      // key, not the value — an item with the key present but undefined
      // would still crash the loop below.
      const subs = item.items ?? []
      for (const sub of subs) out.push({ title: sub.title, url: sub.url })
    }
  }
  return out
}

const entries = catalogue()

/**
 * Longest-prefix match so /users/$userId reads "All Users" rather than the
 * first prefix that happens to fit. Anything outside the catalogue falls
 * back to the raw segment instead of a stale hardcoded name.
 */
function titleFor(pathname: string): string {
  const exact = entries.find((e) => e.url === pathname)
  if (exact) return exact.title
  const prefix = entries
    .filter((e) => pathname.startsWith(`${e.url}/`))
    .sort((a, b) => b.url.length - a.url.length)
    .at(0)
  if (prefix) return prefix.title
  const segment = pathname.split("/").filter(Boolean).pop() ?? ""
  if (!segment || segment.startsWith("$")) return "Console"
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
}

export function AppHeader() {
  const location = useLocation()
  const title = titleFor(location.pathname)

  return (
    <header className="flex h-14 shrink-0 items-center border-b">
      <div className="flex w-full items-center gap-3 px-4">
        {/* Sidebar */}
        <SidebarTrigger className="size-8 shrink-0" />

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Page title */}
        <div className="flex min-w-0 items-center">
          <h1 className="truncate text-sm font-medium">
            {title}
          </h1>
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <HeaderSearch />

          {/* Notifications */}
          <HeaderNotifications />
          <HeaderCreate />
        </div>
      </div>
    </header>
  )
}
