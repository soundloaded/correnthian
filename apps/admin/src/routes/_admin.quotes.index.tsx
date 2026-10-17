import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { QuotesHeader } from "@/components/quotes/quotes-header"
import { useQuotesList } from "@/components/quotes/use-quotes-list"
import { QuotesTable } from "@/components/quotes/quotes-table"

const PAGE_LIMIT = 25

export const Route = createFileRoute("/_admin/quotes/")({
  component: QuotesPage,
})

function QuotesPage() {
  const quotes = useQuotesList()

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <QuotesHeader />

      {/* Filters */}
      {quotes.toolbar}

      {/* Quotes Data Table */}
      {quotes.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading quotes…</p>
      ) : quotes.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load quotes</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The list below may be stale or empty —
            this is not an all-clear.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => quotes.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <QuotesTable rows={quotes.rows} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {quotes.pageIndex + 1} · showing up to {PAGE_LIMIT} per
              page. The list holds at most {PAGE_LIMIT} rows — when a next
              page exists, more quotes remain.
            </p>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={quotes.previousPage}
                disabled={!quotes.hasPrevious}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={quotes.nextPage}
                disabled={!quotes.hasNext}
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
