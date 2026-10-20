"use client"

import * as React from "react"

import { RefreshCwIcon } from "lucide-react"

import { api } from "@/lib/api"
import { useQueryClient } from "@tanstack/react-query"
import type { ApiResult, Contract } from "@correnthian/api-client"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { WalletDetail } from "./wallet-details-header"

type SyncResult = Contract<"POST /api/v1/blockchain/wallets/:walletId/sync">

// Re-index this address from chain state. The endpoint carries no @Roles(),
// so every console session may ask for it; what the service refuses is
// another account's wallet. Errors render inline, never as a toast.
export function WalletSyncCard({ wallet }: { wallet: WalletDetail }) {
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<SyncResult | null>(null)

  const sync = async () => {
    setSyncing(true)
    setError(null)
    setResult(null)
    const response = await api.request(
      "POST /api/v1/blockchain/wallets/:walletId/sync",
      { method: "POST", params: { walletId: wallet.id } },
    )
    setSyncing(false)
    if (response.status === "ok") {
      setResult(response.data)
      // The valuation is a separate query, so it still holds the balances
      // from before the re-read unless it is invalidated.
      void queryClient.invalidateQueries({
        queryKey: ["GET /api/v1/portfolio/wallets/:walletId", { walletId: wallet.id }],
      })
    } else {
      setError(toMessage(response))
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCwIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Chain state</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={sync}
          disabled={syncing}
        >
          {syncing ? "Syncing…" : "Re-sync from chain"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Reads this address from the chain and rewrites the balances
          Correnthian holds for it. Nothing on-chain changes.
        </p>

        {result && (
          <div className="space-y-1.5">
            <p className="text-sm">
              Checked {result.assetsChecked} assets · updated{" "}
              {result.updated.length}.
            </p>
            {result.updated.map((entry) => (
              <p
                key={entry.assetId}
                className="truncate font-mono text-xs text-muted-foreground"
              >
                {entry.assetId} — {entry.formatted}
              </p>
            ))}
            {result.errors.map((message, index) => (
              <p
                key={index}
                role="alert"
                className="text-xs text-destructive"
              >
                {truncate(message)}
              </p>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// A failed RPC read answers with the provider's own message, which runs to
// several lines of troubleshooting prose. The first line is the finding.
function truncate(message: string): string {
  const first = message.split("\n")[0]
  return first.length > 200 ? `${first.slice(0, 200)}…` : first
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
