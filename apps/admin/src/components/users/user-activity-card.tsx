"use client"

import { Clock3Icon } from "lucide-react"

import { cn } from "@correnthian/ui/lib/utils"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { useApiQuery } from "@/lib/use-api-query"

// First surfacing of GET /audit/actor/:actorId: everything one actor did,
// newest first. The endpoint needs the compliance role, so a support
// operator sees the refusal stated rather than an empty list that reads
// as "this account did nothing". No tasks section: contact tasks were
// mock data with no backend behind them.
export function UserActivityCard({ userId }: { userId: string }) {
  const { data, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/audit/actor/:actorId",
    { actorId: userId },
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock3Icon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Activity</p>
        </div>
        {data && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {data.length} total
          </span>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading activity…</p>
        ) : isError ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Activity is not visible to your role — the audit trail needs
              the compliance role. This is a permission boundary, not an
              empty history.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm font-medium hover:underline"
            >
              Retry
            </button>
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No audit entries for this account.
          </p>
        ) : (
          <div className="divide-y">
            {data.map((entry) => (
              <div
                key={entry.id}
                className="flex gap-3 py-4 first:pt-2 last:pb-1"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    entry.outcome === "denied"
                      ? "bg-destructive"
                      : entry.outcome === "failure"
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-medium">{entry.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {[entry.targetType, entry.targetId, entry.outcome]
                      .filter(Boolean)
                      .join(" · ")}
                    {entry.reason ? ` — ${entry.reason}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
