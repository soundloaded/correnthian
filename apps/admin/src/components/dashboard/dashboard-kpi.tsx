import {
  CoinsIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@correnthian/ui/components/card"
import { useApiQuery } from "@/lib/use-api-query"

/**
 * Four headline counters from live stats. The mock row showed sales
 * figures with previous-period deltas; the backend keeps no previous
 * periods, so each card shows the count plus the one sentence that makes
 * it actionable — never an invented comparison.
 */
export function DashboardKpi() {
  const { data: users } = useApiQuery("GET /api/v1/users/stats")
  const { data: assets } = useApiQuery("GET /api/v1/assets/stats")

  const cards = [
    {
      title: "Total Accounts",
      icon: UsersIcon,
      iconBg:
        "bg-gradient-to-br from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500",
      value: users ? String(users.total) : null,
      hint: "Registered accounts",
    },
    {
      title: "Pending KYC",
      icon: ShieldCheckIcon,
      iconBg:
        "bg-gradient-to-br from-violet-500 to-purple-600 dark:from-violet-400 dark:to-purple-500",
      value: users ? String(users.byKyc.pending ?? 0) : null,
      hint: "Awaiting verification",
    },
    {
      title: "Enabled Metals",
      icon: CoinsIcon,
      iconBg:
        "bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500",
      value: assets ? String(assets.enabledMetals) : null,
      hint: "Tokens backed and live",
    },
    {
      title: "Stale Attestations",
      icon: ShieldAlertIcon,
      iconBg:
        "bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-400 dark:to-orange-500",
      value: assets ? String(assets.staleAttestations) : null,
      hint: "Backing past due",
    },
  ]

  return (
    <div className="grid grid-cols-12 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card
            key={card.title}
            className="relative col-span-12 overflow-hidden bg-card/80 backdrop-blur-sm bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px] sm:col-span-6 xl:col-span-3"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className="flex size-10 items-center justify-center rounded-lg border border-border p-0.5 shadow">
                <div
                  className={`flex size-full items-center justify-center rounded-md text-white ${card.iconBg}`}
                >
                  <Icon className="size-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold tracking-tight tabular-nums">
                {card.value ?? "—"}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{card.hint}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
