import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { CompaniesHeader } from "@/components/companies/companies-header"
import { CompaniesToolbar } from "@/components/companies/companies-toolbar"
import { CompaniesTable } from "@/components/companies/companies-table"
import { CompaniesDeleteDialog } from "@/components/companies/companies-delete-dialog"
import { AddCompanySheet } from "@/components/companies/add-company-sheet"
import { useCompaniesTable } from "@/components/companies/use-companies-table"

export const Route = createFileRoute("/_admin/companies/")({
  component: CompaniesPage,
})

function CompaniesPage() {
  const [addCompanyOpen, setAddCompanyOpen] = useState(false)

  const {
    table,
    totalCount,
    selectedCount,
    search,
    handleSearch,
    status,
    requestBulkDelete,
    dialog,
  } = useCompaniesTable()

  return (
    <div className="space-y-4">
      <CompaniesHeader
        onCreate={() => setAddCompanyOpen(true)}
      />

      <CompaniesToolbar
        search={search}
        onSearchChange={handleSearch}
        status={status.value}
        onStatusChange={status.onChange}
        selectedCount={selectedCount}
        onBulkDelete={requestBulkDelete}
      />

      <CompaniesTable
        table={table}
        totalCount={totalCount}
      />

      <CompaniesDeleteDialog
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
        targets={dialog.targets}
        onConfirm={dialog.onConfirm}
      />

      <AddCompanySheet
        open={addCompanyOpen}
        onOpenChange={setAddCompanyOpen}
        onAdd={() => {}}
      />
    </div>
  )
}