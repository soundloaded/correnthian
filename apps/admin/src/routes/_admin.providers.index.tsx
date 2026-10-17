import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import { ProvidersHeader } from "@/components/providers/providers-header"
import { ProvidersToolbar } from "@/components/providers/providers-toolbar"
import { ProvidersTable } from "@/components/providers/providers-table"

export const Route = createFileRoute("/_admin/providers/")({
  component: ProvidersPage,
})

// List + health are separate endpoints: the table renders from the list,
// the header badge from health. A health failure names itself in the header
// instead of blanking the page (partial-read honesty).
function ProvidersPage() {
  const [category, setCategory] = React.useState("all")

  const { data, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/providers",
    undefined,
    { category: category === "all" ? undefined : category },
  )
  const rows = data ?? []

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <ProvidersHeader />

      {/* Filters */}
      <ProvidersToolbar category={category} onCategoryChange={setCategory} />

      {/* Providers Data Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading providers…</p>
      ) : isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load providers</p>
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
          <ProvidersTable rows={rows} onChanged={() => refetch()} />

          <p className="text-sm text-muted-foreground">
            Showing {rows.length} of {rows.length} registered providers.
          </p>
        </>
      )}
    </div>
  )
}
