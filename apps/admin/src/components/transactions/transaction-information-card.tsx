"use client"

import type { ReactNode } from "react"
import { ReceiptTextIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import { TxDirectionBadge, TxStateBadge } from "./transaction-badges"
import type { TransactionDetail } from "./transaction-details-header"

// Icon + label + value rows, same rhythm as the user information card. Amounts
// render raw: the row carries no decimals, so formatting would invent
// precision. Absent values read as "Not provided" rather than a blank.
export function TransactionInformationCard({ tx }: { tx: TransactionDetail }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ReceiptTextIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Intent</p>
        </div>
      </CardHeader>

      <CardContent className="divide-y">
        <InfoRow label="Amount (raw)">
          <span className="font-mono text-sm font-medium">{tx.amountRaw}</span>
        </InfoRow>

        <InfoRow label="Amount (USD)">
          <span className="text-sm font-medium">
            {tx.amountUsd === null ? <EmptyValue /> : `$${tx.amountUsd.toLocaleString()}`}
          </span>
        </InfoRow>

        <InfoRow label="State">
          <TxStateBadge state={tx.state} />
        </InfoRow>

        <InfoRow label="Direction">
          <TxDirectionBadge direction={tx.direction} />
        </InfoRow>

        <InfoRow label="Destination">
          <span className="break-all font-mono text-sm font-medium">
            {tx.destination ?? <EmptyValue />}
          </span>
        </InfoRow>

        <InfoRow label="Transaction hash">
          <span className="break-all font-mono text-sm font-medium">
            {tx.txHash ?? <EmptyValue />}
          </span>
        </InfoRow>

        <InfoRow label="Fee (raw)">
          <span className="font-mono text-sm font-medium">
            {tx.feeRaw ?? <EmptyValue />}
          </span>
        </InfoRow>

        <InfoRow label="Expires">
          <span className="text-sm font-medium">
            {tx.expiresAt ? formatDateTime(tx.expiresAt) : "No expiry"}
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

function EmptyValue() {
  return <span className="text-sm text-muted-foreground">Not provided</span>
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
