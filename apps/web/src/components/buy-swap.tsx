"use client"

import Link from "next/link"
import { useMemo, useState, type FormEvent } from "react"
import type { Contract } from "@correnthian/api-client"
import { api } from "@/lib/api"
import { getQueryClient } from "@/lib/query-client"
import { useApiQuery } from "@/lib/use-api-query"
import { Disclosure } from "./disclosure"
import { VaultError } from "./vault-auth"

type Availability = Contract<"GET /api/v1/onramp/availability">
type QuoteDetail = Contract<"POST /api/v1/swaps/quotes">

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

/** Engine default when the holder leaves slippage untouched: 50 bps (0.5%). */
export const DEFAULT_SLIPPAGE_BPS = 50

/**
 * The holder types a display amount ("10.5"); the engine prices base-unit
 * integers ("10500000" at 6 decimals). Float math anywhere on this path
 * turns dust into money, so the conversion is string surgery only.
 */
export function isPositiveDecimalString(value: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(value)) return false
  return /[1-9]/.test(value)
}

/**
 * Display units to base-unit integer string, exactly. Returns null when
 * the value is not a plain decimal or carries more fraction digits than
 * the asset has decimals — truncating would silently shrink the order.
 */
export function toBaseUnits(amount: string, decimals: number): string | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim())
  if (!m) return null
  const frac = m[2] ?? ""
  if (frac.length > decimals) return null
  const out = `${m[1]}${frac.padEnd(decimals, "0")}`.replace(/^0+/, "")
  return out === "" ? "0" : out
}

/**
 * Base-unit integer string back to display units, exactly. Trailing
 * fraction zeros are trimmed — a minimum-received figure should read as
 * "1.5", never "1.500000".
 */
export function formatBaseUnits(raw: string, decimals: number): string {
  const digits = raw.replace(/^0+/, "") || "0"
  if (decimals === 0) return digits
  const padded = digits.padStart(decimals + 1, "0")
  const frac = padded.slice(-decimals).replace(/0+$/, "")
  return frac ? `${padded.slice(0, -decimals)}.${frac}` : padded.slice(0, -decimals)
}

export interface QuoteFormValues {
  fromAssetId: string
  toAssetId: string
  amount: string
  fromDecimals: number
  slippageBps: number
}

/**
 * Client-side shape of a quote request, checked before anything is sent.
 * The server re-validates every field — this only saves a round trip, and
 * its error copy is the form's own, never a paraphrase of a refusal.
 */
export function buildQuoteBody(
  v: QuoteFormValues,
): { ok: true; body: { fromAssetId: string; toAssetId: string; fromAmountRaw: string; slippageBps: number } } | { ok: false; error: string } {
  if (!v.fromAssetId || !v.toAssetId) return { ok: false, error: "Choose both assets." }
  if (v.fromAssetId === v.toAssetId) return { ok: false, error: "Choose two different assets." }
  if (!isPositiveDecimalString(v.amount)) return { ok: false, error: "Enter an amount above zero." }
  const raw = toBaseUnits(v.amount, v.fromDecimals)
  if (raw == null) return { ok: false, error: "That amount is more precise than this asset supports." }
  if (raw === "0") return { ok: false, error: "Enter an amount above zero." }
  if (!Number.isInteger(v.slippageBps) || v.slippageBps < 1 || v.slippageBps > 5000) {
    return { ok: false, error: "Slippage must be between 1 and 5000 basis points." }
  }
  return {
    ok: true,
    body: { fromAssetId: v.fromAssetId, toAssetId: v.toAssetId, fromAmountRaw: raw, slippageBps: v.slippageBps },
  }
}

const selectClass =
  "w-full rounded-xl border border-border bg-[#0b0805] px-3.5 py-3 text-[15px] text-foreground outline-none transition focus:border-gold-accent/70 focus:ring-2 focus:ring-gold-accent/25"
const inputClass =
  "w-full rounded-xl border border-border bg-[#0b0805] px-3.5 py-3 text-[15px] text-foreground outline-none transition placeholder:text-muted/60 focus:border-gold-accent/70 focus:ring-2 focus:ring-gold-accent/25"
