"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"
import { DiagnosticsBadge } from "./fee-badges"

// Rule count off the list, conflict state off diagnostics. Either endpoint
// may fail independently — a diagnostics failure names itself in the header
// instead of blanking the table (partial-read honesty).
export function FeesHeader({ shown }: { shown: number | null }) {
  const diagnostics = useApiQuery("GET /api/v1/fees/rules/diagnostics")

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Fee rules</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {shown === null ? "…" : `${shown} rules`}
          </Badge>
          {diagnostics.data ? (
            <DiagnosticsBadge clear={diagnostics.data.clear} />
          ) : diagnostics.isError ? (
            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
              diagnostics unavailable
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          The rate table every quote prices against. Reading it needs admin;
          changing it needs owner with a reason. A support session sees this
          page read-only.
        </p>
      </div>
    </div>
  )
}
