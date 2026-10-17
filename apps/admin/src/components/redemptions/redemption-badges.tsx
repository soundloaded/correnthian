import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"

// Same outline-badge idiom as the users badges; only the value set differs.
// Unknown values fall back to neutral: the API owns the state vocabulary and
// the console must not break when it grows. Terminal refusals and completions
// take their own tones — a rejected request is a decision someone may need to
// explain.
const stateStyles: Record<string, string> = {
  delivered:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  approved:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400",
  kyc_pending:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  in_production:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  shipped:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400",
  rejected:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  cancelled:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
}

function StyledBadge({
  value,
  styles,
}: {
  value: string
  styles: Record<string, string>
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        styles[value],
      )}
    >
      {value.replaceAll("_", " ")}
    </Badge>
  )
}

export function RedemptionStateBadge({ state }: { state: string }) {
  return <StyledBadge value={state} styles={stateStyles} />
}
