import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import { WalletsHeader } from "@/components/wallets/wallets-header"
import { WalletsTable } from "@/components/wallets/wallets-table"

export const Route = createFileRoute("/_admin/wallets/")({
  component: WalletsPage,
})

// The list endpoint takes no filters and returns the whole registry for the
// session, so the count line counts the rows on the page.
function WalletsPage() {
  const { data, isLoading, isError, refetch } = useApiQuery("GET /api/v1/wallets")
  const rows = data ?? []

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <WalletsHeader count={data ? rows.length : null} />

      {/* Wallets Data Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading wallets…</p>
      ) : isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load wallets</p>
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
          <WalletsTable rows={rows} />

          <p className="text-sm text-muted-foreground">
            Showing {rows.length} of {rows.length} registered addresses.
          </p>
        </>
      )}
    </div>
  )
}
