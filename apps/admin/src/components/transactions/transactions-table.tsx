"use client"

import { Link } from "@tanstack/react-router"

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

import { TxDirectionBadge, TxStateBadge } from "./transaction-badges"

export type TransactionRow = Contract<"GET /api/v1/transactions">["items"][number]

// Plain server-driven table, same arrangement as the users table: identity
// first, badges for the enumerated states, dates muted. Amounts render raw —
// the row carries no decimals, so formatting would invent precision.
export function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Transaction</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Chain</TableHead>
            <TableHead>Confirmations</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="w-12 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={row.state === "failed" ? "opacity-60" : ""}
              >
                <TableCell className="pl-4">
                  <Link
                    to="/transactions/$txId"
                    params={{ txId: row.id }}
                    className="font-mono text-sm font-medium hover:underline"
                    title={row.id}
                  >
                    {row.id.slice(0, 8)}…
                  </Link>
                </TableCell>

                <TableCell>
                  <TxStateBadge state={row.state} />
                </TableCell>

                <TableCell>
                  <TxDirectionBadge direction={row.direction} />
                </TableCell>

                <TableCell className="text-sm font-medium">
                  {row.asset.symbol}
                </TableCell>

                <TableCell className="tabular-nums">
                  {row.amountRaw}
                  {row.amountUsd !== null && (
                    <span className="text-muted-foreground">
                      {" "}
                      · ${row.amountUsd.toLocaleString()}
                    </span>
                  )}
                </TableCell>

                <TableCell>
                  <span className="text-sm">{row.user.email}</span>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {row.chain.name}
                </TableCell>

                <TableCell className="tabular-nums text-muted-foreground">
                  {row.confirmations}/{row.requiredConfirmations}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {formatDate(row.updatedAt)}
                </TableCell>

                <TableCell className="pr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={
                      <Link to="/transactions/$txId" params={{ txId: row.id }} />
                    }
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={10}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No transactions found.
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
