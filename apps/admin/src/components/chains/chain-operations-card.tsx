"use client"

import * as React from "react"
import { PowerIcon } from "lucide-react"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
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

import type { ApiResult } from "@correnthian/api-client"

import { api } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { rankAtLeast } from "@/lib/roles"

import type { ChainDetail } from "./chain-details-header"

/**
 * Enabling and disabling a chain.
 *
 * The same act the list page offers, on the page where an operator reads what
 * the chain holds before deciding. Disabling asks first, and says what it
 * does: service stops, on-chain state does not move. The confirmation is not
 * ceremony — a disabled chain refuses new activity, and the operator should
 * know that is what they are about to do.
 */
export function ChainOperationsCard({
  chain,
  onChanged,
}: {
  chain: ChainDetail
  onChanged: () => void
}) {
  const role = getSession()?.role ?? "user"
  const canManage = rankAtLeast(role, "admin")
  const [confirmDisable, setConfirmDisable] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const setEnabled = async (enabled: boolean) => {
    setSaving(true)
    setError(null)
    const result = await api.request("PATCH /api/v1/chains/:id/enabled", {
      params: { id: chain.id },
      body: { enabled },
    })
    setSaving(false)
    setConfirmDisable(false)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <PowerIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Service</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {chain.enabled
            ? "This chain is enabled. New activity on it is served."
            : "This chain is disabled. New activity on it is refused; nothing on-chain moves."}
        </p>

        {canManage ? (
          chain.enabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDisable(true)}
              disabled={saving}
            >
              Disable chain
            </Button>
          ) : (
            <Button size="sm" onClick={() => setEnabled(true)} disabled={saving}>
              {saving ? "Saving…" : "Enable chain"}
            </Button>
          )
        ) : (
          <p className="text-xs text-muted-foreground">
            Changing a chain's service needs the admin role. Your session is{" "}
            {role}.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable {chain.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              New activity on this chain stops being served. Wallets, balances,
              and history survive untouched on-chain — disabling blocks service,
              it does not move funds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => setEnabled(false)}
              disabled={saving}
            >
              {saving ? "Disabling…" : "Disable chain"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function toMessage(result: Exclude<ApiResult<unknown>, { status: "ok" }>): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
