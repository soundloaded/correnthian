import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { NotificationsHeader } from "@/components/notifications/notifications-header"
import { NotificationsTable } from "@/components/notifications/notifications-table"
import { useNotificationsList } from "@/components/notifications/use-notifications-list"

const PAGE_LIMIT = 25

export const Route = createFileRoute("/_admin/notifications/")({
  component: NotificationsPage,
})

function NotificationsPage() {
  const queue = useNotificationsList()

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <NotificationsHeader />

      {/* State Filter */}
      {queue.toolbar}

      {/* Queue Table */}
      {queue.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading notifications…</p>
      ) : queue.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load notifications</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The list below may be stale or empty —
            this is not an all-clear.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queue.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <NotificationsTable rows={queue.rows} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {queue.pageIndex + 1} · showing up to {PAGE_LIMIT} per
              page. The list holds at most {PAGE_LIMIT} rows — when a next
              page exists, more notifications remain.
            </p>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={queue.previousPage}
                disabled={!queue.hasPrevious}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={queue.nextPage}
                disabled={!queue.hasNext}
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
