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

import { DeployBadge, KindBadge, PrimaryBadge } from "./wallet-badges"

export type WalletRow = Contract<"GET /api/v1/wallets">[number]

// Same arrangement as the users table: identity first, badges for the
// enumerated states, counts muted. The list endpoint takes no filters and
// returns the whole registry, so there is no toolbar and no pagination.
export function WalletsTable({ rows }: { rows: WalletRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Address</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Deploy</TableHead>
            <TableHead>Primary</TableHead>
            <TableHead>Guardians</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead className="w-12 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="pl-4">
                  <Link
                    to="/wallets/$walletId"
                    params={{ walletId: row.id }}
                    className="font-mono text-sm font-medium hover:underline"
                  >
                    {row.display}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.label ?? "no label"} · {row.chainId}
                  </p>
                </TableCell>

                <TableCell>
                  <KindBadge kind={row.kind} />
                </TableCell>

                <TableCell>
                  <DeployBadge kind={row.kind} deployed={row.deployed} />
                </TableCell>

                <TableCell>
                  <PrimaryBadge isPrimary={row.isPrimary} />
                </TableCell>

                <TableCell className="tabular-nums">
                  {row.guardians.length}
                </TableCell>

                <TableCell className="text-sm tabular-nums text-muted-foreground">
                  {row._count.accounts} accounts · {row._count.transactions} txns
                </TableCell>

                <TableCell className="pr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link to="/wallets/$walletId" params={{ walletId: row.id }} />}
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
                No wallets registered to this account.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
