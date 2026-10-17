"use client"

import * as React from "react"

import { PenLineIcon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
import { getSession } from "@/lib/auth"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { Input } from "@correnthian/ui/components/input"
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

import type { FeeRuleDetail } from "./fee-details-header"
import { FeePreviewCard } from "./fee-preview-card"

// Changing a rate changes what every subsequent quote costs, so from that
// moment it is load-bearing — which is the sense in which an edit is a
// destructive action even though it destroys nothing that exists. Writes
// are owner-only with a mandatory reason (the guard reads `reason` from the
// body, at least 8 characters). The UI hides the form below owner and asks
// for the reason inside the confirm, after the preview above has shown what
// the change would do.
export function FeeProposeCard({
  rule,
  onChanged,
}: {
  rule: FeeRuleDetail
  onChanged: () => void
}) {
  const sessionRole = getSession()?.role ?? "user"
  const canWrite = rankAtLeast(sessionRole, "owner")

  const [active, setActive] = React.useState(rule.active)
  const [priority, setPriority] = React.useState(String(rule.priority))
  const [rateBps, setRateBps] = React.useState(rule.rateBps == null ? "" : String(rule.rateBps))
  const [fixedUsd, setFixedUsd] = React.useState(rule.fixedUsd ?? "")
  const [reason, setReason] = React.useState("")
  const [confirming, setConfirming] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // The detail refetch after a mutation returns fresh values; the form
  // follows them. Without this it sits on the stale pre-save choices.
  React.useEffect(() => {
    setActive(rule.active)
    setPriority(String(rule.priority))
    setRateBps(rule.rateBps == null ? "" : String(rule.rateBps))
    setFixedUsd(rule.fixedUsd ?? "")
  }, [rule.active, rule.priority, rule.rateBps, rule.fixedUsd])

  if (!canWrite) {
    return (
      <Card>
        <ProposeCardHeader />
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Changing a rule needs the owner role with a recorded reason. Your
            session is {sessionRole}, so this rule is read-only for you — run
            a preview above to see what it prices.
          </p>
        </CardContent>
      </Card>
    )
  }

  const dirty =
    active !== rule.active ||
    priority.trim() !== String(rule.priority) ||
    rateBps.trim() !== (rule.rateBps == null ? "" : String(rule.rateBps)) ||
    fixedUsd.trim() !== (rule.fixedUsd ?? "")

  const openConfirm = () => {
    if (!dirty) {
      setError("Change something first — a patch that changes nothing writes an audit line showing no change.")
      return
    }
    if (rule.basis === "fixed" && fixedUsd.trim() === "") {
      setError("A fixed fee needs an amount.")
      return
    }
    if (rule.basis !== "fixed" && rateBps.trim() === "") {
      setError(`A ${rule.basis} fee needs a rate in basis points.`)
      return
    }
    setError(null)
    setReason("")
    setConfirming(true)
  }

  const save = async () => {
    if (reason.trim().length < 8) {
      setError("A reason of at least 8 characters is required — it is recorded against your name.")
      return
    }
    setSaving(true)
    setError(null)
    const parsedPriority = Number.parseInt(priority.trim(), 10)
    const body: Record<string, unknown> = {
      reason: reason.trim(),
      active,
      ...(Number.isNaN(parsedPriority) ? {} : { priority: parsedPriority }),
    }
    if (rule.basis === "fixed") {
      body.fixedUsd = fixedUsd.trim()
      body.rateBps = null
    } else {
      const parsedRate = Number.parseInt(rateBps.trim(), 10)
      if (!Number.isNaN(parsedRate)) body.rateBps = parsedRate
      body.fixedUsd = null
    }
    const result = await api.request("PATCH /api/v1/fees/rules/:id", {
      params: { id: rule.id },
      body,
    })
    setSaving(false)
    setConfirming(false)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  return (
    <Card>
      <ProposeCardHeader />
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">State</p>
          <Select value={active ? "true" : "false"} onValueChange={(value) => setActive(value === "true")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Priority — higher wins</p>
          <Input
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            inputMode="numeric"
          />
        </div>

        {rule.basis === "fixed" ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Fixed amount (USD)</p>
            <Input
              value={fixedUsd}
              onChange={(e) => setFixedUsd(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 1.50"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Rate (basis points) — {rule.basis}
            </p>
            <Input
              value={rateBps}
              onChange={(e) => setRateBps(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 25"
            />
          </div>
        )}

        <Button size="sm" onClick={openConfirm} disabled={saving}>
          Propose change
        </Button>

        {error && !confirming && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Propose a change to “{rule.label}”?</AlertDialogTitle>
              <AlertDialogDescription>
                A new rate changes what every subsequent quote costs. Run the
                preview above first if you have not — this dialog only asks
                why. The reason is recorded against your name with the change.
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
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving…" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Preview lives inside the propose card so the order is structural:
            see the cost first, then propose. */}
        <FeePreviewCard defaultOperation={rule.operation} />
      </CardContent>
    </Card>
  )
}

function ProposeCardHeader() {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <div className="flex items-center gap-2">
        <PenLineIcon className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Propose change</p>
      </div>
    </CardHeader>
  )
}

const RANK: Record<string, number> = {
  user: 0,
  support: 1,
  compliance: 2,
  admin: 3,
  owner: 4,
}

// Fail-closed mirror of the API rank table.
function rankAtLeast(actual: string, required: string): boolean {
  return (RANK[actual.trim().toLowerCase()] ?? -1) >= (RANK[required] ?? 99)
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
