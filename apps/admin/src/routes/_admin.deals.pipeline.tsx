import { createFileRoute } from "@tanstack/react-router"

import { CreateDealSheet } from "@/components/deals/create-deal-sheet"
import { PipelineBoard } from "@/components/deals/pipeline/pipeline-board"
import { PipelineHeader } from "@/components/deals/pipeline/pipeline-header"
import { PipelineToolbar } from "@/components/deals/pipeline/pipeline-toolbar"
import { useDealsPipeline } from "@/components/deals/pipeline/use-deals-pipeline"

export const Route = createFileRoute("/_admin/deals/pipeline")({
  component: DealsPipelinePage,
})

function DealsPipelinePage() {
  const {
    filteredDeals,
    totalPipelineValue,
    owners,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    hasActiveFilters,
    clearFilters,
    isCreateOpen,
    setIsCreateOpen,
    createDeal,
    deleteDeal,
    moveDeal,
  } = useDealsPipeline()

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col gap-4">
      <PipelineHeader
        dealCount={filteredDeals.length}
        totalValue={totalPipelineValue}
        onCreate={() => setIsCreateOpen(true)}
      />

      <PipelineToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
        owners={owners}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      <PipelineBoard
        deals={filteredDeals}
        onDelete={deleteDeal}
        onMove={moveDeal}
      />

      <CreateDealSheet
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreate={createDeal}
      />
    </div>
  )
}