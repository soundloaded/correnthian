"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@correnthian/ui/components/table"
import { Button } from "@correnthian/ui/components/button"
import type { Contract } from "@correnthian/api-client"

import { RedemptionStateBadge } from "./redemption-badges"
import { ALLOWED_NEXT } from "./redemption-transitions"

export type RedemptionRow =
  Contract<"GET /api/v1/redemptions">["items"][number]

// Plain server-driven table, same arrangement as the users table. There is no
// GET /redemptions/:id, so rows carry no View link — the queue acts inline.
// Non-terminal rows offer Advance; terminal ones state that they are final.
export function RedemptionsTable({
  rows,
  canTransition,
  onTransition,
}: {
  rows: RedemptionRow[]
  canTransition: boolean
  onTransition: (row: RedemptionRow) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Request</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead className="w-24 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => {
              const next = ALLOWED_NEXT[row.state] ?? []
              return (
                <TableRow
                  key={row.id}
                  className={
                    row.state === "rejected" || row.state === "cancelled"
                      ? "opacity-60"
                      : ""
                  }
                >
                  <TableCell className="pl-4">
                    <span
                      className="font-mono text-sm font-medium"
                      title={row.id}
                    >
                      {row.id.slice(0, 8)}…
                    </span>
                  </TableCell>

                  <TableCell>
                    <RedemptionStateBadge state={row.state} />
                  </TableCell>

                  <TableCell className="text-sm font-medium">
                    {row.asset.symbol}
                  </TableCell>

                  <TableCell className="font-mono tabular-nums">
                    {row.amountRaw}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {row.provider.name}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {formatDate(row.requestedAt)}
                  </TableCell>

                  <TableCell className="pr-4">
                    {next.length > 0 && canTransition ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTransition(row)}
                      >
                        Advance
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {next.length === 0 ? "Final" : ""}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No redemption requests found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString()
}
