import {
  LayoutDashboardIcon,
  UsersRoundIcon,
  UsersIcon,
  BarChart3Icon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react"

export type NavSubItem = {
  title: string
  url: string
}

export type NavItem = {
  title: string
  url: string
  icon?: LucideIcon
  /** Minimum role rank that sees this entry. The API enforces; this only hides the link. */
  minRole?: "support" | "compliance" | "admin"
  items?: readonly NavSubItem[]
}

export type NavGroup = {
  label: string
  items: readonly NavItem[]
}

/**
 * Console navigation, grouped. Every entry links a route that exists:
 * either a route file in `apps/admin/src/routes/`, or `/users` — Harbor's
 * lane, whose nav entries are owned here. Not-yet-built destinations
 * (Audit, registry and system pages) are NOT linked; they are listed in
 * the lane report as "nav-ready, route pending".
 */
export const navigation: readonly NavGroup[] = [
  {
    label: "Operations",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboardIcon,
      },
    ],
  },

  {
    label: "Analytics",
    items: [
      {
        title: "Reports",
        url: "/reports",
        icon: BarChart3Icon,
      },
    ],
  },

  {
    label: "Workspace",
    items: [
      {
        title: "Team",
        url: "/team",
        icon: UsersIcon,
      },
      {
        title: "Users",
        url: "/users",
        icon: UsersRoundIcon,
        items: [
          {
            title: "All Users",
            url: "/users",
          },
        ],
      },
    ],
  },

  {
    label: "System",
    items: [
      {
        title: "Settings",
        url: "/settings",
        icon: SettingsIcon,
      },
    ],
  },
]

/** Console role rank, mirroring `apps/admin/src/lib/auth.ts`. Cosmetic only. */
const RANK: Record<string, number> = {
  user: 0,
  support: 1,
  compliance: 2,
  admin: 3,
  owner: 4,
}

/**
 * Hide nav entries the operator's role cannot open, so a support agent is
 * not shown a link that only bounces. Cosmetic only — the API enforces.
 * Unknown roles fail closed to support-level visibility.
 */
export function visibleNavigation(role: string): readonly NavGroup[] {
  const rank = RANK[role.trim().toLowerCase()] ?? 1
  return navigation
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => (RANK[item.minRole ?? "support"] ?? 1) <= rank,
      ),
    }))
    .filter((group) => group.items.length > 0)
}
