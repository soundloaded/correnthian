"use client"

import * as React from "react"

import { CalculatorIcon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult, Contract } from "@correnthian/api-client"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { Input } from "@correnthian/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

const OPERATION_OPTIONS = ["swap", "buy", "sell", "redeem", "onramp", "offramp"]

type Breakdown = Contract<"POST /api/v1/fees/preview">

// The same inputs a quote passes, so an operator sees what a rule change
// would do before saving it. Preview is the lowest privilege of the three
// fee capabilities — any signed-in account — and exposes no rule ids, so
// there is no role gate here. A zero fee and an unknown fee are different
// things, and the result reads them differently.
export function FeePreviewCard({ defaultOperation }: { defaultOperation?: string }) {
  const [operation, setOperation] = React.useState(defaultOperation ?? "swap")
  const [assetId, setAssetId] = React.useState("")
  const [notionalUsd, setNotionalUsd] = React.useState("")
  const [providerSlug, setProviderSlug] = React.useState("")
  const [country, setCountry] = React.useState("")
  const [result, setResult] = React.useState<Breakdown | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)

  const runPreview = async () => {
    if (assetId.trim() === "") {
      setError("An asset id is required — the preview prices a concrete holding.")
      return
    }
    setRunning(true)
    setError(null)
    const response = await api.request("POST /api/v1/fees/preview", {
      body: {
        operation,
        assetId: assetId.trim(),
        ...(providerSlug.trim() === "" ? {} : { providerSlug: providerSlug.trim() }),
        ...(notionalUsd.trim() === "" ? {} : { notionalUsd: notionalUsd.trim() }),
        ...(country.trim() === "" ? {} : { country: country.trim() }),
      },
    })
    setRunning(false)
    if (response.status === "ok") setResult(response.data)
    else setError(toMessage(response))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CalculatorIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Preview — what would this cost?</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select value={operation} onValueChange={(value) => value && setOperation(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATION_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Asset id…"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          />
          <Input
            placeholder="Notional USD (optional)…"
            value={notionalUsd}
            onChange={(e) => setNotionalUsd(e.target.value)}
            inputMode="decimal"
          />
          <Input
            placeholder="Provider slug (optional)…"
            value={providerSlug}
            onChange={(e) => setProviderSlug(e.target.value)}
          />
          <Input
            placeholder="Country ISO-2 (optional)…"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            maxLength={2}
          />
        </div>

        <Button size="sm" variant="outline" onClick={runPreview} disabled={running}>
          {running ? "Pricing…" : "Run preview"}
        </Button>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="divide-y">
              {result.lines.map((line) => (
                <div key={line.kind} className="flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium">{line.kind}</p>
                  {line.status === "computed" && line.amountUsd != null ? (
                    <p className="text-sm tabular-nums">${line.amountUsd}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground" title={line.reason ?? ""}>
                      unknown — {line.reason ?? "no reason given"}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <p className="text-sm font-semibold">Total</p>
              {result.totalUsd != null ? (
                <p className="text-sm font-semibold tabular-nums">${result.totalUsd}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  no total — subtotal of known lines ${result.knownSubtotalUsd}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
