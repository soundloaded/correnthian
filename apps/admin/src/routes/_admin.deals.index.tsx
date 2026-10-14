"use client"

import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { DealsHeader } from "@/components/deals/deals-header"
import { DealsToolbar } from "@/components/deals/deals-toolbar"
import { DealsTable } from "@/components/deals/deals-table"
import { DealsDeleteDialog } from "@/components/deals/deals-delete-dialog"
import { CreateDealSheet } from "@/components/deals/create-deal-sheet"
import { useDealsTable } from "@/components/deals/use-deals-table"

export const Route = createFileRoute("/_admin/deals/")({
  component: DealsPage,
})

function DealsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const deals = useDealsTable()

  return (
    <div className="flex flex-1 flex-col gap-4">
      <DealsHeader onCreate={() => setCreateOpen(true)} />

      <DealsToolbar
        search={deals.search}
        onSearchChange={deals.handleSearch}
        stage={deals.stage.value}
        onStageChange={deals.stage.onChange}
        selectedCount={deals.selectedCount}
        onBulkDelete={deals.requestBulkDelete}
      />

      <DealsTable
        table={deals.table}
        totalCount={deals.totalCount}
      />

      <DealsDeleteDialog
        open={deals.dialog.open}
        onOpenChange={deals.dialog.onOpenChange}
        targets={deals.dialog.targets}
        onConfirm={deals.dialog.onConfirm}
      />

      <CreateDealSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={deals.addDeal}
      />
    </div>
  )
}