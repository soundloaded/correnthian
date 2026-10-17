import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { AssetsHeader } from "@/components/assets/assets-header"
import { ASSETS_LIST_LIMIT, useAssetsList } from "@/components/assets/use-assets-list"
import { AssetsTable } from "@/components/assets/assets-table"

export const Route = createFileRoute("/_admin/assets/")({
  component: AssetsPage,
})

// Full-list honesty (§6): the endpoint caps at 200, so a full page says the
// registry may hold more rather than reading as complete.
function AssetsPage() {
  const assets = useAssetsList()

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <AssetsHeader />

      {/* Search and Filters */}
      {assets.toolbar}

      {/* Assets Data Table */}
      {assets.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading registry…</p>
      ) : assets.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load the registry</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The list below may be stale or empty —
            this is not an all-clear.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => assets.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <AssetsTable rows={assets.rows} />

          <p className="text-sm text-muted-foreground">
            {assets.isFull
              ? `Showing ${ASSETS_LIST_LIMIT} of at least ${ASSETS_LIST_LIMIT} — the registry holds more than one page. Narrow the filters to see the rest; this list is not whole.`
              : `Showing ${assets.rows.length} of ${assets.rows.length} registered assets.`}
          </p>
        </>
      )}
    </div>
  )
}
