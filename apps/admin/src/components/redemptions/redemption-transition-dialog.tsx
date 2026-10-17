"use client"

import * as React from "react"

import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
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

import { RedemptionStateBadge } from "./redemption-badges"
import { ALLOWED_NEXT, edgeNote } from "./redemption-transitions"
import type { RedemptionRow } from "./redemptions-table"

// Compliance-gated in the API; the console hides the trigger below that role,
// but the gate is display-only — RolesGuard decides. The body carries {state}
// only: unlike decide, there is no reason field to collect. Errors render
// inline, never as a toast.
export function RedemptionTransitionDialog({
  row,
  onClose,
  onDone,
}: {
  row: RedemptionRow | null
  onClose: () => void
  onDone: () => void
}) {
  const options = row ? (ALLOWED_NEXT[row.state] ?? []) : []
  const [next, setNext] = React.useState<string>("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setNext(options[0] ?? "")
    setError(null)
  }, [row?.id])

  const confirm = async () => {
    if (!row || !next) return
    setSaving(true)
    setError(null)
    const result = await api.request("PATCH /api/v1/redemptions/:id/transition", {
      params: { id: row.id },
      body: { state: next },
    })
    setSaving(false)
    if (result.status === "ok") {
      onDone()
      onClose()
    } else {
      setError(toMessage(result))
    }
  }

  return (
    <AlertDialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Advance this redemption?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This moves one legal edge of the state machine. The service
            re-checks the edge; a refusal there is the same rule.
          </AlertDialogDescription>
          <div className="space-y-3">
            {row && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{row.id.slice(0, 12)}…</span>
                <RedemptionStateBadge state={row.state} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm">Move to</span>
              <Select value={next} onValueChange={(value) => value && setNext(value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {next && (
              <p className="text-sm text-muted-foreground">{edgeNote(next)}</p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={saving || !next}>
            {saving ? "Saving…" : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
