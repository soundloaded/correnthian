"use client"

import * as React from "react"

import { CameraIcon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
import { useApiQuery } from "@/lib/use-api-query"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { WalletDetail } from "./wallet-details-header"

// Valued holdings for this address plus its snapshot history. Snapshots are
// manual only: the button calls the capture endpoint, which exists and needs
// no role beyond the session. The valuation caveat travels verbatim — it is
// the service's own honesty about unpriced holdings, not display copy.
export function WalletPortfolioCard({ wallet }: { wallet: WalletDetail }) {
  const portfolio = useApiQuery("GET /api/v1/portfolio/wallets/:walletId", {
    walletId: wallet.id,
  })
  const history = useApiQuery("GET /api/v1/portfolio/wallets/:walletId/history", {
    walletId: wallet.id,
  })

  const [error, setError] = React.useState<string | null>(null)
  const [capturing, setCapturing] = React.useState(false)

  const captureSnapshot = async () => {
    setCapturing(true)
    setError(null)
    const result = await api.request("POST /api/v1/portfolio/wallets/:walletId/snapshot", {
      params: { walletId: wallet.id },
    })
    setCapturing(false)
    if (result.status === "ok") history.refetch()
    else setError(toMessage(result))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CameraIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Portfolio</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={captureSnapshot}
          disabled={capturing}
        >
          {capturing ? "Saving…" : "Snapshot now"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {portfolio.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading valuation…</p>
        ) : portfolio.isError || !portfolio.data ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              The valuation did not answer — holdings below may be stale.
              This is not an all-clear.
            </p>
            <Button variant="outline" size="sm" onClick={() => portfolio.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Total value</p>
              <p className="text-lg font-semibold tabular-nums">
                ${portfolio.data.totalUsd}
              </p>
              <p className="text-xs text-muted-foreground">{portfolio.data.caveat}</p>
            </div>

            {portfolio.data.holdings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No holdings recorded for this address.
              </p>
            ) : (
              <div className="divide-y">
                {portfolio.data.holdings.map((holding) => (
                  <div
                    key={holding.assetId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{holding.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {holding.balanceRaw} · {holding.category}
                      </p>
                    </div>
                    {holding.valueUsd != null ? (
                      <p className="text-sm tabular-nums">${holding.valueUsd}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">unpriced</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Snapshots — {history.data ? history.data.length : "…"}
          </p>
          {history.isError ? (
            <p className="text-sm text-muted-foreground">
              Snapshot history did not answer.
            </p>
          ) : history.data && history.data.length > 0 ? (
            <ul className="space-y-1">
              {history.data.slice(0, 5).map((snapshot, index) => (
                <li
                  key={`${snapshot.capturedAt}-${index}`}
                  className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span>{formatDateTime(snapshot.capturedAt)}</span>
                  <span className="tabular-nums">${String(snapshot.totalUsd)}</span>
                </li>
              ))}
            </ul>
          ) : (
            !history.isLoading && (
              <p className="text-sm text-muted-foreground">
                No snapshots yet — capture one manually above.
              </p>
            )
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
