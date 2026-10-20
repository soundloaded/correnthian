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

import { ActiveBadge, KindBadge, OperationBadge } from "./fee-badges"

export type FeeRuleRow = Contract<"GET /api/v1/fees/rules">[number]

// Same arrangement as the users table: identity first, badges for the
// enumerated states, rate and priority as the operator-significant numbers.
// Inactive rows dim — they price nothing until reactivated.
export function FeesTable({ rows }: { rows: FeeRuleRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Rule</TableHead>
            <TableHead>Operation</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="w-12 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={!row.active ? "opacity-60" : ""}
              >
                <TableCell className="pl-4">
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">{row.id}</p>
                </TableCell>

                <TableCell>
                  <OperationBadge operation={row.operation} />
                </TableCell>

                <TableCell>
                  <KindBadge kind={row.kind} />
                </TableCell>

                <TableCell className="text-sm tabular-nums">
                  {formatRate(row)}
                </TableCell>

                <TableCell className="tabular-nums">
                  {row.priority}
                </TableCell>

                <TableCell>
                  <ActiveBadge active={row.active} />
                </TableCell>

                <TableCell className="pr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false} render={<Link to="/fees/$ruleId" params={{ ruleId: row.id }} />}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No fee rules found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// A rule states either a rate or an amount, never both (DTO-enforced): the
// column reads whichever the basis demands, and names the basis with it.
function formatRate(row: FeeRuleRow): string {
  if (row.basis === "fixed") {
    return row.fixedUsd != null ? `$${row.fixedUsd} fixed` : "fixed — no amount"
  }
  if (row.rateBps == null) return `${row.basis} — no rate`
  return `${(row.rateBps / 100).toFixed(2)}% ${row.basis}`
}
