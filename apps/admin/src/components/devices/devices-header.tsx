"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

// Stale means active but unseen in 90 days — worth surfacing as possible
// cleanup, not as failure. Revoked stays in the header count so the
// operator can see the trail survives; the rows themselves render dimmed.
export function DevicesHeader() {
  const { data: stats } = useApiQuery("GET /api/v1/devices/stats")

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {stats ? `${stats.total} trusted` : "…"}
          </Badge>
          {stats && stats.revoked > 0 && (
            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
              {stats.revoked} revoked
            </Badge>
          )}
          {stats && stats.stale > 0 && (
            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
              {stats.stale} stale
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Trusted devices across all accounts. A row records a public key and
          platform — never key material — and proves nothing about custody.
          Revoked rows stay visible so a revocation stays verifiable.
        </p>
      </div>
    </div>
  )
}
