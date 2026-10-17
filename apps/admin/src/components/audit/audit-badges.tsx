"use client"

import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"

// `denied` is the only outcome that takes the destructive tone — a denied
// action is a refusal someone may need to explain. Failures are amber: they
// are outages, not accusations.
export function OutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === "denied") {
    return (
      <Badge variant="destructive" className="rounded-md px-2 py-0.5 text-xs font-medium">
        denied
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        outcome === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
        outcome === "failure" &&
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
      )}
    >
      {outcome}
    </Badge>
  )
}
