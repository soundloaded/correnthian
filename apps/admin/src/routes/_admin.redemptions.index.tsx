"use client"

import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { getSession } from "@/lib/auth"
import { RedemptionsHeader } from "@/components/redemptions/redemptions-header"
import { useRedemptionsList } from "@/components/redemptions/use-redemptions-list"
import { RedemptionsTable } from "@/components/redemptions/redemptions-table"
import { RedemptionTransitionDialog } from "@/components/redemptions/redemption-transition-dialog"
import type { RedemptionRow } from "@/components/redemptions/redemptions-table"
import { rankAtLeast } from "@/lib/roles"

const PAGE_LIMIT = 25

export const Route = createFileRoute("/_admin/redemptions/")({
  component: RedemptionsPage,
})

// No detail route: the backend offers list, transition, and stats — there is
// no GET /redemptions/:id (the operator row carries no user, fee, or history
// fields for a detail to render). The queue acts inline instead.
function RedemptionsPage() {
  const redemptions = useRedemptionsList()
  const [selected, setSelected] = React.useState<RedemptionRow | null>(null)

  // Transition needs the compliance role server-side. The UI hides the
  // trigger below it, but that gate is display-only — RolesGuard decides.
  const sessionRole = getSession()?.role ?? "user"
  const canTransition = rankAtLeast(sessionRole, "compliance")

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <RedemptionsHeader />

      {/* Filters */}
      {redemptions.toolbar}

      {/* Redemptions Queue */}
      {redemptions.isLoading ? (
        <p className="text-sm text-muted-foreground">
          Loading redemption requests…
        </p>
      ) : redemptions.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load redemptions</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The list below may be stale or empty —
            this is not an all-clear.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => redemptions.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          {!canTransition && (
            <p className="text-sm text-muted-foreground">
              State changes need the compliance role. Your session is{" "}
              {sessionRole}, so this queue is read-only for you.
            </p>
          )}

          <RedemptionsTable
            rows={redemptions.rows}
            canTransition={canTransition}
            onTransition={setSelected}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {redemptions.pageIndex + 1} · showing up to {PAGE_LIMIT} per
              page. The list holds at most {PAGE_LIMIT} rows — when a next
              page exists, more requests remain.
            </p>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={redemptions.previousPage}
                disabled={!redemptions.hasPrevious}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redemptions.nextPage}
                disabled={!redemptions.hasNext}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <RedemptionTransitionDialog
        row={selected}
        onClose={() => setSelected(null)}
        onDone={() => redemptions.refetch()}
      />
    </div>
  )
}

