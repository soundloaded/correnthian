"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import { useUserLedger } from "./use-user-ledger"

// Money in vs money out over time, from the same rows the ledger above
// renders — one request, two views. Buckets are per day, newest last, so the
// shape reads left-to-right like the dashboard's settlement chart. The sums
// use `amountUsd` only where it exists; a row without a dollar figure is a
// row with no price, not a zero — counting it as zero would invent flow.
export function UserFlowChart({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useUserLedger(userId)

  const points = React.useMemo(() => {
    const rows = data?.items ?? []
    if (rows.length === 0) return []
    const buckets = new Map<string, { inflow: number; outflow: number }>()
    for (const tx of [...rows].reverse()) {
      const day = tx.createdAt.slice(0, 10)
      const bucket = buckets.get(day) ?? { inflow: 0, outflow: 0 }
      const usd = tx.amountUsd ?? 0
      if (tx.direction === "in") bucket.inflow += usd
      else if (tx.direction === "out") bucket.outflow += usd
      buckets.set(day, bucket)
    }
    return [...buckets.entries()].map(([day, bucket]) => ({
      ...bucket,
      day,
      label: formatDay(day),
    }))
  }, [data])

  const totals = React.useMemo(() => {
    const rows = data?.items ?? []
    let inflow = 0
    let outflow = 0
    let unpriced = 0
    for (const tx of rows) {
      if (tx.amountUsd === null) {
        unpriced += 1
        continue
      }
      if (tx.direction === "in") inflow += tx.amountUsd
      else if (tx.direction === "out") outflow += tx.amountUsd
    }
    return { inflow, outflow, unpriced }
  }, [data])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <p className="text-sm font-semibold">Money flow</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {data ? (
              <>
                <span className="text-xs text-muted-foreground">
                  in{" "}
                  <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                    {formatMoney(totals.inflow)}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  out{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatMoney(totals.outflow)}
                  </span>
                </span>
                {totals.unpriced > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {totals.unpriced} unpriced
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                In vs out per day
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading flow…</p>
        ) : isError || !data ? (
          <p className="text-sm text-muted-foreground">
            Flow is unavailable — the ledger above holds the record.
          </p>
        ) : points.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No movement to chart yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={points} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="userFlowIn" x1="0" y1="0" x2="0" y2="1">
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
                content={<FlowTooltip />}
                cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
              />

              <Area
                type="monotone"
                dataKey="inflow"
                name="In"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#userFlowIn)"
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="outflow"
                name="Out"
                stroke="var(--muted-foreground)"
                strokeWidth={2}
                fill="transparent"
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

function FlowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-foreground px-3 py-2 text-background shadow-lg">
      <p className="text-xs text-background/70">{label}</p>
      {payload.map((row) => (
        <p key={row.name} className="text-sm font-semibold">
          {row.name}: {formatMoney(row.value)}
        </p>
      ))}
    </div>
  )
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

function formatDay(isoDay: string): string {
  return new Date(`${isoDay}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}
