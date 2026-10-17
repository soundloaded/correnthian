"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

// Count badge only: the registry list itself is the page, and stats travel
// on a separate endpoint so a stats failure must not blank the table.
export function IssuersHeader() {
  const { data: stats } = useApiQuery("GET /api/v1/issuers/stats")

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Issuers</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {stats ? `${stats.total} registered` : "…"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Issuer registry and verification tiers. Tier, licence, and risk-flag
          changes are compliance-only and audited.
        </p>
      </div>
    </div>
  )
}
