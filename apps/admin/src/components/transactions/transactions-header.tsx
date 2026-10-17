"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

// Count only — same arrangement as the users header. No actions: broadcast is
// system-side and transitions are account/node-driven, so there is nothing
// for a console button to call.
export function TransactionsHeader() {
  const { data: stats } = useApiQuery("GET /api/v1/transactions/stats")

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {stats ? `${stats.total} total` : "…"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Every signed intent across chains: lifecycle state, confirmation
          depth, and what may legally happen next. Read-only — movement is
          reported by accounts and nodes, never issued here.
        </p>
      </div>
    </div>
  )
}
