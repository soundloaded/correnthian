import {
  Bell,
  Building2,
  ChevronRight,
  CreditCard,
  Flag,
  Palette,
  Plug,
  ScrollText,
  ShieldCheck,
  Timer,
  UserRound,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react"

export type SettingSection =
  | "profile"
  | "security"
  | "notifications"
  | "flags"
  | "integrations"
  | "data"
  | "jobs"
  | "appearance"
  | "workspace"
  | "pipeline"
  | "billing"
  | "api-webhooks"

interface NavItem {
  id: SettingSection
  label: string
  icon: LucideIcon
}

interface NavGroup {
  groupLabel?: string
  items: NavItem[]
}

// Sections with a backend come first in each group; sections with no
// backend sit under "Later", labelled as such, so an operator never
// mistakes an honest empty state for a working page.
const navGroups: NavGroup[] = [
  {
    groupLabel: "Account",
    items: [
      { id: "profile", label: "Profile", icon: UserRound },
      { id: "security", label: "Security", icon: ShieldCheck },
      { id: "notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    groupLabel: "Workspace",
    items: [
      { id: "flags", label: "Feature flags", icon: Flag },
      { id: "integrations", label: "Integrations", icon: Plug },
      { id: "data", label: "Data", icon: ScrollText },
    ],
  },
  {
    groupLabel: "Operations",
    items: [
      { id: "jobs", label: "Scheduled jobs", icon: Timer },
    ],
  },
  {
    groupLabel: "Later — no backend",
    items: [
      { id: "appearance", label: "Appearance", icon: Palette },
      { id: "workspace", label: "Workspace", icon: Building2 },
      { id: "pipeline", label: "Pipeline", icon: Workflow },
      { id: "billing", label: "Billing", icon: CreditCard },
      { id: "api-webhooks", label: "API & Webhooks", icon: Webhook },
    ],
  },
]

interface SettingsSidebarProps {
  activeSection: SettingSection
  onSectionChange: (section: SettingSection) => void
}

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  return (
    <nav
      aria-label="Settings sections"
      className="w-full shrink-0 overflow-x-auto rounded-xl border p-4 sm:w-64 sm:overflow-visible"
    >
      <div className="flex flex-row gap-1 border-b pb-2 sm:flex-col sm:gap-6 sm:border-none sm:pb-0">
        {navGroups.map((group, groupIdx) => (
          <div
            key={groupIdx}
            className="flex flex-row gap-1 sm:flex-col sm:gap-1"
          >
            {group.groupLabel && (
              <p className="hidden px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 sm:block">
                {group.groupLabel}
              </p>
            )}

            <div className="flex flex-row gap-1 sm:flex-col sm:gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSectionChange(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-2 py-1 text-left text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:text-sm ${
                      isActive
                        ? "bg-primary/10 text-primary dark:bg-primary/20"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                  >
                    <Icon
                      className={`size-4 shrink-0 transition-colors ${
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />

                    <span className="whitespace-nowrap">{item.label}</span>

                    <ChevronRight
                      className={`ml-auto hidden size-3.5 shrink-0 transition-transform sm:block ${
                        isActive
                          ? "translate-x-0 text-primary opacity-100"
                          : "-translate-x-1 opacity-0 group-hover:opacity-40"
                      }`}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}
