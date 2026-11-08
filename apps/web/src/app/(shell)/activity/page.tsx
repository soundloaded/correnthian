"use client"

import type { Contract } from "@correnthian/api-client"
import { explorerTxUrl, formatTokenAmount, shortenAddress } from "@/components/activity-helpers"
import { useApiQuery } from "@/lib/use-api-query"

type AssetSummary = Contract<"GET /api/v1/assets">[number]

/**
 * Activity: the holder's own transaction history. Reads `transactions/mine`
 * — scoped to the session server-side, so one holder never sees another's.
 * Amounts place exactly off the asset registry's decimals; a row whose
 * asset is missing renders its raw value verbatim, never a guess.
 */
export default function ActivityPage() {
  const mine = useApiQuery("GET /api/v1/transactions/mine")
  const assets = useApiQuery("GET /api/v1/assets")

  if (mine.isLoading || assets.isLoading) return <p className="text-sm text-muted">Loading activity…</p>
  if (mine.isError || assets.isError || !mine.data || !assets.data) {
    return (
      <p role="alert" className="text-sm text-negative">
        {(mine.error ?? assets.error)?.message ?? "Could not load your activity."}
      </p>
    )
  }

  const byId = new Map(assets.data.map((a: AssetSummary) => [a.asset.assetId, a]))
  if (mine.data.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Activity</h1>
        <p className="text-sm text-muted">No transactions yet.</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Activity</h1>
      <ul className="space-y-2">
        {mine.data.map((t) => {
          const decimals = byId.get(t.asset.assetId)?.asset.decimals ?? null
          const url = explorerTxUrl(t.chain, t.txHash)
          return (
            <li key={t.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">{t.direction}</p>
                <p className="text-sm">
                  {formatTokenAmount(t.amountRaw, decimals)} {t.asset.symbol}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted">
                {t.state} · to {t.destination ? shortenAddress(t.destination) : "—"}
              </p>
              {url && t.txHash ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 block font-mono text-xs underline underline-offset-4"
                >
                  {shortenAddress(t.txHash)}
                </a>
              ) : (
                t.txHash && (
                  <p className="mt-1 font-mono text-xs text-muted">{shortenAddress(t.txHash)}</p>
                )
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
