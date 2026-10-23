"use client"

import type { Contract } from "@correnthian/api-client"
import { useApiQuery } from "@/lib/use-api-query"
import { Disclosure, formatMetalAmount, holdingDisplay } from "./disclosure"

type Portfolio = Contract<"GET /api/v1/portfolio">
type AssetSummary = Contract<"GET /api/v1/assets">[number]

/**
 * Portfolio: crypto plus metal in one place, in grams and ounces, not
 * just token counts. Backing disclosure renders verbatim from the
 * registry — custodian, vault, attestation date, custody model — before
 * any buy path, never after the signature.
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

  const byId = new Map(assets.data.map((a: AssetSummary) => [a.asset.assetId, a.asset]))
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
      <ul className="space-y-3">
        {holdings.map((h) => {
          const asset = byId.get(h.assetId)
          const grams = asset?.backing.gramsPerToken ?? null
          const ounces = asset?.backing.ouncesPerToken ?? null
          return (
            <li key={h.assetId} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">{h.name}</p>
                <p className="text-sm">{holdingDisplay(h)}</p>
              </div>
              <p className="mt-1 text-xs text-muted">
                {asset ? formatMetalAmount(h.balanceRaw, asset.decimals, grams, ounces) : h.symbol}
                {" · "}{h.symbol}
              </p>
              {asset && (
                <div className="mt-2 border-t border-border pt-2">
                  <Disclosure
                    text={[
                      asset.backing.custodyModel,
                      asset.backing.custodian ?? "custodian undisclosed",
                      asset.backing.vaultLocation.join(", ") || "vault undisclosed",
                      asset.backing.lastAttestation
                        ? `attested ${asset.backing.lastAttestation}`
                        : "never attested",
                    ].join(" · ")}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
