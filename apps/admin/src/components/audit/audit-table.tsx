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

import { OutcomeBadge } from "./audit-badges"

export type AuditRow = Contract<"GET /api/v1/audit">[number]

// The reason is a list column, not one click away: it is the answer to the
// question an operator opens the trail with ("why was this disabled"). A
// denied row takes the destructive tone on the row itself — it is the row
// an investigator is most likely hunting.
export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Request</TableHead>
            <TableHead>When</TableHead>
            <TableHead className="w-12 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(row.outcome === "denied" && "bg-destructive/5")}
              >
                <TableCell className="pl-4">
                  <Link
                    to="/audit/$auditId"
                    params={{ auditId: row.id }}
                    className="text-sm font-medium hover:underline"
                  >
                    {row.action}
                  </Link>
                  {(row.targetType || row.targetId) && (
                    <p className="text-xs text-muted-foreground">
                      {[row.targetType, row.targetId && shorten(row.targetId)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {row.actorEmail ?? row.actorId ?? "system"}
                </TableCell>

                <TableCell>
                  <OutcomeBadge outcome={row.outcome} />
                </TableCell>

                <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
                  {row.reason ?? "—"}
                </TableCell>

                <TableCell className="max-w-32 truncate font-mono text-xs text-muted-foreground">
                  {row.requestId ?? "—"}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {formatDateTime(row.createdAt)}
                </TableCell>

                <TableCell className="pr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false} render={<Link to="/audit/$auditId" params={{ auditId: row.id }} />}
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
                No audit entries match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function shorten(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}
