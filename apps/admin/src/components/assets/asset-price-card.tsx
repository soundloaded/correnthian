"use client"

import * as React from "react"
import { LineChartIcon } from "lucide-react"

import type { ApiResult } from "@correnthian/api-client"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { Input } from "@correnthian/ui/components/input"
import { Label } from "@correnthian/ui/components/label"

import { api } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { rankAtLeast } from "@/lib/roles"
import { useApiQuery } from "@/lib/use-api-query"

/**
 * The price book for one asset.
 *
 * A reference price with a named source, and whether it is still fresh.
 * Everything here comes from the API: the console never prices an asset
 * itself, because a price the console computes and the engine disagrees
 * with is a fee computed from a number that does not exist.
 *
 * The write is the one manual price entry the platform has: `POST
 * /pricing/record` records a reference price from a named source. It is
 * not a valuation opinion — it is a row saying what a source said, and
 * when.
 */
export function AssetPriceCard({ assetId }: { assetId: string }) {
  const role = getSession()?.role ?? "user"
  const canWrite = rankAtLeast(role, "support")
  const latest = useApiQuery("GET /api/v1/pricing/assets/:assetId", { assetId })
  const history = useApiQuery("GET /api/v1/pricing/assets/:assetId/history", { assetId })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <LineChartIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Reference price</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {latest.isPending ? (
          <p className="text-sm text-muted-foreground">Loading price…</p>
        ) : latest.isError || !latest.data ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm font-medium">Could not load the price</p>
            <p className="text-xs text-muted-foreground">
              The API did not answer. This is not an all-clear.
            </p>
            <Button variant="outline" size="sm" onClick={() => latest.refetch()}>
              Retry
            </Button>
          </div>
        ) : !latest.data.found ? (
          <p className="text-sm text-muted-foreground">
            No price on record — {latest.data.reason}. The fees engine will
            report fees as unknown rather than guessing from nothing.
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-xl font-semibold tabular-nums">
              ${latest.data.priceUsd.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {latest.data.source} · {ageText(latest.data.ageSeconds)}
              {latest.data.stale ? " — stale" : ""}
            </p>
          </div>
        )}

        {canWrite && (
          <RecordPriceForm
            assetId={assetId}
            onRecorded={() => {
              void latest.refetch()
              void history.refetch()
            }}
          />
        )}

        {history.data && history.data.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Recent</p>
            {history.data.slice(0, 5).map((point, i) => (
              <div
                key={`${point.capturedAt}-${i}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="tabular-nums">
                  ${Number(point.priceUsd).toLocaleString()}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {point.source} · {new Date(point.capturedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Record a reference price from a named source.
 *
 * The source is mandatory and free-text is deliberate: a price without a
 * source is not usable, and the source is what makes it auditable. What is
 * recorded is what a source said, not what the operator thinks it is worth.
 */
function RecordPriceForm({
  assetId,
  onRecorded,
}: {
  assetId: string
  onRecorded: () => void
}) {
  const [price, setPrice] = React.useState("")
  const [source, setSource] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    setError(null)
    const value = Number(price.trim())
    if (price.trim() === "" || !Number.isFinite(value) || value <= 0) {
      setError("The price must be a positive number.")
      return
    }
    if (source.trim().length < 2) {
      setError("Name the source — a price without one is not usable.")
      return
    }
    setSaving(true)
    const result = await api.request("POST /api/v1/pricing/record", {
      method: "POST",
      body: { assetId, priceUsd: value, source: source.trim() },
    })
    setSaving(false)
    if (result.status === "ok") {
      setPrice("")
      setSource("")
      onRecorded()
      return
    }
    setError(toMessage(result))
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Record a price</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="price-usd">Price (USD)</Label>
          <Input
            id="price-usd"
            className="w-32"
            inputMode="decimal"
            value={price}
            placeholder="0.00"
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="min-w-36 flex-1 space-y-1">
          <Label htmlFor="price-source">Source</Label>
          <Input
            id="price-source"
            value={source}
            placeholder="e.g. LBMA PM fix"
            onChange={(e) => setSource(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Recording…" : "Record"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function ageText(ageSeconds: number): string {
  if (ageSeconds < 60) return `${ageSeconds}s old`
  if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)}m old`
  return `${Math.floor(ageSeconds / 3600)}h old`
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
