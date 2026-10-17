"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

// Health counts in the header badge, when the health endpoint answers. A
// health failure names itself rather than blanking the page — the table
// below renders from the list endpoint independently (partial-read honesty).
export function ProvidersHeader() {
  const { data: health, isError } = useApiQuery("GET /api/v1/providers/health")

  const label = health
    ? `${health.providers.length} providers · ${health.counts.degraded ?? 0} degraded`
    : isError
      ? "health unavailable"
      : "…"

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Provider registry and health. Status changes are admin-only. No
          credentials are ever shown here — the registry never contains them.
        </p>
      </div>
    </div>
  )
}
