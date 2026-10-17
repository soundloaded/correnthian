import { ShieldCheckIcon, UsersIcon, UserCheckIcon, type LucideIcon } from "lucide-react"

import { Card, CardContent } from "@correnthian/ui/components/card"
import { useApiQuery } from "@/lib/use-api-query"

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  iconClassName,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  iconClassName: string
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              {label}
            </p>

            <p className="mt-0.5 text-2xl font-bold leading-tight tracking-tight">
              {value}
            </p>

            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {hint}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Live facts over the accounts registry. Team-scoped numbers (operators
// only) would need a role-filtered stats endpoint that does not exist, so
// these count every account and say so — a card that claimed "3 operators"
// from page one's slice would lie about the registry.
export function TeamStats() {
  const { data: stats } = useApiQuery("GET /api/v1/users/stats")

  const total = stats?.total ?? null
  const admins = stats ? (stats.byRole.admin ?? 0) + (stats.byRole.owner ?? 0) : null
  const staff =
    stats
      ? (stats.byRole.support ?? 0) +
        (stats.byRole.compliance ?? 0) +
        (stats.byRole.admin ?? 0) +
        (stats.byRole.owner ?? 0)
      : null

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={UsersIcon}
        label="Accounts"
        value={total === null ? "…" : String(total)}
        hint="Every registered account, not only operators"
        iconClassName="bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
      />

      <StatCard
        icon={ShieldCheckIcon}
        label="Admins and owners"
        value={admins === null ? "…" : String(admins)}
        hint="Roles that can change access"
        iconClassName="bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
      />

      <StatCard
        icon={UserCheckIcon}
        label="Staff roles"
        value={staff === null ? "…" : String(staff)}
        hint="Support, compliance, admin, owner"
        iconClassName="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
      />

      <StatCard
        icon={UsersIcon}
        label="New this week"
        value={stats ? String(stats.newLast7d) : "…"}
        hint="Accounts created in the last 7 days"
        iconClassName="bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
      />
    </div>
  )
}
