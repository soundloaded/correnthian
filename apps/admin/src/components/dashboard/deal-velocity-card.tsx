"use client"

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardHeader,
} from "@correnthian/ui/components/card"
import { useApiQuery } from "@/lib/use-api-query"

// ---------------------------------------------------------------------------
// Colors — single source of truth, legend dots pull from the same values as bars
// ---------------------------------------------------------------------------

const stageColors = {
  open: "color-mix(in srgb, var(--primary) 35%, transparent)",
  flight: "color-mix(in srgb, var(--primary) 65%, transparent)",
  settled: "var(--primary)",
  lost: "var(--muted-foreground)",
} as const

const legend = [
  { key: "open", label: "Open" },
  { key: "flight", label: "In Flight" },
  { key: "settled", label: "Settled" },
  { key: "lost", label: "Unsuccessful" },
] as const

// ---------------------------------------------------------------------------
// Live quote funnel. The mock showed week/month/year series with
// previous-period deltas; the backend keeps no history, so this is one
// stacked bar of live counts from GET /swaps/quotes/stats — the funnel as
// it stands right now, not a trend.
// ---------------------------------------------------------------------------

function StageTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; dataKey: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-xs">
          {entry.dataKey}: <span className="font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

export function DealVelocityCard() {
  const { data: stats } = useApiQuery("GET /api/v1/swaps/quotes/stats")

  const byState = stats?.byState ?? {}
  const open = (byState.quoted ?? 0) + (byState.awaiting_payment ?? 0)
  const flight = byState.broadcast ?? 0
  const settled = byState.settled ?? 0
  const lost = (byState.failed ?? 0) + (byState.expired ?? 0)
  const total = stats?.total ?? 0
  const settledRate =
    total > 0 ? Math.round((settled / total) * 100) : null

  const data = [{ label: "Quotes", open, flight, settled, lost }]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <p className="text-sm font-semibold">Quote Funnel</p>

        <div className="flex items-center gap-3">
          {legend.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: stageColors[item.key] }}
              />
              <span className="text-xs text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Value row (horizontal) */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {settledRate === null ? "—" : `${settledRate}%`}
            </p>
            <span className="text-xs font-medium text-muted-foreground">
              settled · {total} quotes total
            </span>
          </div>
        </div>

        {/* Stacked funnel bar */}
        <div className="mt-3 h-44 sm:h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={20} barGap={2} barCategoryGap="30%">
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                content={<StageTooltip />}
                cursor={{ fill: "var(--muted)", opacity: 0.3 }}
              />
              <Bar
                dataKey="open"
                stackId="stage"
                fill={stageColors.open}
                radius={[0, 0, 4, 4]}
              />
              <Bar
                dataKey="flight"
                stackId="stage"
                fill={stageColors.flight}
              />
              <Bar
                dataKey="settled"
                stackId="stage"
                fill={stageColors.settled}
              />
              <Bar
                dataKey="lost"
                stackId="stage"
                fill={stageColors.lost}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
