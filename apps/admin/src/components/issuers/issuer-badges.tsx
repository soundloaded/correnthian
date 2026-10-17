"use client"

import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"

// Badge treatments for the issuer registry. Same outline-badge idiom as the
// users table. Unknown tiers fall back to neutral rather than crashing: the
// API owns this vocabulary and the console must not break when it grows.
const tierStyles: Record<string, string> = {
  issuer_verified:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  community_verified:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400",
  unverified:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
}

export function TierBadge({ tier }: { tier: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        tierStyles[tier],
      )}
    >
      {tier.replaceAll("_", " ")}
    </Badge>
  )
}

// A risk flag is a warning an operator must see, so it reads destructive —
// never grey. There is no remove endpoint, so flags only accumulate.
export function RiskFlagBadge({ flag }: { flag: string }) {
  return (
    <Badge
      variant="outline"
      className="rounded-md border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
    >
      {flag}
    </Badge>
  )
}
