import { createFileRoute } from "@tanstack/react-router"

import { leads } from "@/components/leads/leads-data"
import { LeadsHeader } from "@/components/leads/leads-header"
import { LeadsTable } from "@/components/leads/leads-table"
import { LeadsDeleteDialog } from "@/components/leads/leads-delete-dialog"
import { useLeadsTable } from "@/components/leads/use-leads-table"
import { LeadsToolbar } from "@/components/leads/leads-toolbar"

export const Route = createFileRoute("/_admin/leads/")({
  component: LeadsPage,
})

function LeadsPage() {
  const {
    table,
    totalCount,
    selectedCount,
    requestBulkDelete,
    search,
    handleSearch,
    status,
    dialog,
  } = useLeadsTable(leads)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <LeadsHeader
        selectedCount={selectedCount}
        onDeleteSelected={requestBulkDelete}
      />

      <LeadsToolbar
        search={search}
        onSearchChange={handleSearch}
        status={status}
      />

      <LeadsTable table={table} totalCount={totalCount} />

      <LeadsDeleteDialog
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
        targets={dialog.targets}
        onConfirm={dialog.onConfirm}
      />
    </div>
  )
}