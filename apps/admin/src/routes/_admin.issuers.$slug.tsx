import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import {
  IssuerDetailsHeader,
  IssuerNotFound,
} from "@/components/issuers/issuer-details-header"
import { IssuerEvidenceCard } from "@/components/issuers/issuer-evidence-card"
import { IssuerAssetsCard } from "@/components/issuers/issuer-assets-card"
import { IssuerVerificationCard } from "@/components/issuers/issuer-verification-card"

export const Route = createFileRoute("/_admin/issuers/$slug")({
  component: IssuerDetailsPage,
})

function IssuerDetailsPage() {
  const { slug } = Route.useParams()
  const { data: issuer, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/issuers/:slug",
    { slug },
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Loading issuer…</p>
      </div>
    )
  }

  if (isError || !issuer) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load this issuer</p>
          <p className="text-sm text-muted-foreground">
            {isError
              ? "The API did not answer, or this issuer does not exist."
              : "This issuer may have been removed or does not exist."}
          </p>
          {isError ? (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          ) : (
            <IssuerNotFound slug={slug} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Identity Header */}
      <IssuerDetailsHeader issuer={issuer} />

      {/* Details Layout */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(320px,1.45fr)_minmax(220px,0.85fr)]">
        {/* Left Column */}
        <div className="space-y-4">
          <IssuerEvidenceCard issuer={issuer} />
          <IssuerAssetsCard issuer={issuer} />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <IssuerVerificationCard issuer={issuer} onChanged={() => refetch()} />
        </div>
      </div>
    </div>
  )
}
