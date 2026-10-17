"use client"

import { GaugeIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import { ExecutionQualityBadge } from "./quote-badges"
import type { QuoteDetail } from "./quote-details-header"

// Why this quote can or cannot fill. executable is the honest read of the
// two fields above it, not a third opinion — so it renders beneath them,
// with the sentence that makes the read explicit.
export function QuoteFillabilityCard({ quote }: { quote: QuoteDetail }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <GaugeIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Fillability</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Execution quality</p>
          <ExecutionQualityBadge quality={quote.executionQuality} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Size cap (USD)</p>
          <p className="text-sm font-medium tabular-nums">
            {quote.sizeCapUsd === null
              ? "None disclosed"
              : `$${quote.sizeCapUsd.toLocaleString()}`}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Executable</p>
          <p className="text-sm font-medium">{quote.executable ? "Yes" : "No"}</p>
        </div>

        <p className="text-sm text-muted-foreground">
          {quote.executable
            ? "Execution quality is deep and the size cap covers this quote — the read above follows from those two facts."
            : "Not fillable as shown: the market is thin or undisclosed at this size, or the cap does not cover it. The read above follows from those two facts."}
        </p>
      </CardContent>
    </Card>
  )
}
