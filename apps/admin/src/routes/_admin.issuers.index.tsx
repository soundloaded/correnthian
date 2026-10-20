import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import { IssuersHeader } from "@/components/issuers/issuers-header"
import { IssuersTable } from "@/components/issuers/issuers-table"

export const Route = createFileRoute("/_admin/issuers/")({
  component: IssuersPage,
})

// The list endpoint takes no filters and returns the whole registry, so
// there is no toolbar and no pagination — the count line says what it is.
function IssuersPage() {
  const { data, isLoading, isError, refetch } = useApiQuery("GET /api/v1/issuers")
  const rows = data ?? []

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <IssuersHeader onRegistered={() => refetch()} />

      {/* Issuers Data Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading registry…</p>
      ) : isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load the registry</p>
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
          <IssuersTable rows={rows} />

          <p className="text-sm text-muted-foreground">
            Showing {rows.length} of {rows.length} registered issuers.
          </p>
        </>
      )}
    </div>
  )
}
