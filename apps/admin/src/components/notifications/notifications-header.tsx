"use client"

import { BellIcon } from "lucide-react"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

// Header with the queue counters. The badge total is what needs someone,
// not what exists: pending rows awaiting delivery plus failed rows awaiting
// attention. Sent rows are history, not work.
export function NotificationsHeader() {
  const { data: stats } = useApiQuery("GET /api/v1/notifications/stats")
  const attention = stats ? stats.pending + stats.failed : null

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {attention === null ? "…" : `${attention} needing attention`}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Every queued notification, newest first. Rows are terminal: a
          notification carries no entity pointer, only a template and an
          account, and there is no read or dismiss endpoint — nothing here
          marks anything read.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BellIcon className="size-4" />
        {stats
          ? `${stats.pending} pending · ${stats.sent} sent · ${stats.failed} failed`
          : "Loading queue counters…"}
      </div>
    </div>
  )
}
