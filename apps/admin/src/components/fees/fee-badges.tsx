"use client"

import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"

// Badge treatments for the fee table. Same outline-badge idiom as the users
// table. Inactive rules dim in the table; the badge itself stays neutral —
// inactivity is a state, not a warning.
export function OperationBadge({ operation }: { operation: string }) {
  return (
    <Badge
      variant="outline"
      className="rounded-md border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400"
    >
      {operation}
    </Badge>
  )
}

export function KindBadge({ kind }: { kind: string }) {
  const styles: Record<string, string> = {
    network:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
    provider:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-400",
    correnthian:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  }
  return (
    <Badge
      variant="outline"
      className={cn("rounded-md px-2 py-0.5 text-xs font-medium", styles[kind])}
    >
      {kind}
    </Badge>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
          : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
      )}
    >
      {active ? "active" : "inactive"}
    </Badge>
  )
}

// A conflicting rule pair refuses quotes at quote time rather than picking
// one — so a non-clear diagnostic reads destructive. It is the state the
// operator must resolve before a customer trips over it.
export function DiagnosticsBadge({ clear }: { clear: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        clear
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
      )}
    >
      {clear ? "clear" : "conflicts"}
    </Badge>
  )
}
