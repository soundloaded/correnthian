import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { UsersHeader } from "@/components/users/users-header"
import { useUsersList } from "@/components/users/use-users-list"
import { UsersTable } from "@/components/users/users-table"

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
        <UsersTable
          rows={users.rows}
          pageIndex={users.pageIndex}
          pageCount={users.pageCount}
          pageSize={users.pageSize}
          totalCount={users.rows.length}
          selectedIds={users.selectedIds}
          onToggleRow={users.onToggleRow}
          onToggleAll={users.onToggleAll}
          sort={users.sort}
          order={users.order}
          onSortChange={users.onSortChange}
          onPageChange={(index) => {
            const delta = index - users.pageIndex
            if (delta === 1) users.nextPage()
            else if (delta === -1) users.previousPage()
            else users.goToPage(index)
          }}
          onPageSizeChange={users.onPageSizeChange}
        />
      )}
    </div>
  )
}
