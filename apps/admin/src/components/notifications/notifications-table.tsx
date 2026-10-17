"use client"

import {
  CircleAlertIcon,
  ClockIcon,
  MailCheckIcon,
} from "lucide-react"

import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@correnthian/ui/components/table"
import type { Contract } from "@correnthian/api-client"

export type NotificationRow = Contract<"GET /api/v1/notifications">["items"][number]

// Same arrangement as the users table: identity first, badges for the
// enumerated state, dates muted. No link column, no dismiss button — the
// row carries no entity pointer and no read/dismiss endpoint exists, so
// either would be decoration. Failed rows keep their error inline: the
// backend ships it so the console can say why, not just that.
export function NotificationsTable({ rows }: { rows: NotificationRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Notification</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Queued</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={row.state === "failed" ? "opacity-60" : ""}
              >
                <TableCell className="pl-4">
                  <div className="flex items-center gap-2.5">
                    <StateIcon state={row.state} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.template}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.channel}
                        {row.state === "failed" && row.error ? ` — ${row.error}` : ""}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <StateBadge state={row.state} />
                </TableCell>

                <TableCell className="text-sm">
                  {row.user.email}
                </TableCell>

                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(row.createdAt)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                The queue is clear — nothing pending, sent, or failed under
                this filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function StateIcon({ state }: { state: NotificationRow["state"] }) {
  const Icon =
    state === "pending" ? ClockIcon : state === "sent" ? MailCheckIcon : CircleAlertIcon
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        state === "pending" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        state === "sent" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        state === "failed" && "bg-red-500/10 text-red-600 dark:text-red-400",
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

// Failed takes the destructive tone: a failed notification is work someone
// must do something about. Pending is amber for the same reason. Sent is
// history and reads neutral.
function StateBadge({ state }: { state: NotificationRow["state"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        state === "pending" &&
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
        state === "failed" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
      )}
    >
      {state}
    </Badge>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
