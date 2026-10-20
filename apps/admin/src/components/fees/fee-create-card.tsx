"use client"

import * as React from "react"

import { PlusIcon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
import { getSession } from "@/lib/auth"
import { rankAtLeast } from "@/lib/roles"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"
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

import {
  EMPTY_FEE_RULE_DRAFT,
  FEE_ASSET_CATEGORY_OPTIONS,
  FEE_BASIS_OPTIONS,
  FEE_KIND_OPTIONS,
  FEE_OPERATION_OPTIONS,
  buildFeeRuleBody,
  describeFeeRule,
  type FeeRuleDraft,
} from "./fee-rule-input"

// A new rule prices every quote it matches from the moment it exists, so a
// create is owner-only and carries a recorded reason — the same two gates
// the change route has. The UI hides the control below owner and says why;
// the API decides for real.
export function FeeCreateCard({ onCreated }: { onCreated: () => void }) {
  const sessionRole = getSession()?.role ?? "user"
  const canWrite = rankAtLeast(sessionRole, "owner")

  const [draft, setDraft] = React.useState<FeeRuleDraft>(EMPTY_FEE_RULE_DRAFT)
  const [reason, setReason] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const set = (patch: Partial<FeeRuleDraft>) => setDraft((prev) => ({ ...prev, ...patch }))

  if (!canWrite) {
    return (
      <Card>
        <CreateCardHeader />
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Creating a rule needs the owner role with a recorded reason. Your
            session is {sessionRole}, so the rate table is read-only for you —
            an owner promotes it.
          </p>
        </CardContent>
      </Card>
    )
  }

  const openConfirm = () => {
    const result = buildFeeRuleBody(draft)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setReason("")
    setConfirming(true)
  }

  const create = async () => {
    const result = buildFeeRuleBody(draft)
    if (!result.ok) {
      setError(result.error)
      setConfirming(false)
      return
    }
    if (reason.trim().length < 8) {
      setError("A reason of at least 8 characters is required — it is recorded against your name.")
      return
    }
    setSaving(true)
    setError(null)
    const response = await api.request("POST /api/v1/fees/rules", {
      body: { ...result.body, reason: reason.trim() },
    })
    setSaving(false)
    setConfirming(false)
    if (response.status === "ok") {
      setOpen(false)
      setDraft(EMPTY_FEE_RULE_DRAFT)
      setReason("")
      onCreated()
      return
    }
    setError(toMessage(response))
  }

  return (
    <Card>
      <CreateCardHeader />
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          A new rule prices every quote it matches from the moment it exists.
          Write the rule here, then say why you are adding it — the reason is
          recorded against your name.
        </p>

        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusIcon className="size-4" />
          New fee rule
        </Button>

        {error && !confirming && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>New fee rule</DialogTitle>
              <DialogDescription>
                Everything except the label, the operation, who is paid, and the
                basis is optional. A rule with no selector applies everywhere,
                so narrow it unless you mean it.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="fee-operation" label="Operation">
                <Select
                  value={draft.operation}
                  onValueChange={(value) => value && set({ operation: value })}
                >
                  <SelectTrigger id="fee-operation" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEE_OPERATION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="fee-kind" label="Who is paid">
                <Select
                  value={draft.kind}
                  onValueChange={(value) => value && set({ kind: value })}
                >
                  <SelectTrigger id="fee-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEE_KIND_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="fee-basis" label="Basis">
                <Select
                  value={draft.basis}
                  onValueChange={(value) => value && set({ basis: value })}
                >
                  <SelectTrigger id="fee-basis" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEE_BASIS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="fee-label" label="Label — what the customer reads">
                <Input
                  id="fee-label"
                  value={draft.label}
                  onChange={(e) => set({ label: e.target.value })}
                  maxLength={80}
                  placeholder="e.g. Gold buy fee"
                />
              </Field>

              {draft.basis === "fixed" ? (
                <Field id="fee-amount" label="Fixed amount (USD)">
                  <Input
                    id="fee-amount"
                    value={draft.fixedUsd}
                    onChange={(e) => set({ fixedUsd: e.target.value })}
                    inputMode="decimal"
                    placeholder="e.g. 1.50"
                  />
                </Field>
              ) : (
                <Field id="fee-rate" label="Rate (basis points)">
                  <Input
                    id="fee-rate"
                    value={draft.rateBps}
                    onChange={(e) => set({ rateBps: e.target.value })}
                    inputMode="numeric"
                    placeholder="e.g. 25"
                  />
                </Field>
              )}

              <Field id="fee-priority" label="Priority — higher wins">
                <Input
                  id="fee-priority"
                  value={draft.priority}
                  onChange={(e) => set({ priority: e.target.value })}
                  inputMode="numeric"
                />
              </Field>

              <Field id="fee-state" label="State">
                <Select
                  value={draft.active ? "true" : "false"}
                  onValueChange={(value) => set({ active: value === "true" })}
                >
                  <SelectTrigger id="fee-state" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field id="fee-asset" label="Asset id (optional)">
                <Input
                  id="fee-asset"
                  value={draft.assetId}
                  onChange={(e) => set({ assetId: e.target.value })}
                  maxLength={200}
                  placeholder="any asset"
                />
              </Field>

              <Field id="fee-category" label="Asset category (optional)">
                <Select
                  value={draft.assetCategory === "" ? "any" : draft.assetCategory}
                  onValueChange={(value) =>
                    set({ assetCategory: value === "any" ? "" : (value ?? "") })
                  }
                >
                  <SelectTrigger id="fee-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any category</SelectItem>
                    {FEE_ASSET_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="fee-provider" label="Provider slug (optional)">
                <Input
                  id="fee-provider"
                  value={draft.providerSlug}
                  onChange={(e) => set({ providerSlug: e.target.value })}
                  maxLength={80}
                  placeholder="any provider"
                />
              </Field>

              <Field id="fee-country" label="Country (optional)">
                <Input
                  id="fee-country"
                  value={draft.country}
                  onChange={(e) => set({ country: e.target.value })}
                  maxLength={2}
                  placeholder="any country"
                />
              </Field>

              <Field id="fee-region" label="Region (optional)">
                <Input
                  id="fee-region"
                  value={draft.region}
                  onChange={(e) => set({ region: e.target.value })}
                  maxLength={20}
                  placeholder="any region"
                />
              </Field>

              <Field id="fee-min" label="Notional from (USD, optional)">
                <Input
                  id="fee-min"
                  value={draft.minNotionalUsd}
                  onChange={(e) => set({ minNotionalUsd: e.target.value })}
                  inputMode="decimal"
                  placeholder="no lower bound"
                />
              </Field>

              <Field id="fee-max" label="Notional to (USD, optional)">
                <Input
                  id="fee-max"
                  value={draft.maxNotionalUsd}
                  onChange={(e) => set({ maxNotionalUsd: e.target.value })}
                  inputMode="decimal"
                  placeholder="no upper bound"
                />
              </Field>

              <Field id="fee-from" label="Effective from (optional)">
                <Input
                  id="fee-from"
                  type="datetime-local"
                  value={draft.effectiveFrom}
                  onChange={(e) => set({ effectiveFrom: e.target.value })}
                />
              </Field>

              <Field id="fee-until" label="Effective until (optional)">
                <Input
                  id="fee-until"
                  type="datetime-local"
                  value={draft.effectiveUntil}
                  onChange={(e) => set({ effectiveUntil: e.target.value })}
                />
              </Field>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={openConfirm}>Create rule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Create this fee rule?</AlertDialogTitle>
              <AlertDialogDescription>
                {describeFeeRule(draft)} It applies to every quote that matches
                it, from the moment it is created.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              placeholder="Reason (min 8 characters)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={create}
                disabled={saving}
              >
                {saving ? "Creating…" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

function CreateCardHeader() {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <div className="flex items-center gap-2">
        <PlusIcon className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Create a fee rule</p>
      </div>
    </CardHeader>
  )
}

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  )
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
