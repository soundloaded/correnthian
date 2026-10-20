"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

// Count only — same arrangement as the users header. No list-level actions:
// a transition belongs to one row, so it lives on that row's detail page.
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
          depth, and what may legally happen next. A stuck row is advanced
          from its own page.
        </p>
      </div>
    </div>
  )
}
