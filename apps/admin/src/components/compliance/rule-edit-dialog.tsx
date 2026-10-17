"use client"

import * as React from "react"

import { Button } from "@correnthian/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@correnthian/ui/components/dialog"
import { Input } from "@correnthian/ui/components/input"
import { Label } from "@correnthian/ui/components/label"
import { api } from "@/lib/api"

import type { RuleRow } from "./rules-table"

const TOGGLES = [
  { key: "canBuyCrypto", label: "Buy crypto" },
  { key: "canSellCrypto", label: "Sell crypto" },
  { key: "canUseMetals", label: "Use metals" },
  { key: "canRedeem", label: "Redeem" },
  { key: "kycRequired", label: "KYC required" },
  { key: "active", label: "Rule active" },
] as const

type ToggleKey = (typeof TOGGLES)[number]["key"]

// Admin only, reason required. Identity (country/region) is not patchable
// server-side — the dialog does not offer it, and says why. Disabling a
// rule denies a jurisdiction by default, so the footer says what survives:
// nothing on-chain moves; the location simply stops being servable.
export function RuleEditDialog({
  rule,
  onClose,
  onSaved,
}: {
  rule: RuleRow
  onClose: () => void
  onSaved: () => void
}) {
  const [values, setValues] = React.useState<Record<ToggleKey, boolean>>({
    canBuyCrypto: rule.canBuyCrypto,
    canSellCrypto: rule.canSellCrypto,
    canUseMetals: rule.canUseMetals,
    canRedeem: rule.canRedeem,
    kycRequired: rule.kycRequired,
    active: rule.active,
  })
  const [blocked, setBlocked] = React.useState(rule.blockedProviders.join(", "))
  const [notes, setNotes] = React.useState(rule.notes ?? "")
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const dirty =
    TOGGLES.some(({ key }) => values[key] !== rule[key]) ||
    blocked !== rule.blockedProviders.join(", ") ||
    notes !== (rule.notes ?? "")

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!dirty) {
      setError("Nothing changed — edit a capability, provider, or note first.")
      return
    }
    if (reason.trim().length < 8) {
      setError("A reason of at least 8 characters is required — it is recorded against your name.")
      return
    }
    setBusy(true)
    setError(null)
    const blockedProviders = blocked
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    const result = await api.request("PATCH /api/v1/compliance/rules/:id", {
      params: { id: rule.id },
      body: {
        ...values,
        blockedProviders,
        notes: notes.trim() === "" ? null : notes.trim(),
        reason: reason.trim(),
      },
    })
    setBusy(false)
    if (result.status === "ok") {
      onSaved()
      return
    }
    setError(
      result.status === "unauthorised"
        ? "Your session expired. Sign in again."
        : result.message,
    )
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          Edit rule {rule.country}{rule.region ? ` · ${rule.region}` : ""}
        </DialogTitle>
        <DialogDescription>
          Country and region cannot be changed here — moving coverage is a new
          rule, not an edit. Disabling denies the location by default; nothing
          on-chain moves, the location simply stops being servable.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          {TOGGLES.map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.checked }))}
                className="size-4 accent-current"
              />
              {label}
            </label>
          ))}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rule-blocked">Blocked providers</Label>
          <Input
            id="rule-blocked"
            value={blocked}
            onChange={(e) => setBlocked(e.target.value)}
            placeholder="comma-separated slugs, empty for none"
            maxLength={1000}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rule-notes">Notes</Label>
          <Input
            id="rule-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why this rule reads this way"
            maxLength={2000}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rule-reason">Reason</Label>
          <Input
            id="rule-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this rule is changing"
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground">
            Required. Recorded against your name in the audit trail.
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save rule"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export function RuleEditDialogRoot(props: React.ComponentProps<typeof RuleEditDialog>) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) props.onClose() }}>
      <RuleEditDialog {...props} />
    </Dialog>
  )
}
