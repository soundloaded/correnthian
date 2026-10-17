import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { UsersHeader } from "@/components/users/users-header"
import { useUsersList } from "@/components/users/use-users-list"
import { UsersTable } from "@/components/users/users-table"

const PAGE_LIMIT = 25

export const Route = createFileRoute("/_admin/users/")({
  component: UsersPage,
})

function UsersPage() {
  const users = useUsersList()

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <UsersHeader />

      {/* Search and Filters */}
      {users.toolbar}

      {/* Users Data Table */}
      {users.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading accounts…</p>
      ) : users.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load accounts</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The list below may be stale or empty —
            this is not an all-clear.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => users.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <UsersTable rows={users.rows} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {users.pageIndex + 1} · showing up to {PAGE_LIMIT} per
              page. The list holds at most {PAGE_LIMIT} rows — when a next
              page exists, more accounts remain.
            </p>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={users.previousPage}
                disabled={!users.hasPrevious}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={users.nextPage}
                disabled={!users.hasNext}
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
