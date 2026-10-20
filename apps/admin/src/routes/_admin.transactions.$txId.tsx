import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import {
  TransactionDetailsHeader,
  TransactionNotFound,
} from "@/components/transactions/transaction-details-header"
import { TransactionActionsCard } from "@/components/transactions/transaction-actions-card"
import { TransactionInformationCard } from "@/components/transactions/transaction-information-card"
import { TransactionLifecycleCard } from "@/components/transactions/transaction-lifecycle-card"
import { TransactionPartiesCard } from "@/components/transactions/transaction-parties-card"

export const Route = createFileRoute("/_admin/transactions/$txId")({
  component: TransactionDetailsPage,
})

function TransactionDetailsPage() {
  const { txId } = Route.useParams()
  const { data: tx, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/transactions/:id",
    { id: txId },
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Loading transaction…</p>
      </div>
    )
  }

  if (isError || !tx) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load this transaction</p>
          <p className="text-sm text-muted-foreground">
            {isError
              ? "The API did not answer, or this transaction does not exist."
              : "This transaction may have been removed or does not exist."}
          </p>
          {isError ? (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          ) : (
            <TransactionNotFound txId={txId} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Intent Header */}
      <TransactionDetailsHeader tx={tx} />

      {/* Details Layout */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(220px,0.85fr)_minmax(320px,1.45fr)_minmax(220px,0.85fr)]">
        {/* Left Column */}
        <div className="space-y-4">
          <TransactionInformationCard tx={tx} />
        </div>

        {/* Center Column */}
        <div className="space-y-4">
          <TransactionLifecycleCard tx={tx} />
          <TransactionActionsCard tx={tx} onChanged={() => refetch()} />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <TransactionPartiesCard tx={tx} />
        </div>
      </div>
    </div>
  )
}
