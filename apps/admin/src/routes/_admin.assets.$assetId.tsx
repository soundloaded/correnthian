import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import {
  AssetDetailsHeader,
  AssetNotFound,
} from "@/components/assets/asset-details-header"
import { AssetFactGrid } from "@/components/assets/asset-fact-grid"
import { AssetDisclosureBand } from "@/components/assets/asset-disclosure-band"
import { AssetRegistryCard } from "@/components/assets/asset-registry-card"

export const Route = createFileRoute("/_admin/assets/$assetId")({
  component: AssetDetailsPage,
})

function AssetDetailsPage() {
  const { assetId } = Route.useParams()
  const { data: asset, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/assets/:assetId",
    { assetId },
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Loading asset…</p>
      </div>
    )
  }

  if (isError || !asset) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load this asset</p>
          <p className="text-sm text-muted-foreground">
            {isError
              ? "The API did not answer, or this asset does not exist."
              : "This asset may have been removed or does not exist."}
          </p>
          {isError ? (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          ) : (
            <AssetNotFound assetId={assetId} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Identity Header */}
      <AssetDetailsHeader asset={asset} />

      {/* Details Layout */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(320px,1.45fr)_minmax(220px,0.85fr)]">
        {/* Left Column */}
        <div className="space-y-4">
          <AssetFactGrid asset={asset} />
          <AssetDisclosureBand disclosure={asset.disclosure} />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <AssetRegistryCard asset={asset} onChanged={() => refetch()} />
        </div>
      </div>
    </div>
  )
}
