"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

// Count badge off the live list. The list endpoint returns the whole table
// with no stats sibling, so the count is derived — and labelled as the
// rows on this page, not a separate authority.
export function ChainsHeader({ count }: { count: number | null }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Chains</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {count === null ? "…" : `${count} configured`}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Configured networks. Enabling and disabling is admin-only and leaves
          balances untouched on-chain.
        </p>
      </div>
    </div>
  )
}

export function useChainsCount(): number | null {
  const { data } = useApiQuery("GET /api/v1/chains")
  return data ? data.length : null
}
