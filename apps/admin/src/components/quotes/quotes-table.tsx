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

import {
  ExecutionQualityBadge,
  QuoteStateBadge,
  RailKindBadge,
} from "./quote-badges"

export type QuoteRow = Contract<"GET /api/v1/swaps/quotes">["items"][number]

// Plain server-driven table, same arrangement as the users table. sizeCapUsd
// and executionQuality are first-class columns: those two fields are why a
// quote is or is not fillable. executable renders as the honest read of the
// two, not a third opinion.
export function QuotesTable({ rows }: { rows: QuoteRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Quote</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Pair</TableHead>
            <TableHead>Rail</TableHead>
            <TableHead>Notional</TableHead>
            <TableHead>Size cap</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead>Executable</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="w-12 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={!row.executable ? "opacity-60" : ""}
              >
                <TableCell className="pl-4">
                  <Link
                    to="/quotes/$quoteId"
                    params={{ quoteId: row.id }}
                    className="font-mono text-sm font-medium hover:underline"
                    title={row.id}
                  >
                    {row.id.slice(0, 8)}…
                  </Link>
                </TableCell>

                <TableCell>
                  <QuoteStateBadge state={row.state} />
                </TableCell>

                <TableCell className="text-sm font-medium">
                  {row.fromAsset.symbol} → {row.toAsset.symbol}
                </TableCell>

                <TableCell>
                  <RailKindBadge kind={row.railKind} />
                </TableCell>

                <TableCell className="tabular-nums">
                  {row.notionalUsd === null
                    ? "—"
                    : `$${row.notionalUsd.toLocaleString()}`}
                </TableCell>

                <TableCell className="tabular-nums">
                  {row.sizeCapUsd === null
                    ? "—"
                    : `$${row.sizeCapUsd.toLocaleString()}`}
                </TableCell>

                <TableCell>
                  <ExecutionQualityBadge quality={row.executionQuality} />
                </TableCell>

                <TableCell className="tabular-nums">
                  {row.executable ? "Yes" : "No"}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {formatDate(row.expiresAt)}
                </TableCell>

                <TableCell className="pr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false} render={
                      <Link to="/quotes/$quoteId" params={{ quoteId: row.id }} />
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
                No quotes found.
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
