"use client"

import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"

// Testnet reads as its own network badge, separate from enabled/disabled
// (§6): a disabled mainnet and an enabled testnet are different facts and
// must never share one badge.
export function NetworkBadge({ isTestnet }: { isTestnet: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        isTestnet
          ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-400"
          : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400",
      )}
    >
      {isTestnet ? "testnet" : "mainnet"}
    </Badge>
  )
}

export function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        enabled
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
          : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
      )}
    >
      {enabled ? "enabled" : "disabled"}
    </Badge>
  )
}
