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

import { AttestationBadge, CustodyBadge, EnabledBadge, TierBadge } from "./asset-badges"

export type AssetRow = Contract<"GET /api/v1/assets">[number]

// Plain server-driven table, same arrangement as the users table: identity
// first, badges for the enumerated states, dates muted. No issuer-name join
// on the client — the row already carries `issuer.issuerName`.
export function AssetsTable({ rows }: { rows: AssetRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Asset</TableHead>
            <TableHead>Issuer</TableHead>
            <TableHead>Custody</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Attestation</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="w-12 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow
                key={row.asset.assetId}
                className={!row.asset.enabled ? "opacity-60" : ""}
              >
                <TableCell className="pl-4">
                  <Link
                    to="/assets/$assetId"
                    params={{ assetId: row.asset.assetId }}
                    className="text-sm font-medium hover:underline"
                  >
                    {row.asset.symbol}
                  </Link>
                  <p className="text-xs text-muted-foreground">{row.asset.name}</p>
                </TableCell>

                <TableCell className="text-sm">
                  {row.asset.issuer.issuerName}
                </TableCell>

                <TableCell>
                  <CustodyBadge model={row.asset.backing.custodyModel} />
                </TableCell>

                <TableCell>
                  <TierBadge tier={row.asset.trust.verifiedTier} />
                </TableCell>

                <TableCell>
                  <AttestationBadge lastAttestation={row.asset.backing.lastAttestation} />
                </TableCell>

                <TableCell>
                  <EnabledBadge enabled={row.asset.enabled} />
                </TableCell>

                <TableCell className="pr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false} render={<Link to="/assets/$assetId" params={{ assetId: row.asset.assetId }} />}
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
                No assets found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
