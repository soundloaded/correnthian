"use client"

import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"

// Badge treatments for the wallet registry. Same outline-badge idiom as the
// users table. An undeployed smart account exists nowhere on-chain, so it
// reads "not yet" with the amber tone — never grey, never "pending".
export function KindBadge({ kind }: { kind: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        kind === "smart"
          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400"
          : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
      )}
    >
      {kind}
    </Badge>
  )
}

export function DeployBadge({ kind, deployed }: { kind: string; deployed: boolean }) {
  const live = kind !== "smart" || deployed
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        live
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
      )}
    >
      {live ? "live" : "not yet"}
    </Badge>
  )
}

export function PrimaryBadge({ isPrimary }: { isPrimary: boolean }) {
  if (!isPrimary) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <Badge
      variant="outline"
      className="rounded-md border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-400"
    >
      primary
    </Badge>
  )
}
