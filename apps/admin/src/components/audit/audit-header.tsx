"use client"

import { Badge } from "@correnthian/ui/components/badge"

// No pagination controls: the list endpoint takes a limit and no cursor,
// so the page caps at 200 (the server's max) and says so outright —
// silently truncating a trail an operator believes they are seeing whole
// would be worse than paging would be convenient.
export function AuditHeader({ shown }: { shown: number | null }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Audit</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {shown === null ? "…" : `newest ${shown} shown · capped at 200`}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          The append-only trail, newest first. Narrow by action, outcome, or
          request ID to investigate. Denied actions render destructive: a
          refusal may need explaining.
        </p>
      </div>
    </div>
  )
}
