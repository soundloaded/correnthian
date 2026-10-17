"use client"

import {
  CalendarIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"
import { Button } from "@correnthian/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
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
// Live verification queue. The mock showed a sales rep's calendar; the
// backend has no tasks model, so this slot shows what actually waits on a
// human: verification profiles parked for a decision, oldest first, from
// GET /compliance/reviews. Same rows-and-count arrangement, real work.
// Decisions themselves belong on the compliance page, not a dashboard
// checkbox — rows are read-only here.
// ---------------------------------------------------------------------------

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function UpcomingTasksCard() {
  const { data: queue, refetch } = useApiQuery(
    "GET /api/v1/compliance/reviews",
  )

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">Verification Queue</p>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {queue ? `${queue.length} awaiting` : "—"}
          </span>
        </div>

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
            <DropdownMenuItem className="gap-2" onClick={() => refetch()}>
              <RefreshCwIcon className="size-4" />
              <span>Refresh</span>
            </DropdownMenuItem>

            <DropdownMenuItem className="gap-2">
              <CalendarIcon className="size-4" />
              <span>View Calendar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        <div className="divide-y">
          {queue?.map((item) => {
            const hit = item.sanctionsResult === "hit"
            const Icon = hit ? ShieldAlertIcon : ShieldCheckIcon

            return (
              <div key={item.userId} className="group flex items-center gap-3 py-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    hit
                      ? "bg-red-50 text-red-600 dark:bg-red-500/10"
                      : "bg-blue-50 text-blue-600 dark:bg-blue-500/10",
                  )}
                >
                  <Icon className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.provider} · {formatWhen(item.updatedAt)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium",
                      hit
                        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
                    )}
                  >
                    {hit ? "Sanctions hit" : item.status}
                  </Badge>
                </div>
              </div>
            )
          })}

          {queue && queue.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Queue is clear. Nothing awaiting review.
            </p>
          )}

          {!queue && (
            <p className="py-6 text-center text-sm text-muted-foreground">—</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="border-t bg-background">
        <Button
          variant="outline"
          className="w-full gap-1.5"
          onClick={() => refetch()}
        >
          <RefreshCwIcon className="size-3.5" />
          Refresh queue
        </Button>
      </CardFooter>
    </Card>
  )
}
