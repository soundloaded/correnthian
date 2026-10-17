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
import { Label } from "@correnthian/ui/components/label"
import { Textarea } from "@correnthian/ui/components/textarea"
import { api } from "@/lib/api"

import type { ReviewRow } from "./reviews-table"

// The only path that writes `rejected` or clears a sanctions hit, so the
// dialog names the action: approve clears a latched hit, reject leaves the
// freeze in place. The backend's real floor lives in `assertReason`
// (min 8); the schema's min-1 only rejects empty, so the dialog enforces
// the 8 here to fail before the round-trip, not after it.
export function DecideDialog({
  review,
  onClose,
  onDecided,
}: {
  review: ReviewRow
  onClose: () => void
  onDecided: () => void
}) {
  const [decision, setDecision] = React.useState<"approve" | "reject">(
    review.sanctionsResult === "hit" ? "reject" : "approve",
  )
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (reason.trim().length < 8) {
      setError("A reason of at least 8 characters is required — it is recorded against your name.")
      return
    }
    setBusy(true)
    setError(null)
    const result = await api.request("POST /api/v1/compliance/reviews/:userId/decide", {
      params: { userId: review.userId },
      body: { decision, reason: reason.trim() },
    })
    setBusy(false)
    if (result.status === "ok") {
      onDecided()
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
          {decision === "approve" ? "Approve" : "Reject"} {review.email}?
        </DialogTitle>
        <DialogDescription>
          {decision === "approve"
            ? "Approval clears a latched sanctions hit and moves the profile to approved. The account can move again."
            : "Rejection is final for this verification and leaves any sanctions freeze in place. The account stays frozen."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label>Decision</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={decision === "approve" ? "default" : "outline"}
              size="sm"
              onClick={() => setDecision("approve")}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant={decision === "reject" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setDecision("reject")}
            >
              Reject
            </Button>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="decide-reason">Reason</Label>
          <Textarea
            id="decide-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What was checked, and why this decision"
            maxLength={2000}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Required. An unexplained decision is not a decision — it is recorded in the audit trail.
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            disabled={busy}
            variant={decision === "reject" ? "destructive" : "default"}
          >
            {busy ? "Recording…" : `Confirm ${decision}`}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export function DecideDialogRoot(props: React.ComponentProps<typeof DecideDialog>) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) props.onClose() }}>
      <DecideDialog {...props} />
    </Dialog>
  )
}
