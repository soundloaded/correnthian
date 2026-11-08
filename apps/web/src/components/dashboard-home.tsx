"use client"

import Link from "next/link"
import type { Contract } from "@correnthian/api-client"
import { useApiQuery } from "@/lib/use-api-query"
import { Disclosure, metalAmountParts } from "./disclosure"

type Portfolio = Contract<"GET /api/v1/portfolio">
type Allocation = Contract<"GET /api/v1/portfolio/allocation">
type AssetSummary = Contract<"GET /api/v1/assets">[number]
type Holding = Portfolio["wallets"][number]["holdings"][number]

/**
 * Render a 10^-8 USD string as a two-decimal display figure, exactly.
 * String surgery only — the value never passes through a float, so a
 * dust balance cannot round into a cent it does not own.
 */
export function formatUsdDisplay(value: string): string {
  const [whole = "0", frac = ""] = value.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `$${grouped}.${(frac + "00").slice(0, 2)}`
}

/** Basis points to a display percent. Shares are weights, not money. */
export function sharePct(shareBps: number): string {
  return `${(shareBps / 100).toFixed(1).replace(/\.0$/, "")}%`
}

function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

/** One flat colour per category for the stacked bar — gold stays metal's. */
function barColor(category: string): string {
  switch (category) {
    case "metal":
      return "bg-gold-accent"
    case "crypto":
      return "bg-[#7d8aa5]"
    case "stablecoin":
      return "bg-positive/70"
    case "treasury":
      return "bg-warning/70"
    case "fund":
      return "bg-[#a578d8]"
    default:
      return "bg-muted"
  }
}

/**
 * Scale a per-token metal figure to fixed 10^4. The registry ships
 * gramsPerToken as a float (31.1035); the display needs exact bigint
 * math, so the float is scaled once, here, at the boundary — and the
 * rounding of a 4-decimal display figure is dust, not money.
 */
function scaled4(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10_000)
}

