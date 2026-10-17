"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { useApiQuery } from "@/lib/use-api-query"

// No action affordance: there is no decide endpoint for rules, and the
// PATCH lives in a per-row dialog. The header states the queue count and
// the rules count only.
export function ComplianceHeader({ queueCount }: { queueCount: number | null }) {
  const { data: rules } = useApiQuery("GET /api/v1/compliance/rules")

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {queueCount === null ? "…" : `${queueCount} awaiting review`}
          </Badge>
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
            {rules ? `${rules.length} jurisdiction rules` : "…"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Verification profiles awaiting a human decision, oldest first, and
          the jurisdiction rules that decide what each location may do.
          Decisions are compliance-gated; rule edits are admin-only and audited.
        </p>
      </div>
    </div>
  )
}
