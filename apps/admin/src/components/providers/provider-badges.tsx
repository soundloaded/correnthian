"use client"

import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"

// Status treatments. `degraded` takes the destructive tone, not grey: a
// degraded rail is still offered to users, so it is the state an operator
// must act on (§6). Unknown values fall back to neutral rather than
// crashing — the API owns this vocabulary.
const statusStyles: Record<string, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  disabled:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
}

export function ProviderStatusBadge({ status }: { status: string }) {
  const destructive = status === "degraded"
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        destructive
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
          : statusStyles[status],
      )}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  )
}

// A provider never checked reads destructive too (§6): no freshness signal
// means the status column cannot be trusted, which is itself actionable.
export function FreshnessBadge({ lastCheckedAt }: { lastCheckedAt: string | null }) {
  if (!lastCheckedAt) {
    return (
      <Badge
        variant="outline"
        className="rounded-md border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
      >
        never checked
      </Badge>
    )
  }
  return (
    <span className="text-sm text-muted-foreground">
      {formatFreshness(lastCheckedAt)}
    </span>
  )
}

function formatFreshness(value: string): string {
  const at = Date.parse(value)
  if (Number.isNaN(at)) return "checked"
  const minutes = Math.floor((Date.now() - at) / 60_000)
  if (minutes < 0) return "checked"
  if (minutes < 1) return "checked just now"
  if (minutes < 60) return `checked ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `checked ${hours}h ago`
  return `checked ${Math.floor(hours / 24)}d ago`
}
