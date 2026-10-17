"use client"

import { MoreHorizontalIcon, EyeIcon,
  DownloadIcon,
  RefreshCwIcon, } from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

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
// Live quote channels. The mock showed Outbound/Referral/Inbound/Partner
// dollars with previous-period deltas; the backend keeps no history, so
// the donut shows live quote counts per rail from
// GET /swaps/quotes/stats — percentages are of the live total, never a
// comparison against a period that does not exist.
// ---------------------------------------------------------------------------

const rails = [
  { key: "provider", label: "Provider", color: "#7c3aed" },
  { key: "dex", label: "DEX", color: "#22c55e" },
  { key: "cex", label: "CEX", color: "#3b82f6" },
  { key: "otc", label: "OTC", color: "#94a3b8" },
] as const

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name: string; value: number }[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs font-medium">{item.name}</p>
      <p className="text-xs text-muted-foreground">
        {item.value} quote{item.value === 1 ? "" : "s"}
      </p>
    </div>
  )
}

export function SourcedPipeline() {
  const { data: stats, refetch } = useApiQuery(
    "GET /api/v1/swaps/quotes/stats",
  )

  const byRail = stats?.byRail ?? {}
  const total = stats?.total ?? 0
  const slices = rails.map((rail) => ({
    ...rail,
    value: byRail[rail.key] ?? 0,
  }))
  const top = slices.reduce((a, b) => (a.value >= b.value ? a : b))

  return (
  <Card>
    <CardContent>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Quotes by Rail</p>

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
            <DropdownMenuItem className="gap-2" onClick={() => {}}>
              <EyeIcon className="size-4" />
              <span>View Details</span>
            </DropdownMenuItem>

            <DropdownMenuItem className="gap-2" onClick={() => {}}>
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

        <div className="mt-4 grid items-center gap-5 sm:grid-cols-[auto_1fr] sm:gap-6 lg:grid-cols-[auto_auto_1fr]">
          {/* Donut */}
          <div className="relative size-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={60}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {slices.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>

                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-muted-foreground">
                Quotes
              </span>

              <span className="text-lg font-semibold tabular-nums">
                {stats ? total : "—"}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="min-w-0 space-y-3">
            {slices.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />

                  <span className="text-sm">
                    {item.label}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="w-9 text-right text-sm font-medium tabular-nums">
                    {stats ? item.value : "—"}
                  </span>

                  <span className="flex w-12 items-center justify-end gap-0.5 text-xs font-medium text-muted-foreground">
                    {stats && total > 0
                      ? `${Math.round((item.value / total) * 100)}%`
                      : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Insight panel — desktop only */}
          <div className="hidden min-w-0 border-l pl-6 lg:flex lg:flex-col lg:justify-center">
            <p className="text-xs text-muted-foreground">
              Top rail
            </p>

            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {stats ? top.label : "—"}
            </p>

            <p className="mt-1 max-w-[220px] text-xs leading-5 text-muted-foreground">
              {stats && total > 0
                ? `${Math.round((top.value / total) * 100)}% of ${total} quotes.`
                : "No quotes yet."}
            </p>
          </div>
        </div>
    </CardContent>
  </Card>
)
}
