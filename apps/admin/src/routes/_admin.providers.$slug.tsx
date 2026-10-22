import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import {
  ProviderDetailsHeader,
  ProviderNotFound,
} from "@/components/providers/provider-details-header"
import { ProviderFactGrid } from "@/components/providers/provider-fact-grid"
import { ProviderOperationsCard } from "@/components/providers/provider-operations-card"

export const Route = createFileRoute("/_admin/providers/$slug")({
  component: ProviderDetailsPage,
})

function ProviderDetailsPage() {
  const { slug } = Route.useParams()
  const { data: provider, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/providers/:slug",
    { slug },
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Loading provider…</p>
      </div>
    )
  }

  if (isError || !provider) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load this provider</p>
          <p className="text-sm text-muted-foreground">
            {isError
              ? "The API did not answer, or this provider does not exist."
              : "This provider may have been removed or does not exist."}
          </p>
          {isError ? (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          ) : (
            <ProviderNotFound slug={slug} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Identity Header */}
      <ProviderDetailsHeader provider={provider} />

      {/* Details Layout */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(320px,1.45fr)_minmax(220px,0.85fr)]">
        {/* Left Column */}
        <div className="space-y-4">
          <ProviderFactGrid provider={provider} />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <ProviderOperationsCard provider={provider} onChanged={() => refetch()} />
        </div>
      </div>
    </div>
  )
}
