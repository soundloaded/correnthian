"use client"

import type { ReactNode } from "react"
import { TagsIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import { QuoteStateBadge, RailKindBadge } from "./quote-badges"
import type { QuoteDetail } from "./quote-details-header"

// Icon + label + value rows, same rhythm as the user information card. Raw
// amounts render unformatted: no decimals travel with the quote, so
// formatting would invent precision.
export function QuoteInformationCard({ quote }: { quote: QuoteDetail }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <TagsIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Quote</p>
        </div>
      </CardHeader>

      <CardContent className="divide-y">
        <InfoRow label="From (raw)">
          <span className="font-mono text-sm font-medium">
            {quote.fromAmountRaw}
          </span>
        </InfoRow>

        <InfoRow label="To (raw)">
          <span className="font-mono text-sm font-medium">
            {quote.toAmountRaw}
          </span>
        </InfoRow>

        <InfoRow label="Minimum received (raw)">
          <span className="font-mono text-sm font-medium">
            {quote.minReceivedRaw}
          </span>
        </InfoRow>

        <InfoRow label="Slippage">
          <span className="text-sm font-medium tabular-nums">
            {(quote.slippageBps / 100).toFixed(2)}%
          </span>
        </InfoRow>

        <InfoRow label="Price impact">
          <span className="text-sm font-medium tabular-nums">
            {(quote.priceImpactBps / 100).toFixed(2)}%
          </span>
        </InfoRow>

        <InfoRow label="State">
          <QuoteStateBadge state={quote.state} />
        </InfoRow>

        <InfoRow label="Rail">
          <div className="flex flex-wrap items-center gap-2">
            <RailKindBadge kind={quote.rail.kind} />
            <span className="font-mono text-xs text-muted-foreground">
              {quote.rail.id}
            </span>
          </div>
        </InfoRow>

        <InfoRow label="Expires">
          <span className="text-sm font-medium">
            {formatDateTime(quote.expiresAt)}
          </span>
        </InfoRow>
      </CardContent>
    </Card>
  )
}

function InfoRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
