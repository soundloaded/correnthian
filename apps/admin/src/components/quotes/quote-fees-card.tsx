"use client"

import { ReceiptTextIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { QuoteDetail } from "./quote-details-header"

// The itemised fee breakdown, verbatim: one named line per fee, and an honest
// unknown rather than a zero nobody computed. Amounts are exact decimal
// strings and render as-is.
export function QuoteFeesCard({ quote }: { quote: QuoteDetail }) {
  const fees = quote.fees

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ReceiptTextIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Fees — {fees.operation}</p>
        </div>
        {!fees.complete && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            incomplete
          </span>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Notional (USD)</p>
          <p className="font-mono text-sm font-medium">
            {fees.notionalUsd ?? "unknown — no basis"}
          </p>
        </div>

        <div className="divide-y rounded-lg border">
          {fees.lines.map((line) => (
            <div
              key={line.kind}
              className="flex items-start justify-between gap-3 px-3 py-2.5"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {line.label}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {line.kind}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {line.status === "computed"
                    ? line.basis === "spread"
                      ? "spread — named and visible"
                      : line.rateBps !== null
                        ? `${(line.rateBps / 100).toFixed(2)}%`
                        : "fixed amount"
                    : (line.reason ?? "unknown")}
                </p>
              </div>
              <p className="font-mono text-sm font-medium tabular-nums">
                {line.amountUsd ?? "unknown"}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Known subtotal — not a total
          </p>
          <p className="font-mono text-sm font-medium tabular-nums">
            {fees.knownSubtotalUsd}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-mono text-sm font-medium tabular-nums">
            {fees.totalUsd ?? "unknown — a line is undetermined"}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