/** Ingot mark for metal, coin disc for everything else — inline, no font. */
function HoldingMark({ holding }: { holding: Holding }) {
  if (holding.category === "metal") {
    return (
      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-accent/40 bg-gold-accent/10">
        <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
          <path
            d="M6 1h10l5 8H1L6 1Z"
            stroke="#d8ab2e"
            strokeOpacity="0.9"
            strokeWidth="1.2"
            fill="rgba(216,171,46,0.12)"
          />
          <path d="M6 1l3 8M11 1l1.5 8M16 1l-1.5 8" stroke="#d8ab2e" strokeOpacity="0.45" strokeWidth="0.8" />
        </svg>
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-[#0b0805] text-sm font-semibold text-gold-soft"
    >
      {holding.symbol.slice(0, 1).toUpperCase()}
    </span>
  )
}

/**
 * Dashboard home: hero total, allocation, one vault card per holding.
 * The total is a floor — holdings without a fresh price are excluded,
 * never zeroed — and every figure on screen says so next to itself.
 */
export function DashboardHome() {
  const portfolio = useApiQuery("GET /api/v1/portfolio")
  const assets = useApiQuery("GET /api/v1/assets")
  const allocation = useApiQuery("GET /api/v1/portfolio/allocation")

  if (portfolio.isLoading || assets.isLoading || allocation.isLoading) {
    return (
      <div className="space-y-4" aria-label="Loading portfolio">
        <div className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-16 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    )
  }

  if (
    portfolio.isError ||
    assets.isError ||
    allocation.isError ||
    !portfolio.data ||
    !assets.data ||
    !allocation.data
  ) {
    return (
      <p role="alert" className="text-sm text-negative">
        {(portfolio.error ?? assets.error ?? allocation.error)?.message ??
          "Could not load your portfolio."}
      </p>
    )
  }

  const byId = new Map(assets.data.map((a: AssetSummary) => [a.asset.assetId, a]))
  const holdings = portfolio.data.wallets.flatMap(
    (w: Portfolio["wallets"][number]) => w.holdings,
  )
  const caveat = portfolio.data.wallets[0]?.caveat

  if (holdings.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-center text-[11px] font-semibold tracking-[0.32em] text-muted">
          CORRENTHIAN · PRIVATE VAULT
        </p>
        <div className="vault-rise rounded-2xl border border-border bg-card p-6 text-center">
          <p className="font-display text-2xl text-foreground">Your vault is empty</p>
          <p className="mt-1 text-sm text-muted">
            Buy gold or crypto to start your portfolio.
          </p>
          <Link
            href="/buy"
            className="mt-4 block w-full rounded-xl bg-[linear-gradient(180deg,#f0d67c,#d8ab2e_55%,#a37f22)] px-3 py-3 text-[15px] font-semibold text-[#1d1404] shadow-[0_6px_24px_rgba(216,171,46,0.35),inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:brightness-110"
          >
            Buy your first metal
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="vault-rise space-y-5">
      <p className="text-center text-[11px] font-semibold tracking-[0.32em] text-muted">
        CORRENTHIAN · PRIVATE VAULT
      </p>

      {/* Hero: the holder's own total, champagne numerals on obsidian. */}
      <section aria-label="Portfolio total" className="text-center">
        <p className="text-[11px] font-semibold tracking-[0.24em] text-muted">MY PORTFOLIO</p>
        <p className="font-display mt-1 text-[42px] font-semibold leading-none text-foreground">
          {formatUsdDisplay(portfolio.data.combinedUsd)}{" "}
          <span className="text-base font-normal text-muted">USD</span>
        </p>
        {portfolio.data.unpricedCount > 0 ? (
          <p className="mt-2 text-xs text-muted">
            A floor, not an exact figure — excludes {portfolio.data.unpricedCount} unpriced
            holding{portfolio.data.unpricedCount === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">Every holding priced.</p>
        )}
      </section>

      {/* Allocation: priced value by category, shares straight off the API. */}
      {allocation.data.byCategory.length > 0 && (
        <section
          aria-label="Allocation"
          className="rounded-2xl border border-border bg-card p-4"
        >
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#0b0805]"
            role="img"
            aria-label={`Allocation: ${allocation.data.byCategory
              .map(
                (c: Allocation["byCategory"][number]) =>
                  `${categoryLabel(c.category)} ${sharePct(c.shareBps)}`,
              )
              .join(", ")}`}
          >
            {allocation.data.byCategory.map((c: Allocation["byCategory"][number]) => (
              <span
                key={c.category}
                className={barColor(c.category)}
                style={{ width: `${c.shareBps / 100}%` }}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5">
            {allocation.data.byCategory.map((c: Allocation["byCategory"][number]) => (
              <li key={c.category} className="flex items-baseline justify-between text-xs">
                <span className="text-muted">
                  <span
                    aria-hidden
                    className={`mr-1.5 inline-block h-2 w-2 rounded-full ${barColor(c.category)}`}
                  />
                  {categoryLabel(c.category)}
                </span>
                <span className="text-foreground">
                  {formatUsdDisplay(c.valueUsd)}{" "}
                  <span className="text-muted">· {sharePct(c.shareBps)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Vault cards: metal in grams and ounces, crypto in tokens. */}
      <ul className="space-y-3">
        {holdings.map((h: Holding, i: number) => {
          const row = byId.get(h.assetId)
          return (
            <li
              key={`${h.assetId}-${i}`}
              className="rounded-2xl border border-border bg-card p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(240,214,124,0.08)]"
            >
              <div className="flex items-center gap-3">
                <HoldingMark holding={h} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold tracking-[0.18em] text-muted">
                    {h.name} ({h.symbol})
                  </p>
                  <p className="font-display mt-0.5 text-[26px] font-semibold leading-none text-gold-soft">
                    {h.unpriced || h.valueUsd == null
                      ? "Unpriced"
                      : formatUsdDisplay(h.valueUsd)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                {row
                  ? metalAmountParts(
                      h.balanceRaw,
                      row.asset.decimals,
                      scaled4(row.asset.backing.gramsPerToken),
                      scaled4(row.asset.backing.ouncesPerToken),
                    )
                  : h.symbol}
                {" · "}
                {h.symbol}
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

      {caveat && <p className="text-xs leading-relaxed text-muted">{caveat}</p>}
    </div>
  )
}
