"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

// No invite action: the backend has no invite, reset, or email transport,
// so there is nothing for a button to call. The header states the count
// only — same arrangement as the team header, minus the action.
export function UsersHeader() {
  const { data: stats } = useApiQuery("GET /api/v1/users/stats")

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {stats ? `${stats.total} accounts` : "…"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Registered accounts, their KYC state, and who may operate. Role and
          status changes are admin-only and audited.
        </p>
      </div>
    </div>
  )
}
