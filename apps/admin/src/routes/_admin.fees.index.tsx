import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import { FeesHeader } from "@/components/fees/fees-header"
import { FeesToolbar, type FeesFilters } from "@/components/fees/fees-toolbar"
import { FeesTable } from "@/components/fees/fees-table"
import { FeeCreateCard } from "@/components/fees/fee-create-card"

// The rules endpoint caps at 200 (default 100 — requested explicitly) and
// returns a bare array, so a full page says the table may hold more rather
// than reading as complete.
const LIST_LIMIT = 200

export const Route = createFileRoute("/_admin/fees/")({
  component: FeesPage,
})

function FeesPage() {
  const [filters, setFilters] = React.useState<FeesFilters>({
    operation: "all",
    kind: "all",
    active: "all",
  })

  const { data, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/fees/rules",
    undefined,
    {
      operation: filters.operation === "all" ? undefined : filters.operation,
      kind: filters.kind === "all" ? undefined : filters.kind,
      active: filters.active === "all" ? undefined : filters.active,
      limit: LIST_LIMIT,
    },
  )
  const rows = data ?? []

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <FeesHeader shown={data ? rows.length : null} />

      {/* Filters */}
      <FeesToolbar filters={filters} onChange={setFilters} />

      {/* Create — owner only; the card says so below that */}
      <FeeCreateCard onCreated={() => refetch()} />

      {/* Fee rules Data Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading fee rules…</p>
      ) : isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load fee rules</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The list below may be stale or empty —
            this is not an all-clear.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <FeesTable rows={rows} />

          <p className="text-sm text-muted-foreground">
            {rows.length >= LIST_LIMIT
              ? `Showing ${LIST_LIMIT} of at least ${LIST_LIMIT} — the table holds more than one page. Narrow the filters to see the rest; this list is not whole.`
              : `Showing ${rows.length} of ${rows.length} fee rules.`}
          </p>
        </>
      )}
    </div>
  )
}
