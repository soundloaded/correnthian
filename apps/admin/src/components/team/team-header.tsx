"use client"

import { BellRingIcon } from "lucide-react"

import { Badge } from "@correnthian/ui/components/badge"
import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"

// No invite action, deliberately: the backend has no invite, reset, or
// email transport, so there is nothing for a button to call (backend gap
// 2). The header states the count only — same arrangement as before,
// minus the action that would call nothing.
export function TeamHeader({ onNavigate }: { onNavigate: () => void }) {
  const { data: stats } = useApiQuery("GET /api/v1/users/stats")

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {stats ? `${stats.total} operators` : "…"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Operator accounts and who may do what. Role and status changes are
          admin-only and audited.
        </p>
      </div>

      <Button variant="outline" onClick={onNavigate} className="gap-2">
        <BellRingIcon className="h-4 w-4" />
        All accounts
      </Button>
    </div>
  )
}
