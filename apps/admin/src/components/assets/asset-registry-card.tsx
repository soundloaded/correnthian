"use client"

import * as React from "react"

import { PowerIcon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
import { getSession } from "@/lib/auth"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { Input } from "@correnthian/ui/components/input"
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

import type { AssetDetail } from "./asset-details-header"
import { rankAtLeast } from "@/lib/roles"

// Enable/disable needs admin; attestation needs compliance. The UI hides each
// control below its role, but that gate is display-only — RolesGuard decides.
// Errors render inline, never as a toast. Disabling confirms first and says
// what survives: balances stay untouched on-chain, the asset only stops
// being offered.
export function AssetRegistryCard({
  asset,
  onChanged,
}: {
  asset: AssetDetail
  onChanged: () => void
}) {
  const sessionRole = getSession()?.role ?? "user"
  const canToggle = rankAtLeast(sessionRole, "admin")
  const canAttest = rankAtLeast(sessionRole, "compliance")

  const [confirmDisable, setConfirmDisable] = React.useState(false)
  const [proofUrl, setProofUrl] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState<"toggle" | "attest" | null>(null)

  if (!canToggle && !canAttest) {
    return (
      <Card>
        <RegistryCardHeader />
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Registry changes need the admin or compliance role. Your session
            is {sessionRole}, so this asset is read-only for you.
          </p>
        </CardContent>
      </Card>
    )
  }

  const setEnabled = async (enabled: boolean) => {
    setSaving("toggle")
    setError(null)
    const result = await api.request("PATCH /api/v1/assets/:assetId/enabled", {
      params: { assetId: asset.asset.assetId },
      body: { enabled },
    })
    setSaving(null)
    setConfirmDisable(false)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  const recordAttestation = async () => {
    setSaving("attest")
    setError(null)
    const result = await api.request("PATCH /api/v1/assets/:assetId/attestation", {
      params: { assetId: asset.asset.assetId },
      body: {
        attestedAt: new Date().toISOString(),
        ...(proofUrl.trim() === "" ? {} : { proofUrl: proofUrl.trim() }),
      },
    })
    setSaving(null)
    if (result.status === "ok") {
      setProofUrl("")
      onChanged()
    } else setError(toMessage(result))
  }

  return (
    <Card>
      <RegistryCardHeader />
      <CardContent className="space-y-4">
        {canToggle && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Availability</p>
            {asset.asset.enabled ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDisable(true)}
                disabled={saving !== null}
              >
                {saving === "toggle" ? "Saving…" : "Disable asset"}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setEnabled(true)}
                disabled={saving !== null}
              >
                {saving === "toggle" ? "Saving…" : "Enable asset"}
              </Button>
            )}
          </div>
        )}

        {canAttest && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Record attestation — stamps now
            </p>
            <Input
              placeholder="Proof URL (optional)…"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={recordAttestation}
              disabled={saving !== null}
            >
              {saving === "attest" ? "Saving…" : "Record attestation"}
            </Button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disable {asset.asset.symbol}?</AlertDialogTitle>
              <AlertDialogDescription>
                The asset stops being offered for swaps and on-ramps. Balances
                stay untouched on-chain — disabling blocks new exposure, it
                does not move funds.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => setEnabled(false)}
                disabled={saving !== null}
              >
                {saving === "toggle" ? "Saving…" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

function RegistryCardHeader() {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <div className="flex items-center gap-2">
        <PowerIcon className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Registry</p>
      </div>
    </CardHeader>
  )
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
