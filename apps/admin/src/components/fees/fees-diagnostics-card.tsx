"use client"

import { TriangleAlertIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { useApiQuery } from "@/lib/use-api-query"
import { Button } from "@correnthian/ui/components/button"

// Ambiguous rule pairs: both can apply, neither wins, and the resolver
// refuses those pairs at quote time rather than picking one. This card is
// the same set surfaced before a customer trips over it — so a non-clear
// diagnostic is the page's most actionable panel, not a footnote.
export function FeesDiagnosticsCard() {
  const { data, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/fees/rules/diagnostics",
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <TriangleAlertIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Diagnostics</p>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Checking rule pairs…</p>
        ) : isError || !data ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              Diagnostics did not answer — the table above may still hold
              conflicting pairs. This is not an all-clear.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : data.clear ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Clear — {data.ruleCount} rules, no ambiguous pairs.
            </p>
            <p className="text-xs text-muted-foreground">{data.note}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p role="alert" className="text-sm font-medium text-destructive">
              {data.conflicts.length} ambiguous pair
              {data.conflicts.length === 1 ? "" : "s"} — quotes matching both
              sides refuse rather than guess.
            </p>
            <div className="space-y-2">
              {data.conflicts.map((conflict, index) => (
                <div
                  key={`${conflict.operation}-${conflict.kind}-${index}`}
                  className="rounded-lg border border-destructive/30 p-3"
                >
                  <p className="text-sm font-medium">
                    {conflict.operation} · {conflict.kind}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {conflict.ruleIds.join(" ↔ ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {conflict.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
