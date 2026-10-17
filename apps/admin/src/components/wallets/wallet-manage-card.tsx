"use client"

import * as React from "react"

import { Settings2Icon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { Input } from "@correnthian/ui/components/input"

import type { WalletDetail } from "./wallet-details-header"

// Label, guardians, and primary. None of these need an operator role on the
// API — they are scoped to the session's own wallets, and the service
// refuses cross-account access — so there is no cosmetic role gate here:
// the endpoints decide. Guardian replacement is smart-wallets-only
// server-side; the form says so before it bounces. Errors render inline.
export function WalletManageCard({
  wallet,
  onChanged,
}: {
  wallet: WalletDetail
  onChanged: () => void
}) {
  const [label, setLabel] = React.useState(wallet.label ?? "")
  const [guardian, setGuardian] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState<"label" | "guardians" | "primary" | null>(null)

  // The detail refetch after a mutation returns fresh values; the label box
  // follows them. Without this it sits on the stale pre-save text.
  React.useEffect(() => {
    setLabel(wallet.label ?? "")
  }, [wallet.label])

  const saveLabel = async () => {
    if (label.trim() === "") {
      setError("A label cannot be empty — deregister the wallet instead of blanking it.")
      return
    }
    setSaving("label")
    setError(null)
    const result = await api.request("PATCH /api/v1/wallets/:id/label", {
      params: { id: wallet.id },
      body: { label: label.trim() },
    })
    setSaving(null)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  // Guardians replace as a set: the one box appends to the stored list and
  // sends the whole thing, so the operator sees accumulation rather than a
  // silent overwrite of entries they never typed.
  const appendGuardian = async () => {
    const trimmed = guardian.trim()
    if (trimmed === "") {
      setError("Type a guardian address before appending it.")
      return
    }
    setSaving("guardians")
    setError(null)
    const result = await api.request("PATCH /api/v1/wallets/:id/guardians", {
      params: { id: wallet.id },
      body: { guardians: [...wallet.guardians, trimmed] },
    })
    setSaving(null)
    if (result.status === "ok") {
      setGuardian("")
      onChanged()
    } else setError(toMessage(result))
  }

  const makePrimary = async () => {
    setSaving("primary")
    setError(null)
    const result = await api.request("PATCH /api/v1/wallets/:id/primary", {
      params: { id: wallet.id },
    })
    setSaving(null)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  return (
    <Card>
      <ManageCardHeader />
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Label</p>
          <div className="flex items-center gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1"
              maxLength={64}
            />
            <Button
              size="sm"
              onClick={saveLabel}
              disabled={saving !== null || label.trim() === (wallet.label ?? "")}
            >
              {saving === "label" ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Guardians — {wallet.guardians.length} registered
            {wallet.kind !== "smart" ? " · smart wallets only" : ""}
          </p>
          {wallet.guardians.length > 0 ? (
            <ul className="space-y-1">
              {wallet.guardians.map((entry) => (
                <li key={entry} className="truncate font-mono text-xs text-muted-foreground">
                  {entry}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No guardians registered.</p>
          )}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Guardian address…"
              value={guardian}
              onChange={(e) => setGuardian(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={appendGuardian}
              disabled={saving !== null}
            >
              {saving === "guardians" ? "Saving…" : "Append"}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Primary</p>
          {wallet.isPrimary ? (
            <p className="text-sm text-muted-foreground">
              This is the primary wallet on this account.
            </p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={makePrimary}
              disabled={saving !== null}
            >
              {saving === "primary" ? "Saving…" : "Make primary"}
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ManageCardHeader() {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <div className="flex items-center gap-2">
        <Settings2Icon className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Manage</p>
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
