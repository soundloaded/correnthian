"use client"

import * as React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@correnthian/ui/components/table"
import type { Contract } from "@correnthian/api-client"
import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
import { getSession } from "@/lib/auth"
import { Button } from "@correnthian/ui/components/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@correnthian/ui/components/alert-dialog"

import { EnabledBadge, NetworkBadge } from "./chain-badges"
import { rankAtLeast } from "@/lib/roles"

export type ChainRow = Contract<"GET /api/v1/chains">[number]

// Same arrangement as the users table: identity first, network and state
// badges, usage counts muted. No RPC column — the API never returns an RPC
// URL, and there never will be one (§6). Enable/disable is inline and
// admin-gated; disabling confirms first and says what survives.
export function ChainsTable({
  rows,
  onChanged,
}: {
  rows: ChainRow[]
  onChanged: () => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Chain</TableHead>
            <TableHead>Family</TableHead>
            <TableHead>Network</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <ChainTableRow key={row.id} row={row} onChanged={onChanged} />
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No chains found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function ChainTableRow({
  row,
  onChanged,
}: {
  row: ChainRow
  onChanged: () => void
}) {
  const sessionRole = getSession()?.role ?? "user"
  const canManage = rankAtLeast(sessionRole, "admin")
  const [confirmDisable, setConfirmDisable] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const setEnabled = async (enabled: boolean) => {
    setSaving(true)
    setError(null)
    const result = await api.request("PATCH /api/v1/chains/:id/enabled", {
      params: { id: row.id },
      body: { enabled },
    })
    setSaving(false)
    setConfirmDisable(false)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  return (
    <>
      <TableRow className={!row.enabled ? "opacity-60" : ""}>
        <TableCell className="pl-4">
          <p className="text-sm font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.nativeSymbol} · {row.id}
          </p>
        </TableCell>

        <TableCell className="text-sm">{row.family}</TableCell>

        <TableCell>
          <NetworkBadge isTestnet={row.isTestnet} />
        </TableCell>

        <TableCell>
          <EnabledBadge enabled={row.enabled} />
        </TableCell>

        <TableCell className="text-sm tabular-nums text-muted-foreground">
          {row._count.assets} assets · {row._count.wallets} wallets
        </TableCell>

        <TableCell className="pr-4">
          {canManage ? (
            row.enabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDisable(true)}
                disabled={saving}
              >
                Disable
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setEnabled(true)}
                disabled={saving}
              >
                {saving ? "Saving…" : "Enable"}
              </Button>
            )
          ) : (
            <span className="text-xs text-muted-foreground">admin only</span>
          )}
        </TableCell>
      </TableRow>
      {error && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="py-0 pl-4 pb-3">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          </TableCell>
        </TableRow>
      )}
      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable {row.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              New activity on this chain stops being served. Wallets,
              balances, and history survive untouched on-chain — disabling
              blocks service, it does not move funds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => setEnabled(false)}
              disabled={saving}
            >
              {saving ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
