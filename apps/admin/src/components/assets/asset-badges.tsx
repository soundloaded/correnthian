"use client"

import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"

// Badge treatments for the asset registry. Same outline-badge idiom as the
// users table; only the value sets differ. `synthetic` and `never attested`
// are product claims an operator must act on, so they take the destructive
// tone rather than grey text (§6).
const custodyStyles: Record<string, string> = {
  allocated:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  unallocated:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  synthetic:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
}

const tierStyles: Record<string, string> = {
  "issuer-verified":
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  issuer_verified:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  "community-verified":
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400",
  community_verified:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400",
}

function StyledBadge({
  value,
  styles,
  destructive,
}: {
  value: string
  styles?: Record<string, string>
  destructive?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        destructive
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
          : styles?.[value],
      )}
    >
      {value.replaceAll("_", " ").replaceAll("-", " ")}
    </Badge>
  )
}

export function CustodyBadge({ model }: { model: string }) {
  return <StyledBadge value={model} styles={custodyStyles} />
}

export function TierBadge({ tier }: { tier: string }) {
  return <StyledBadge value={tier} styles={tierStyles} />
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

// A missing attestation is not "unknown" grey: an unattested metal claim is
// the state the operator must act on, so it reads destructive.
export function AttestationBadge({ lastAttestation }: { lastAttestation: string | null }) {
  if (!lastAttestation) {
    return <StyledBadge value="never attested" destructive />
  }
  return <StyledBadge value={formatFreshness(lastAttestation)} />
}

function formatFreshness(value: string): string {
  const at = Date.parse(value)
  if (Number.isNaN(at)) return "attested"
  const days = Math.floor((Date.now() - at) / 86_400_000)
  if (days < 0) return "attested"
  if (days === 0) return "attested today"
  if (days === 1) return "attested yesterday"
  return `attested ${days}d ago`
}
