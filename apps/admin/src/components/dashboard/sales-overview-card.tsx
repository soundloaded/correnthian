"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts"

import { Button } from "@correnthian/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@correnthian/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@correnthian/ui/components/dropdown-menu"
import { useApiQuery } from "@/lib/use-api-query"

// ---------------------------------------------------------------------------
// Live settlement volume. The mock showed sales revenue by week/month/year
// with previous-period deltas; the backend keeps no sales ledger, so the
// chart shows settled transaction volume per day from
// GET /transactions/daily — real flow, real window, no invented trend.
// ---------------------------------------------------------------------------

const windows = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; dataKey: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  const row = payload[0]
  return (
    <div className="rounded-lg bg-foreground px-3 py-2 text-background shadow-lg">
      <p className="text-xs text-background/70">{label}</p>
      <p className="text-sm font-semibold">
        {row.dataKey === "volumeUsd"
          ? `$${row.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          : `${row.value} tx`}
      </p>
    </div>
  )
}

function formatTotal(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function SalesOverviewCard() {
  const [days, setDays] = React.useState<number>(30)

  const { data: series } = useApiQuery(
    "GET /api/v1/transactions/daily",
    undefined,
    { days },
  )

  const points = (series ?? []).map((d) => ({
    ...d,
    label: formatDay(d.date),
  }))
  const total = points.reduce((n, p) => n + p.volumeUsd, 0)
  // `count` is every transaction created in the window, in any state; only
  // `volumeUsd` is limited to confirmed ones. So the count is not a settled
  // count — labelling it as one made a window of expired transactions read
  // as settled volume.
  const count = points.reduce((n, p) => n + p.count, 0)
  const current = windows.find((w) => w.days === days)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Settlement Volume</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {series ? formatTotal(total) : "—"}
            </p>
            <span className="text-xs font-medium text-muted-foreground">
              {series ? `${count} transactions in window` : ""}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="gap-1.5" />}
          >
            {current?.label}
            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {windows.map((w) => (
              <DropdownMenuItem key={w.days} onClick={() => setDays(w.days)}>
                {w.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={145}>
          <AreaChart data={points} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--border)"
            />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              dy={8}
            />

            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
            />

            <Area
              type="monotone"
              dataKey="volumeUsd"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#revenueFill)"
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
