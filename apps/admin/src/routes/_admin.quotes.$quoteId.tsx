import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import {
  QuoteDetailsHeader,
  QuoteNotFound,
} from "@/components/quotes/quote-details-header"
import { QuoteFeesCard } from "@/components/quotes/quote-fees-card"
import { QuoteFillabilityCard } from "@/components/quotes/quote-fillability-card"
import { QuoteInformationCard } from "@/components/quotes/quote-information-card"

export const Route = createFileRoute("/_admin/quotes/$quoteId")({
  component: QuoteDetailsPage,
})

function QuoteDetailsPage() {
  const { quoteId } = Route.useParams()
  const { data: quote, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/swaps/quotes/:id",
    { id: quoteId },
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Loading quote…</p>
      </div>
    )
  }

  if (isError || !quote) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load this quote</p>
          <p className="text-sm text-muted-foreground">
            {isError
              ? "The API did not answer, or this quote does not exist."
              : "This quote may have been removed or does not exist."}
          </p>
          {isError ? (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          ) : (
            <QuoteNotFound quoteId={quoteId} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Quote Header */}
      <QuoteDetailsHeader quote={quote} />

      {/* Details Layout */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(220px,0.85fr)_minmax(320px,1.45fr)_minmax(220px,0.85fr)]">
        {/* Left Column */}
        <div className="space-y-4">
          <QuoteInformationCard quote={quote} />
        </div>

        {/* Center Column */}
        <div className="space-y-4">
          <QuoteFeesCard quote={quote} />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <QuoteFillabilityCard quote={quote} />
        </div>
      </div>
    </div>
  )
}
