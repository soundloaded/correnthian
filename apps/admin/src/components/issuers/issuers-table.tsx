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

import { RiskFlagBadge, TierBadge } from "./issuer-badges"

export type IssuerRow = Contract<"GET /api/v1/issuers">[number]

// Plain server-driven table, same arrangement as the users table: identity
// first, tier badge, risk flags inline. The list endpoint takes no filters
// and returns the whole registry, so there is no toolbar and no pagination.
export function IssuersTable({ rows }: { rows: IssuerRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Issuer</TableHead>
            <TableHead>Jurisdiction</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Risk flags</TableHead>
            <TableHead>Assets</TableHead>
            <TableHead className="w-12 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow key={row.slug}>
                <TableCell className="pl-4">
                  <Link
                    to="/issuers/$slug"
                    params={{ slug: row.slug }}
                    className="text-sm font-medium hover:underline"
                  >
                    {row.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{row.slug}</p>
                </TableCell>

                <TableCell className="text-sm">
                  {row.jurisdiction}
                </TableCell>

                <TableCell>
                  <TierBadge tier={row.verifiedTier} />
                </TableCell>

                <TableCell>
                  {row.riskFlags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {row.riskFlags.map((flag) => (
                        <RiskFlagBadge key={flag} flag={flag} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="tabular-nums">
                  {row._count.assets}
                </TableCell>

                <TableCell className="pr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false} render={<Link to="/issuers/$slug" params={{ slug: row.slug }} />}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No issuers found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
