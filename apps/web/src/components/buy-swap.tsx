"use client"

import type { Contract } from "@correnthian/api-client"
import { useApiQuery } from "@/lib/use-api-query"

type Availability = Contract<"GET /api/v1/onramp/availability">

/** The refusal copy is the API's, verbatim — never a paraphrase that could soften it. */
export function refusalCopy(a: Availability): string {
  return a.reason ?? "Unavailable."
}

/**
 * Whether a mine row can be acted on. The mine endpoint returns rows,
 * not the detail envelope — no `executable` flag — so the rule is read
 * off the row itself: an expired/failed/settled quote is history, not an
 * offer, and a 'none'-quality row is the engine saying it cannot fill.
 * A row that survives both is quotable; anything else renders as a
 * constraint, never as a button.
 */
export function swapRefusal(q: { state: string; executionQuality: string }): boolean {
  if (q.state !== "quoted") return true
  return q.executionQuality === "none"
}

function Refusal({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium">Not available yet</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  )
}

/**
 * Path A — fiat buyer. The licensed metals provider delivers directly;
 * the holder never sees USDT, gas, or a swap. Until a provider is
 * contracted the card says so in the API's own words.
 */
export function BuyFiat() {
  const availability = useApiQuery("GET /api/v1/onramp/availability", undefined, {
    direction: "buy",
    country: "US",
  })

  if (availability.isLoading) return <p className="text-sm text-muted">Checking availability…</p>
  if (availability.isError || !availability.data) {
    return <Refusal text={(availability.error)?.message ?? "Could not check availability."} />
  }
  if (!availability.data.available) {
    return <Refusal text={refusalCopy(availability.data)} />
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium">Buy with card or bank</p>
      <p className="mt-1 text-sm text-muted">Fiat on-ramp is available in your region.</p>
    </div>
  )
}

/**
 * Path B — existing USDT holder. Swaps USDT to gold through the
 * liquidity rail into the same wallet. A quote the engine cannot fill
 * renders as a constraint, never as a button.
 */
export function BuySwap() {
  const quotes = useApiQuery("GET /api/v1/swaps/quotes/mine")

  if (quotes.isLoading) return <p className="text-sm text-muted">Loading quotes…</p>
  if (quotes.isError || !quotes.data) {
    return <Refusal text={quotes.error?.message ?? "Could not load quotes."} />
  }
  const latest = quotes.data[0]
  if (!latest || swapRefusal(latest)) {
    return (
      <Refusal
        text={
          latest
            ? "No executable quote right now — liquidity is thin or no provider is contracted."
            : "No quotes yet. A swap quote will appear here once a provider is contracted."
        }
      />
    )
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium">Swap USDT for gold</p>
      <p className="mt-1 text-sm text-muted">
        Quality {latest.executionQuality}
        {latest.sizeCapUsd != null ? ` · up to $${latest.sizeCapUsd}` : ""}
      </p>
    </div>
  )
}
