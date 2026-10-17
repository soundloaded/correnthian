"use client"

import * as React from "react"
import {
  BellIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ClockIcon,
  MailCheckIcon,
} from "lucide-react"

import { cn } from "@correnthian/ui/lib/utils"
import { Button } from "@correnthian/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@correnthian/ui/components/dropdown-menu"
import { ScrollArea } from "@correnthian/ui/components/scroll-area"
import { formatDistanceToNow } from "date-fns"
import { useApiQuery } from "@/lib/use-api-query"

/**
 * Live operator queue: `GET /notifications` (latest 8) plus
 * `GET /notifications/stats` for the badge.
 *
 * Two honest limits, both backend-shaped. There is no per-item
 * read/dismiss endpoint, so nothing here marks anything read — the local
 * mark-read and remove buttons the mock shipped with were client-side
 * theatre over rows the server still calls pending, and they were cut.
 * And a notification carries no entity pointer, only a template name and
 * a user email, so rows are terminal: they state what queued and for
 * whom rather than linking somewhere that cannot act on them.
 */

type QueueState = "pending" | "sent" | "failed"

const stateStyle: Record<QueueState, { icon: React.ElementType; className: string }> = {
  pending: { icon: ClockIcon, className: "text-amber-600 bg-amber-50 dark:bg-amber-500/10" },
  sent: { icon: MailCheckIcon, className: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
  failed: { icon: CircleAlertIcon, className: "text-red-600 bg-red-50 dark:bg-red-500/10" },
}

function timeAgo(iso: string): string {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return iso
  return formatDistanceToNow(at, { addSuffix: true })
}

type QueueItem = {
  id: string
  createdAt: string
  channel: string
  template: string
  state: QueueState
  error: string | null
  user: { id: string; email: string }
}

function NotificationRow({ item }: { item: QueueItem }) {
  const { icon: Icon, className } = stateStyle[item.state]

  return (
    <div className="flex gap-3 px-3 py-3">
      <span
        className={cn(
          "mt-2 size-1.5 shrink-0 rounded-full",
          item.state === "pending" ? "bg-primary" : "bg-transparent",
        )}
      />

      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          className,
        )}
      >
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium">{item.template}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.channel} · {item.state}
          {item.state === "failed" && item.error ? ` — ${item.error}` : ""}
          {" · "}
          {item.user.email}
        </p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {timeAgo(item.createdAt)}
        </p>
      </div>
    </div>
  )
}

export function HeaderNotifications() {
  const list = useApiQuery("GET /api/v1/notifications", undefined, { limit: 8 })
  const stats = useApiQuery("GET /api/v1/notifications/stats")

  // The badge counts what the operator has not yet acted on. The API keeps
  // no per-operator read state, so "unread" is the queue depth, not a
  // per-row flag — pending rows awaiting delivery, plus failed rows
  // awaiting someone's attention.
  const unread = stats.data ? stats.data.pending + stats.data.failed : 0
  const items = list.data?.items ?? []

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative size-8"
            aria-label={unread > 0 ? `Notifications, ${unread} needing attention` : "Notifications"}
          >
            <BellIcon className="size-4" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
            )}
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-88 p-0" sideOffset={6}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="m-0" />

        <ScrollArea className="h-[420px]">
          {list.isPending || stats.isPending ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Loading notifications…
            </p>
          ) : list.isError || stats.isError ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              The notification queue could not be reached.
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              The queue is empty — nothing pending, sent, or failed.
            </p>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <NotificationRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </ScrollArea>

        <DropdownMenuSeparator className="m-0" />

        <DropdownMenuGroup>
          <DropdownMenuItem className="justify-center gap-1.5 py-2.5 text-sm font-medium">
            View all notifications
            <ChevronRightIcon className="size-3.5" />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
