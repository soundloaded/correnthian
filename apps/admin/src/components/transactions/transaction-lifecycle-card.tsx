"use client"

import { HistoryIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { TransactionDetail } from "./transaction-details-header"

// The lifecycle, read-only. permittedNext is the API's own statement of which
// edges are legal — rendered as text so the console cannot offer a button the
// API would refuse. Transitions arrive from accounts and nodes; there is no
// console affordance to advance one, and broadcast is system-side.
export function TransactionLifecycleCard({ tx }: { tx: TransactionDetail }) {
  const stamps: Array<[string, string | null]> = [
    ["Signed", tx.signedAt],
    ["Broadcast", tx.broadcastAt],
    ["Confirmed", tx.confirmedAt],
    ["Failed", tx.failedAt],
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Lifecycle</p>
        </div>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
          {tx.confirmations}/{tx.requiredConfirmations} confirmations
        </span>
      </CardHeader>

      <CardContent className="space-y-3">
        {stamps.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">
              {value ? formatDateTime(value) : "—"}
            </p>
          </div>
        ))}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Mempool drops</p>
          <p className="text-sm font-medium tabular-nums">
            {tx.dropCount > 0 ? (
              <>
                {tx.dropCount}
                {tx.droppedAt ? ` · last ${formatDateTime(tx.droppedAt)}` : ""}
                {tx.lastSeenAt ? ` · seen ${formatDateTime(tx.lastSeenAt)}` : ""}
              </>
            ) : (
              "None"
            )}
          </p>
        </div>

        {tx.errorCode && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="font-mono text-xs font-medium text-destructive">
              {tx.errorCode}
            </p>
            {tx.errorMessage && (
              <p className="mt-1 text-sm text-muted-foreground">
                {tx.errorMessage}
              </p>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {tx.permittedNext.length > 0 ? (
            <>
              May next move to:{" "}
              <span className="font-medium text-foreground">
                {tx.permittedNext.join(", ").replaceAll("_", " ")}
              </span>
              . Edges are reported by the account or the node — the console
              observes, it does not advance.
            </>
          ) : (
            "Terminal state — no further edges. This is final."
          )}
        </p>
      </CardContent>
    </Card>
  )
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
