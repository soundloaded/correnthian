"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

// Count only — same arrangement as the users header. No actions: quotes are
// created by accounts and executed in wallets, so the console has nothing to
// issue.
export function QuotesHeader() {
  const { data: stats } = useApiQuery("GET /api/v1/swaps/quotes/stats")

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {stats ? `${stats.total} total` : "…"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Swap quotes and whether they can fill. Read-only — a quote is
          priced, then signed in the account holder's wallet, never here.
        </p>
      </div>
    </div>
  )
}
