import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import {
  FeeDetailsHeader,
  FeeRuleNotFound,
} from "@/components/fees/fee-details-header"
import { FeeSelectorsCard } from "@/components/fees/fee-selectors-card"
import { FeeProposeCard } from "@/components/fees/fee-propose-card"
import { FeesDiagnosticsCard } from "@/components/fees/fees-diagnostics-card"

export const Route = createFileRoute("/_admin/fees/$ruleId")({
  component: FeeRuleDetailsPage,
})

function FeeRuleDetailsPage() {
  const { ruleId } = Route.useParams()
  const { data: rule, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/fees/rules/:id",
    { id: ruleId },
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Loading fee rule…</p>
      </div>
    )
  }

  if (isError || !rule) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load this fee rule</p>
          <p className="text-sm text-muted-foreground">
            {isError
              ? "The API did not answer, or this rule does not exist."
              : "This rule may have been removed or does not exist."}
          </p>
          {isError ? (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          ) : (
            <FeeRuleNotFound ruleId={ruleId} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Identity Header */}
      <FeeDetailsHeader rule={rule} />

      {/* Details Layout */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(320px,1.45fr)_minmax(220px,0.85fr)]">
        {/* Left Column */}
        <div className="space-y-4">
          <FeeSelectorsCard rule={rule} />
          <FeesDiagnosticsCard />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <FeeProposeCard rule={rule} onChanged={() => refetch()} />
        </div>
      </div>
    </div>
  )
}
