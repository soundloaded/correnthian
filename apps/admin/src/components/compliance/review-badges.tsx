"use client"

import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"

// Badge treatments for the reviews queue. A sanctions hit takes the
// destructive tone: it freezes the account pending a human, so it is the
// state an operator must act on first — never grey text.
export function SanctionsBadge({ result }: { result: string | null }) {
  if (result === "hit") {
    return (
      <Badge variant="destructive" className="rounded-md px-2 py-0.5 text-xs font-medium">
        sanctions hit
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        result === "clean" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
      )}
    >
      {result ?? "unscreened"}
    </Badge>
  )
}

const kycStyles: Record<string, string> = {
  pending:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  approved:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  rejected:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
}

export function ReviewStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-md px-2 py-0.5 text-xs font-medium", kycStyles[status])}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  )
}
