"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@correnthian/ui/lib/utils"
import { Button } from "@correnthian/ui/components/button"
import { Badge } from "@correnthian/ui/components/badge"
import { Card, CardContent } from "@correnthian/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@correnthian/ui/components/dropdown-menu"
import { useApiQuery } from "@/lib/use-api-query"

// ---------------------------------------------------------------------------
// Data — live redemption ops. The mock showed pipeline value, conversion
// rate and deal cycle with previous-period deltas; the backend keeps no
// previous periods, so every figure here is a count straight from
// GET /redemptions/stats — never an invented comparison.
// ---------------------------------------------------------------------------

const stateFilters = [
  "All States",
  "requested",
  "kyc_pending",
  "approved",
  "in_production",
  "shipped",
  "delivered",
  "rejected",
  "cancelled",
] as const
type StateFilter = (typeof stateFilters)[number]

const stateClass: Record<string, string> = {
  requested:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400",
  kyc_pending:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-400",
  approved:
    "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-400",
  in_production:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  shipped:
    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-400",
  delivered:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  rejected:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-400",
  cancelled:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
}

function formatState(state: string) {
  return state
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ")
}

// ---------------------------------------------------------------------------
// Radial progress ring (pure SVG, no chart lib needed)
// ---------------------------------------------------------------------------

function FulfilmentRing({ percent }: { percent: number | null }) {
  const shown = percent ?? 0
  const size = 96
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (shown / 100) * circumference

  return (
    <div className="relative flex size-24 shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-semibold">
          {percent === null ? "—" : `${percent}%`}
        </span>
        <span className="text-[10px] text-muted-foreground">fulfilled</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component — same two-column split, now redemption ops
// ---------------------------------------------------------------------------

export function PipelinePulseCard() {
  const [filter, setFilter] = React.useState<StateFilter>("All States")

  const { data: stats } = useApiQuery("GET /api/v1/redemptions/stats")
  const { data: queue } = useApiQuery(
    "GET /api/v1/redemptions",
    undefined,
    filter === "All States" ? { limit: 3 } : { limit: 3, state: filter },
  )

  const byState = stats?.byState ?? {}
  const awaiting = (byState.requested ?? 0) + (byState.kyc_pending ?? 0)
  const inFulfilment =
    (byState.approved ?? 0) +
    (byState.in_production ?? 0) +
    (byState.shipped ?? 0)
  const fulfilled =
    stats && stats.total > 0
      ? Math.round(((byState.delivered ?? 0) / stats.total) * 100)
      : null

  const rows = [
    {
      label: "Redemption Requests",
      value: stats ? String(stats.total) : null,
    },
    { label: "Awaiting Review", value: stats ? String(awaiting) : null },
    { label: "In Fulfilment", value: stats ? String(inFulfilment) : null },
  ]

  return (
    <Card>
      <CardContent>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold">Redemption Pulse</p>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-medium"
                />
              }
            >
              {filter === "All States" ? filter : formatState(filter)}
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {stateFilters.map((s) => (
                <DropdownMenuItem key={s} onClick={() => setFilter(s)}>
                  {s === "All States" ? s : formatState(s)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Split layout: fulfilment ring (left) + stat list (right) */}
        <div className="mt-5 flex items-center gap-6">
          <FulfilmentRing percent={fulfilled} />

          <div className="flex flex-1 flex-col gap-3 border-l pl-6">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="text-sm font-semibold tabular-nums">
                  {row.value ?? "—"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t" />

        {/* Redemption queue instead of the mock deal list */}
        <div className="mt-4 bg-muted/50 p-3 rounded-lg">
          <p className="text-base font-semibold">Redemptions in Motion</p>

          <div className="mt-3 space-y-1 mb-2">
            {queue?.items.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md px-2 py-1 -mx-2 hover:bg-background"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {r.asset.symbol} · {r.provider.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(r.requestedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-24 justify-center rounded-md px-2 py-0.5 text-xs font-medium",
                      stateClass[r.state],
                    )}
                  >
                    {formatState(r.state)}
                  </Badge>
                </div>
              </div>
            ))}
            {queue && queue.items.length === 0 && (
              <p className="px-2 py-1 text-sm text-muted-foreground">
                No redemptions in this state.
              </p>
            )}
            {!queue && (
              <p className="px-2 py-1 text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
