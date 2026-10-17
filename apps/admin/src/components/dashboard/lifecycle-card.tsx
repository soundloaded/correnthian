"use client"

import { DownloadIcon, EyeIcon, MoreHorizontalIcon, RefreshCwIcon } from "lucide-react"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@correnthian/ui/components/dropdown-menu"
import { useApiQuery } from "@/lib/use-api-query"

// ---------------------------------------------------------------------------
// Live KYC pipeline. The mock showed CRM contact stages with invented
// counts; the bars now show live account counts per KYC status from
// GET /users/stats — the same bar arrangement, real funnel.
// ---------------------------------------------------------------------------

const stages = [
  { key: "not_started", name: "Not Started", color: "#94a3b8" },
  { key: "pending", name: "Pending", color: "#fbbf24" },
  { key: "approved", name: "Approved", color: "#34d399" },
  { key: "rejected", name: "Rejected", color: "#f87171" },
  { key: "expired", name: "Expired", color: "#c4b5fd" },
] as const

export function LifecycleCard() {
  const { data, refetch } = useApiQuery("GET /api/v1/users/stats")

  const byKyc = data?.byKyc ?? {}
  const rows = stages.map((s) => ({ ...s, value: byKyc[s.key] ?? 0 }))
  const max = Math.max(1, ...rows.map((r) => r.value))

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">KYC Pipeline</p>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                />
              }
            >
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44 rounded-xl p-2">
              <DropdownMenuItem className="gap-2">
                <EyeIcon className="size-4" />
                <span>View Details</span>
              </DropdownMenuItem>

              <DropdownMenuItem className="gap-2">
                <DownloadIcon className="size-4" />
                <span>Export Data</span>
              </DropdownMenuItem>

              <DropdownMenuItem className="gap-2" onClick={() => refetch()}>
                <RefreshCwIcon className="size-4" />
                <span>Refresh</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Rows */}
        <div className="mt-4 space-y-2.5">
          {rows.map((stage) => (
            <div key={stage.key} className="flex items-center gap-3">
              <div className="flex w-28 shrink-0 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />

                <span className="truncate text-xs font-medium">
                  {stage.name}
                </span>
              </div>

              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(stage.value / max) * 100}%`,
                    backgroundColor: stage.color,
                  }}
                />
              </div>

              <span className="w-6 shrink-0 text-right text-sm font-medium tabular-nums text-muted-foreground">
                {data ? stage.value : "—"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
