import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { TransactionsHeader } from "@/components/transactions/transactions-header"
import { useTransactionsList } from "@/components/transactions/use-transactions-list"
import { TransactionsTable } from "@/components/transactions/transactions-table"

const PAGE_LIMIT = 25

export const Route = createFileRoute("/_admin/transactions/")({
  component: TransactionsPage,
})

function TransactionsPage() {
  const txs = useTransactionsList()

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <TransactionsHeader />

      {/* Filters */}
      {txs.toolbar}

      {/* Transactions Data Table */}
      {txs.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading transactions…</p>
      ) : txs.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load transactions</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The list below may be stale or empty —
            this is not an all-clear.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => txs.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <TransactionsTable rows={txs.rows} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {txs.pageIndex + 1} · showing up to {PAGE_LIMIT} per
              page. The list holds at most {PAGE_LIMIT} rows — when a next
              page exists, more transactions remain.
            </p>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={txs.previousPage}
                disabled={!txs.hasPrevious}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={txs.nextPage}
                disabled={!txs.hasNext}
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
