import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"

// Same outline-badge idiom as the users badges; only the value sets differ.
// Unknown values fall back to neutral: the API owns these vocabularies and
// the console must not break when one grows.
const stateStyles: Record<string, string> = {
  settled:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  quoted:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400",
  awaiting_payment:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  broadcast:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  failed:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  expired:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
}

const qualityStyles: Record<string, string> = {
  deep:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  thin:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  none:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
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

export function QuoteStateBadge({ state }: { state: string }) {
  return <StyledBadge value={state} styles={stateStyles} />
}

export function RailKindBadge({ kind }: { kind: string }) {
  return <StyledBadge value={kind} styles={{}} />
}

export function ExecutionQualityBadge({ quality }: { quality: string }) {
  return <StyledBadge value={quality} styles={qualityStyles} />
}
