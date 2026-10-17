import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import { ChainsHeader } from "@/components/chains/chains-header"
import { ChainsTable } from "@/components/chains/chains-table"

export const Route = createFileRoute("/_admin/chains/")({
  component: ChainsPage,
})

// The list endpoint returns the whole table with no filters and no stats
// sibling, so the count line counts the rows on the page.
function ChainsPage() {
  const { data, isLoading, isError, refetch } = useApiQuery("GET /api/v1/chains")
  const rows = data ?? []

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <ChainsHeader count={data ? rows.length : null} />

      {/* Chains Data Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading chains…</p>
      ) : isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load chains</p>
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
          <ChainsTable rows={rows} onChanged={() => refetch()} />

          <p className="text-sm text-muted-foreground">
            Showing {rows.length} of {rows.length} configured chains.
          </p>
        </>
      )}
    </div>
  )
}
