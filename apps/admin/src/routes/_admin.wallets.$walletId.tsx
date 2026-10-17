import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import {
  WalletDetailsHeader,
  WalletNotFound,
} from "@/components/wallets/wallet-details-header"
import { WalletManageCard } from "@/components/wallets/wallet-manage-card"
import { WalletPortfolioCard } from "@/components/wallets/wallet-portfolio-card"

export const Route = createFileRoute("/_admin/wallets/$walletId")({
  component: WalletDetailsPage,
})

function WalletDetailsPage() {
  const { walletId } = Route.useParams()
  const { data: wallet, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/wallets/:id",
    { id: walletId },
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Loading wallet…</p>
      </div>
    )
  }

  if (isError || !wallet) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load this wallet</p>
          <p className="text-sm text-muted-foreground">
            {isError
              ? "The API did not answer, or this wallet is not registered to your account."
              : "This wallet may have been deregistered."}
          </p>
          {isError ? (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          ) : (
            <WalletNotFound walletId={walletId} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Identity Header */}
      <WalletDetailsHeader wallet={wallet} />

      {/* Details Layout */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(220px,0.85fr)_minmax(320px,1.45fr)]">
        {/* Left Column */}
        <div className="space-y-4">
          <WalletManageCard wallet={wallet} onChanged={() => refetch()} />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <WalletPortfolioCard wallet={wallet} />
        </div>
      </div>
    </div>
  )
}
