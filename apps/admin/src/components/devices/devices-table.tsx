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
import { Badge } from "@correnthian/ui/components/badge"
import { cn } from "@correnthian/ui/lib/utils"
import type { Contract } from "@correnthian/api-client"

export type DeviceRow = Contract<"GET /api/v1/devices/all">["items"][number]

// Revoked rows render dimmed with a destructive badge, never hidden:
// revocation is soft-deleted precisely so the trail survives, and a
// console that hides it makes a revocation unverifiable. A device row
// proves nothing about custody — public key and platform only, never key
// material — so it carries no more sensitivity than the account beside it.
export function DevicesTable({ rows }: { rows: DeviceRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Device</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last seen</TableHead>
            <TableHead>Trusted</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => {
              const revoked = row.revokedAt !== null
              return (
                <TableRow
                  key={row.id}
                  className={cn(revoked && "opacity-60")}
                >
                  <TableCell className="pl-4">
                    <span className="font-mono text-sm font-medium">{shorten(row.id)}</span>
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                  </TableCell>

                  <TableCell>
                    <Link
                      to="/users/$userId"
                      params={{ userId: row.user.id }}
                      className="text-sm font-medium hover:underline"
                    >
                      {row.user.email}
                    </Link>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {row.platform}
                  </TableCell>

                  <TableCell>
                    {revoked ? (
                      <Badge variant="destructive" className="rounded-md px-2 py-0.5 text-xs font-medium">
                        revoked
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="rounded-md border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                      >
                        active
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {formatDateTime(row.lastSeenAt)}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {formatDate(row.trustedAt)}
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
                No devices match these filters.
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

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString()
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}
