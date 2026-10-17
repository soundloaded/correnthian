"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

// Count plus the live state breakdown — the queue is triaged by state, so the
// header carries the counters. No actions: requests are opened by accounts,
// never by the console.
export function RedemptionsHeader() {
  const { data: stats } = useApiQuery("GET /api/v1/redemptions/stats")

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Redemptions</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {stats ? `${stats.total} requests` : "…"}
          </Badge>
          {stats &&
            Object.entries(stats.byState).map(([state, count]: [string, number]) => (
              <Badge
                key={state}
                variant="outline"
                className="rounded-full px-2.5 py-0.5"
              >
                {state.replaceAll("_", " ")} · {count}
              </Badge>
            ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Physical-metal requests and where each sits in the fulfillment
          chain. State advances one legal edge at a time — the table offers
          only what the machine permits.
        </p>
      </div>
    </div>
  )
}