const labelClass = "mb-1.5 block text-[11px] font-semibold tracking-[0.18em] text-muted"

/**
 * Path B request form — existing USDT holder asks the engine for a swap
 * quote. Creating a quote never moves money: the engine answers with a
 * price, and the holder signs in their own wallet afterwards. A refusal
 * renders as the API's own sentence, verbatim, never as a buy button.
 */
export function SwapRequestForm() {
  const assets = useApiQuery("GET /api/v1/assets")
  const [fromOverride, setFromOverride] = useState<string | null>(null)
  const [toOverride, setToOverride] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [slippage, setSlippage] = useState(String(DEFAULT_SLIPPAGE_BPS))
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [quote, setQuote] = useState<QuoteDetail | null>(null)

  const enabled = useMemo(() => (assets.data ?? []).filter((a) => a.asset.enabled), [assets.data])
  const byId = useMemo(() => new Map(enabled.map((a) => [a.asset.assetId, a])), [enabled])

  // Sensible first paint: a stablecoin into metal when the registry has
  // both, otherwise the first two enabled assets. Derived, not effected —
  // holder choices live in the overrides, so the defaults never overwrite
  // them and no effect writes state during render.
  const defaults = useMemo(() => {
    if (enabled.length === 0) return null
    const stable = enabled.find((a) => a.asset.display.category === "stablecoin")
    const from = stable ?? enabled[0]!
    const metal = enabled.find(
      (a) => a.asset.assetId !== from.asset.assetId && a.asset.display.category === "metal",
    )
    const to = metal ?? enabled.find((a) => a.asset.assetId !== from.asset.assetId)
    return { from: from.asset.assetId, to: to?.asset.assetId ?? from.asset.assetId }
  }, [enabled])

  const fromId = fromOverride ?? defaults?.from ?? ""
  const toId = toOverride ?? defaults?.to ?? ""

  if (assets.isLoading) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-4" aria-label="Loading swap form">
        <div className="h-5 w-40 animate-pulse rounded bg-muted/20" />
        <div className="h-12 animate-pulse rounded-xl bg-muted/20" />
        <div className="h-12 animate-pulse rounded-xl bg-muted/20" />
        <div className="h-12 animate-pulse rounded-xl bg-muted/20" />
      </div>
    )
  }

  if (assets.isError || !assets.data) {
    return <Refusal text={assets.error?.message ?? "Could not load assets."} />
  }

  if (enabled.length === 0) {
    return <Refusal text="No swap-enabled assets right now." />
  }

  // Data landed but a paint has not resolved defaults yet — holder
  // choices live in the overrides, so an undefaulted paint would show
  // blank selects. Skeleton instead; the memo above fills them.
  if (!defaults) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-4" aria-label="Loading swap form">
        <div className="h-5 w-40 animate-pulse rounded bg-muted/20" />
        <div className="h-12 animate-pulse rounded-xl bg-muted/20" />
        <div className="h-12 animate-pulse rounded-xl bg-muted/20" />
        <div className="h-12 animate-pulse rounded-xl bg-muted/20" />
      </div>
    )
  }

  if (quote) {
    // The live engine answers 201 with `executionQuality: none` when no
    // provider is contracted. A fresh detail carries `executable`, so the
    // same refusal rule the mine list uses applies here directly: a quote
    // the engine cannot fill renders as a constraint, never as an offer.
    if (!quote.executable) {
      return (
        <div className="space-y-3">
          <Refusal
            text={`Quoted ${quote.state} with ${quote.executionQuality} execution quality — the engine cannot fill it right now. No money moved.`}
          />
          <button
            type="button"
            onClick={() => {
              setQuote(null)
              setAmount("")
              setServerError(null)
            }}
            className="text-sm text-muted underline-offset-4 transition hover:text-foreground hover:underline"
          >
            Request another
          </button>
        </div>
      )
    }
    const toAsset = byId.get(toId)
    const minReceived =
      toAsset != null ? `${formatBaseUnits(quote.minReceivedRaw, toAsset.asset.decimals)} ${toAsset.asset.symbol}` : null
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium">Quote requested</p>
        <p className="mt-1 text-sm text-muted">
          State {quote.state} · quality {quote.executionQuality}
          {minReceived ? ` · at least ${minReceived}` : ""}
          {` · expires ${new Date(quote.expiresAt).toLocaleString()}`}
        </p>
        <button
          type="button"
          onClick={() => {
            setQuote(null)
            setAmount("")
            setServerError(null)
          }}
          className="mt-3 text-sm text-muted underline-offset-4 transition hover:text-foreground hover:underline"
        >
          Request another
        </button>
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    setFieldError(null)
    setServerError(null)
    const from = byId.get(fromId)
    if (!from) {
      setFieldError("Choose the asset you are swapping from.")
      return
    }
    const slippageBps = slippage.trim() === "" ? DEFAULT_SLIPPAGE_BPS : Number(slippage)
    const built = buildQuoteBody({
      fromAssetId: fromId,
      toAssetId: toId,
      amount: amount.trim(),
      fromDecimals: from.asset.decimals,
      slippageBps,
    })
    if (!built.ok) {
      setFieldError(built.error)
      return
    }
    // One key per submit, minted at submit time: a double-click retries the
    // same key only if the first request is still in flight, and the
    // pending flag already blocks that. A later resubmit mints a fresh key
    // because the holder means it again.
    setPending(true)
    const result = await api.request("POST /api/v1/swaps/quotes", {
      body: built.body,
      idempotencyKey: crypto.randomUUID(),
    })
    setPending(false)
    if (result.status === "ok") {
      setQuote(result.data)
      await getQueryClient().invalidateQueries({ queryKey: ["GET /api/v1/swaps/quotes/mine"] })
      return
    }
    setServerError(
      result.status === "unauthorised" ? "Your session expired. Sign in again." : result.message,
    )
  }

  const error = fieldError ?? serverError

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-sm font-medium">Request a swap</p>
        <p className="mt-1 text-sm text-muted">
          A quote is a price, not a trade — nothing moves until you sign in your wallet.
        </p>
      </div>
      <div>
        <label htmlFor="swap-from" className={labelClass}>
          FROM
        </label>
        <select
          id="swap-from"
          value={fromId}
          onChange={(e) => setFromOverride(e.target.value)}
          className={selectClass}
        >
          {enabled.map((a) => (
            <option key={a.asset.assetId} value={a.asset.assetId}>
              {a.asset.symbol} — {a.asset.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="swap-to" className={labelClass}>
          TO
        </label>
        <select id="swap-to" value={toId} onChange={(e) => setToOverride(e.target.value)} className={selectClass}>
          {enabled.map((a) => (
            <option key={a.asset.assetId} value={a.asset.assetId}>
              {a.asset.symbol} — {a.asset.name}
            </option>
          ))}
        </select>
        {(() => {
          const toAsset = toId ? byId.get(toId) : undefined
          return toAsset ? <div className="mt-2"><Disclosure text={toAsset.disclosure} /></div> : null
        })()}
      </div>
      <div>
        <label htmlFor="swap-amount" className={labelClass}>
          AMOUNT
        </label>
        <input
          id="swap-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          autoComplete="off"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="swap-slippage" className={labelClass}>
          SLIPPAGE (BASIS POINTS)
        </label>
        <input
          id="swap-slippage"
          value={slippage}
          onChange={(e) => setSlippage(e.target.value)}
          placeholder={String(DEFAULT_SLIPPAGE_BPS)}
          inputMode="numeric"
          autoComplete="off"
          className={inputClass}
        />
      </div>
      {error && <VaultError>{error}</VaultError>}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(180deg,#f0d67c,#d8ab2e_55%,#a37f22)] px-3 py-3 text-[15px] font-semibold text-[#1d1404] shadow-[0_6px_24px_rgba(216,171,46,0.35),inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:brightness-110 active:brightness-95 disabled:opacity-60 disabled:shadow-none"
      >
        {pending && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="animate-spin">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
            <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        {pending ? "Requesting…" : "Request quote"}
      </button>
      <Link
        href="/"
        className="block text-center text-sm text-muted underline-offset-4 transition hover:text-foreground hover:underline"
      >
        Cancel — back to portfolio
      </Link>
    </form>
  )
}
