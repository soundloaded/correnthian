import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { DevicesHeader } from "@/components/devices/devices-header"
import { useDevicesList } from "@/components/devices/use-devices-list"
import { DevicesTable } from "@/components/devices/devices-table"

const PAGE_LIMIT = 25

export const Route = createFileRoute("/_admin/devices/")({
  component: DevicesPage,
})

function DevicesPage() {
  const devices = useDevicesList()

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <DevicesHeader />

      {/* Search and Filters */}
      {devices.toolbar}

      {/* Devices Data Table */}
      {devices.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading devices…</p>
      ) : devices.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load devices</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The list below may be stale or empty —
            this is not an all-clear.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => devices.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <DevicesTable rows={devices.rows} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {devices.pageIndex + 1} · showing up to {PAGE_LIMIT} per
              page. The list holds at most {PAGE_LIMIT} rows — when a next
              page exists, more devices remain.
            </p>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={devices.previousPage}
                disabled={!devices.hasPrevious}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={devices.nextPage}
                disabled={!devices.hasNext}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
