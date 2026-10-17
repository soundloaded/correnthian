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
import { cn } from "@correnthian/ui/lib/utils"
import type { Contract } from "@correnthian/api-client"

import { ReviewStatusBadge, SanctionsBadge } from "./review-badges"

export type ReviewRow = Contract<"GET /api/v1/compliance/reviews">[number]

// Oldest first, as the endpoint answers: the longest-waiting decision is
// the one an operator should make next. A sanctions-hit row takes the
// destructive tone on the row itself, not just the badge — it freezes the
// account, so it must read as the row to act on first.
export function ReviewsTable({
  rows,
  canDecide,
  onDecide,
}: {
  rows: ReviewRow[]
  canDecide: boolean
  onDecide: (review: ReviewRow) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Account</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sanctions</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Waiting since</TableHead>
            <TableHead className="w-24 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => {
              const hit = row.sanctionsResult === "hit"
              return (
                <TableRow
                  key={row.userId}
                  className={cn(hit && "bg-destructive/5")}
                >
                  <TableCell className="pl-4">
                    <Link
                      to="/users/$userId"
                      params={{ userId: row.userId }}
                      className="text-sm font-medium hover:underline"
                    >
                      {row.email}
                    </Link>
                  </TableCell>

                  <TableCell>
                    <ReviewStatusBadge status={row.status} />
                  </TableCell>

                  <TableCell>
                    <SanctionsBadge result={row.sanctionsResult} />
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {row.providerRef ?? row.provider}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {formatDate(row.updatedAt)}
                  </TableCell>

                  <TableCell className="pr-4">
                    {canDecide && (
                      <Button
                        variant={hit ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => onDecide(row)}
                      >
                        Decide
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No profiles awaiting review. The queue is clear — this is an
                all-clear, not a failed read.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString()
}
