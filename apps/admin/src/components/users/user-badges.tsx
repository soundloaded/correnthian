import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"

// Badge treatments shared by the users table and the detail header. Same
// outline-badge idiom as the contacts table; only the value sets differ.
// Unknown values fall back to neutral rather than crashing: the API owns
// these vocabularies and the console must not break when one grows.
const roleStyles: Record<string, string> = {
  owner:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-400",
  admin:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400",
}

const kycStyles: Record<string, string> = {
  approved:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  pending:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  rejected:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  expired:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
}

const statusStyles: Record<string, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  suspended:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  closed:
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

export function RoleBadge({ role }: { role: string }) {
  return <StyledBadge value={role} styles={roleStyles} />
}

export function KycBadge({ status }: { status: string }) {
  return <StyledBadge value={status} styles={kycStyles} />
}

export function AccountStatusBadge({ status }: { status: string }) {
  return <StyledBadge value={status} styles={statusStyles} />
}
