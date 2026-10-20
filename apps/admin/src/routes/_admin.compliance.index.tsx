import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { ComplianceHeader } from "@/components/compliance/compliance-header"
import { DecideDialogRoot } from "@/components/compliance/decide-dialog"
import { ReviewsTable } from "@/components/compliance/reviews-table"
import type { ReviewRow } from "@/components/compliance/reviews-table"
import { RuleEditDialogRoot } from "@/components/compliance/rule-edit-dialog"
import { RulesTable } from "@/components/compliance/rules-table"
import type { RuleRow } from "@/components/compliance/rules-table"
import { useApiQuery } from "@/lib/use-api-query"
import { getSession } from "@/lib/auth"
import { rankAtLeast } from "@/lib/roles"

export const Route = createFileRoute("/_admin/compliance/")({
  component: CompliancePage,
})

function CompliancePage() {
  const sessionRole = getSession()?.role ?? "user"
  const canDecide = rankAtLeast(sessionRole, "compliance")
  const canEditRules = rankAtLeast(sessionRole, "admin")

  const reviews = useApiQuery("GET /api/v1/compliance/reviews")
  const rules = useApiQuery("GET /api/v1/compliance/rules")

  const [deciding, setDeciding] = React.useState<ReviewRow | null>(null)
  const [editing, setEditing] = React.useState<RuleRow | null>(null)

  const rows = reviews.data ?? []
  const hits = rows.filter((r) => r.sanctionsResult === "hit").length

  return (
    <div className="flex flex-1 flex-col gap-6">
      <ComplianceHeader queueCount={reviews.data ? rows.length : null} />

      {!canDecide && (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Review decisions need the compliance role. Your session is{" "}
          {sessionRole}, so this queue is read-only for you.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Reviews</h2>
          {reviews.data && hits > 0 && (
            <p className="text-sm text-destructive">
              {hits} sanctions {hits === 1 ? "hit" : "hits"} — decide {hits === 1 ? "it" : "them"} first.
            </p>
          )}
        </div>

        {reviews.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading review queue…</p>
        ) : reviews.isError ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
            <p className="text-sm font-medium">Could not load the review queue</p>
            <p className="text-sm text-muted-foreground">
              The API did not answer. The queue below may be stale or empty —
              this is not an all-clear. A refusal here usually means your role
              is below compliance.
            </p>
            <Button variant="outline" size="sm" onClick={() => reviews.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <ReviewsTable
            rows={rows}
            canDecide={canDecide}
            onDecide={setDeciding}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Jurisdiction rules</h2>
          {!canEditRules && (
            <p className="text-sm text-muted-foreground">
              Rule edits need the admin role.
            </p>
          )}
        </div>

        {rules.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading jurisdiction rules…</p>
        ) : rules.isError ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
            <p className="text-sm font-medium">Could not load jurisdiction rules</p>
            <p className="text-sm text-muted-foreground">
              The API did not answer. The table below may be stale or empty —
              this is not an all-clear.
            </p>
            <Button variant="outline" size="sm" onClick={() => rules.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <RulesTable
            rows={rules.data ?? []}
            canEdit={canEditRules}
            onEdit={setEditing}
          />
        )}
      </section>

      {deciding && (
        <DecideDialogRoot
          review={deciding}
          onClose={() => setDeciding(null)}
          onDecided={() => {
            setDeciding(null)
            reviews.refetch()
          }}
        />
      )}

      {editing && (
        <RuleEditDialogRoot
          rule={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            rules.refetch()
          }}
        />
      )}
    </div>
  )
}
