"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

import { AssetCreateDialog } from "./asset-create-dialog"

// Count badge only: the registry list itself is the page, and stats travel
// on a separate endpoint so a stats failure must not blank the table.
export function AssetsHeader({ onRegistered }: { onRegistered?: () => void }) {
  const { data: stats } = useApiQuery("GET /api/v1/assets/stats")

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {stats ? `${stats.total} registered` : "…"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Token registry with backing disclosure. Registration, disabling and
          attestations are compliance- or admin-only. None of them move funds.
        </p>
      </div>

      <AssetCreateDialog onCreated={() => onRegistered?.()} />
    </div>
  )
}
