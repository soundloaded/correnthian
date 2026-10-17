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

import { AccountStatusBadge, KycBadge, RoleBadge } from "./user-badges"

export type UserRow = Contract<"GET /api/v1/users">["items"][number]

// Plain server-driven table, same arrangement as the team table: identity
// first, badges for the enumerated states, dates muted. No display-name
// column — the list projection does not return one, and a column of
// "not provided" would lie about the data.
export function UsersTable({ rows }: { rows: UserRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Account</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>KYC</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Wallets</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={row.status !== "active" ? "opacity-60" : ""}
              >
                <TableCell className="pl-4">
                  <Link
                    to="/users/$userId"
                    params={{ userId: row.id }}
                    className="text-sm font-medium hover:underline"
                  >
                    {row.email}
                  </Link>
                </TableCell>

                <TableCell>
                  <RoleBadge role={row.role} />
                </TableCell>

                <TableCell>
                  <KycBadge status={row.kycStatus} />
                </TableCell>

                <TableCell>
                  <AccountStatusBadge status={row.status} />
                </TableCell>

                <TableCell className="tabular-nums">
                  {row._count.wallets}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {formatDate(row.lastLoginAt)}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {formatDate(row.createdAt)}
                </TableCell>

                <TableCell className="pr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link to="/users/$userId" params={{ userId: row.id }} />}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={8}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No users found.
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
