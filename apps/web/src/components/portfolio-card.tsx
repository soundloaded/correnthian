"use client"

import type { Contract } from "@correnthian/api-client"
import { useApiQuery } from "@/lib/use-api-query"
import { Disclosure, holdingDisplay, metalAmountParts } from "./disclosure"

type Portfolio = Contract<"GET /api/v1/portfolio">
type AssetSummary = Contract<"GET /api/v1/assets">[number];

/**
 * Scale a per-token metal figure to fixed 10^4. The registry ships
 * gramsPerToken as a float (31.1035); the display needs exact bigint
 * math, so the float is scaled once, here, at the boundary — and the
 * rounding of a 4-decimal display figure is dust, not money.
 */
function scaled4(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10_000)
}

/**
 * Portfolio: crypto plus metal in one place, in grams and ounces, not
 * just token counts. The backing disclosure renders verbatim from the
 * registry — never recomputed, never paraphrased.
 */
export function PortfolioCard() {
  const portfolio = useApiQuery("GET /api/v1/portfolio")
  const assets = useApiQuery("GET /api/v1/assets")

  if (portfolio.isLoading || assets.isLoading) {
    return <p className="text-sm text-muted">Loading portfolio…</p>
  }

  if (portfolio.isError || assets.isError || !portfolio.data || !assets.data) {
    return (
      <p role="alert" className="text-sm text-negative">
        {(portfolio.error ?? assets.error)?.message ?? "Could not load your portfolio."}
      </p>
    )
  }

  const byId = new Map(assets.data.map((a: AssetSummary) => [a.asset.assetId, a]))
  const holdings = portfolio.data.wallets.flatMap((w: Portfolio["wallets"][number]) => w.holdings)

  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium">No holdings yet</p>
        <p className="mt-1 text-sm text-muted">Buy gold or crypto to start your portfolio.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-2xl font-semibold">${portfolio.data.combinedUsd}</p>
      {portfolio.data.unpricedCount > 0 && (
        <p className="text-xs text-muted">
          Excludes {portfolio.data.unpricedCount} unpriced holding
          {portfolio.data.unpricedCount === 1 ? "" : "s"}.
        </p>
      )}
      <ul className="space-y-3">
        {holdings.map((h, i) => {
          const row = byId.get(h.assetId)
          return (
            <li key={`${h.assetId}-${i}`} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">{h.name}</p>
                <p className="text-sm">{holdingDisplay(h)}</p>
              </div>
              <p className="mt-1 text-xs text-muted">
                {row
                  ? metalAmountParts(
                      h.balanceRaw,
                      row.asset.decimals,
                      scaled4(row.asset.backing.gramsPerToken),
                      scaled4(row.asset.backing.ouncesPerToken),
                    )
                  : h.symbol}
                {" · "}{h.symbol}
              </p>
              {row && (
                <div className="mt-2 border-t border-border pt-2">
                  <Disclosure text={row.disclosure} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
