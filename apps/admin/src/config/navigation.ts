import {
  ArrowRightLeftIcon,
  BoxesIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  UsersIcon,
  WalletIcon,
  BellIcon,
  CoinsIcon,
  type LucideIcon,
} from "lucide-react"

import { rankAtLeast } from "@/lib/roles"

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
 * Console navigation, grouped. Every entry links a route that exists —
 * verified against `apps/admin/src/routes/` at merge time. Detail routes
 * (`/users/$userId` etc.) stay unlisted; they are reached from their lists.
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
      {
        title: "Transactions",
        url: "/transactions",
        icon: ArrowRightLeftIcon,
      },
      {
        title: "Quotes",
        url: "/quotes",
        icon: CoinsIcon,
      },
      {
        title: "Redemptions",
        url: "/redemptions",
        icon: LandmarkIcon,
      },
      {
        title: "Compliance",
        url: "/compliance",
        icon: ShieldCheckIcon,
        minRole: "compliance",
      },
      {
        title: "Audit",
        url: "/audit",
        icon: ScrollTextIcon,
        minRole: "compliance",
      },
      {
        title: "Notifications",
        url: "/notifications",
        icon: BellIcon,
      },
    ],
  },

  {
    label: "Registry",
    items: [
      {
        title: "Assets",
        url: "/assets",
        icon: BoxesIcon,
      },
      {
        title: "Issuers",
        url: "/issuers",
        icon: LandmarkIcon,
      },
      {
        title: "Providers",
        url: "/providers",
        icon: BoxesIcon,
      },
      {
        title: "Chains",
        url: "/chains",
        icon: BoxesIcon,
      },
      {
        title: "Devices",
        url: "/devices",
        icon: UsersIcon,
      },
      {
        title: "Wallets",
        url: "/wallets",
        icon: WalletIcon,
      },
      {
        title: "Fee rules",
        url: "/fees",
        icon: CoinsIcon,
        minRole: "admin",
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

/**
 * Hide nav entries the operator's role cannot open, so a support agent is
 * not shown a link that only bounces. Cosmetic only — the API enforces.
 * An unrecognised role sees nothing: the rank table fails closed.
 */
export function visibleNavigation(role: string): readonly NavGroup[] {
  return navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        rankAtLeast(role, item.minRole ?? "support"),
      ),
    }))
    .filter((group) => group.items.length > 0)
}
