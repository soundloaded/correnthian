import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import {
  ChainDetailsHeader,
  ChainNotFound,
} from "@/components/chains/chain-details-header"
import { ChainFactGrid } from "@/components/chains/chain-fact-grid"
import { ChainOperationsCard } from "@/components/chains/chain-operations-card"

export const Route = createFileRoute("/_admin/chains/$chainId")({
  component: ChainDetailsPage,
})

function ChainDetailsPage() {
  const { chainId } = Route.useParams()
  const { data: chain, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/chains/:id",
    { id: chainId },
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Loading chain…</p>
      </div>
    )
  }

  if (isError || !chain) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load this chain</p>
          <p className="text-sm text-muted-foreground">
            {isError
              ? "The API did not answer, or this chain does not exist."
              : "This chain may have been removed or does not exist."}
          </p>
          {isError ? (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          ) : (
            <ChainNotFound chainId={chainId} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Identity Header */}
      <ChainDetailsHeader chain={chain} />

      {/* Details Layout */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(320px,1.45fr)_minmax(220px,0.85fr)]">
        {/* Left Column */}
        <div className="space-y-4">
          <ChainFactGrid chain={chain} />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <ChainOperationsCard chain={chain} onChanged={() => refetch()} />
        </div>
      </div>
    </div>
  )
}
