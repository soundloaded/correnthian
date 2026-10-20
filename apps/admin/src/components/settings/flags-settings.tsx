"use client"

import * as React from "react"
import { FlagIcon, PlusIcon, Trash2Icon } from "lucide-react"

import type { ApiResult, Contract } from "@correnthian/api-client"
import { Badge } from "@correnthian/ui/components/badge"
import { Button } from "@correnthian/ui/components/button"
import { Input } from "@correnthian/ui/components/input"
import { Label } from "@correnthian/ui/components/label"
import { Switch } from "@correnthian/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@correnthian/ui/components/table"
import { Textarea } from "@correnthian/ui/components/textarea"
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
import { api, apiBaseUrl } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { useApiQuery } from "@/lib/use-api-query"
import { rankAtLeast } from "@/lib/roles"

export type FeatureFlag = Contract<"GET /api/v1/settings/flags">[number]

// The flags table behind every settings surface that has a backend. Reads
// are any operator's; writes are admin's and carry a reason the audit
// trail keeps — a silent behavioural flip with no recorded why is the
// entry nobody can act on. Deletion goes through raw fetch because the
// contract registry only describes routes with response bodies and DELETE
// answers 204 with none.
export function FlagsSettings() {
  const sessionRole = getSession()?.role ?? "user"
  const canWrite = rankAtLeast(sessionRole, "admin")
  const flags = useApiQuery("GET /api/v1/settings/flags")

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<FeatureFlag | null>(null)
  const [deleting, setDeleting] = React.useState<FeatureFlag | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Feature flags</h2>
          <p className="text-sm text-muted-foreground">
            Named switches with a rollout percentage. A flip changes behaviour
            for every account at once, which is why writes are admin-only and
            need a reason.
          </p>
        </div>

        {canWrite && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <PlusIcon className="size-4" />
            New flag
          </Button>
        )}
      </div>

      {!canWrite && (
        <p className="text-sm text-muted-foreground">
          Flag changes need the admin role. Your session is {sessionRole}, so
          this table is read-only for you.
        </p>
      )}

      {flags.isPending ? (
        <p className="text-sm text-muted-foreground">Loading flags…</p>
      ) : flags.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load flags</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The table below may be stale or empty —
            this is not an all-clear.
          </p>
          <Button variant="outline" size="sm" onClick={() => flags.refetch()}>
            Retry
          </Button>
        </div>
      ) : flags.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <FlagIcon className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No feature flags</p>
            <p className="text-xs text-muted-foreground">
              {canWrite
                ? "Create the first switch to gate a rollout."
                : "Nobody has created a switch yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Flag</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Rollout</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12 pr-4" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {flags.data.map((flag) => (
                <TableRow key={flag.key}>
                  <TableCell className="pl-4">
                    <p className="font-mono text-sm font-medium">{flag.key}</p>
                    {flag.description && (
                      <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                        {flag.description}
                      </p>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        flag.enabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }
                    >
                      {flag.enabled ? "on" : "off"}
                    </Badge>
                  </TableCell>

                  <TableCell className="tabular-nums">
                    {flag.rollout}%
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(flag.updatedAt)}
                  </TableCell>

                  <TableCell className="pr-4">
                    {canWrite && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(flag)
                            setFormOpen(true)
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(flag)}
                          aria-label={`Delete flag ${flag.key}`}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {formOpen && (
        <FlagFormDialog
          flag={editing}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSaved={() => {
            setFormOpen(false)
            setEditing(null)
            void flags.refetch()
          }}
        />
      )}

      <DeleteFlagDialog
        flag={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null)
          void flags.refetch()
        }}
      />
    </div>
  )
}

// Keys are namespaced (`feature.area`): grepping for `billing.` finds every
// flag in a surface. The reason floor is 8 characters — the same floor the
// guard enforces — so the form refuses early what the API would refuse.
function FlagFormDialog({
  flag,
  onClose,
  onSaved,
}: {
  flag: FeatureFlag | null
  onClose: () => void
  onSaved: () => void
}) {
  const [key, setKey] = React.useState(flag?.key ?? "")
  const [enabled, setEnabled] = React.useState(flag?.enabled ?? false)
  const [rollout, setRollout] = React.useState(String(flag?.rollout ?? 100))
  const [description, setDescription] = React.useState(flag?.description ?? "")
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    setError(null)
    const rolloutNum = Number(rollout)
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(key) || key.length < 2 || key.length > 80) {
      setError("The key is a lowercase dotted name like billing.export.")
      return
    }
    if (!Number.isInteger(rolloutNum) || rolloutNum < 0 || rolloutNum > 100) {
      setError("Rollout is a whole number from 0 to 100.")
      return
    }
    if (reason.trim().length < 8) {
      setError("A reason of at least 8 characters is required — it is recorded against your name.")
      return
    }
    setSaving(true)
    const body = {
      enabled,
      rollout: rolloutNum,
      description: description.trim() === "" ? null : description.trim(),
      reason: reason.trim(),
    }
    const result = flag
      ? await api.request("PATCH /api/v1/settings/flags/:key", {
          method: "PATCH",
          params: { key: flag.key },
          body,
        })
      : await api.request("POST /api/v1/settings/flags", {
          method: "POST",
          body: { key: key.trim(), ...body },
        })
    setSaving(false)
    if (result.status === "ok") onSaved()
    else setError(toMessage(result))
  }

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{flag ? `Edit flag ${flag.key}` : "New feature flag"}</AlertDialogTitle>
          <AlertDialogDescription>
            {flag
              ? "The change writes an audit line with your reason."
              : "The flag starts controlling behaviour as soon as it exists."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {!flag && (
            <div className="space-y-1.5">
              <Label htmlFor="flag-key">Key</Label>
              <Input
                id="flag-key"
                placeholder="billing.export"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="font-mono"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">
                Off means the flag reads absent everywhere.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Flag enabled" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="flag-rollout">Rollout percentage</Label>
            <Input
              id="flag-rollout"
              inputMode="numeric"
              value={rollout}
              onChange={(e) => setRollout(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="flag-description">Description</Label>
            <Textarea
              id="flag-description"
              placeholder="What this switch gates."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="flag-reason">Reason</Label>
            <Textarea
              id="flag-reason"
              placeholder="Why this change is happening."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={save} disabled={saving}>
            {saving ? "Saving…" : flag ? "Save changes" : "Create flag"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Deleting retires the switch; clients must degrade with it absent.
function DeleteFlagDialog({
  flag,
  onClose,
  onDeleted,
}: {
  flag: FeatureFlag | null
  onClose: () => void
  onDeleted: () => void
}) {
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setReason("")
    setError(null)
  }, [flag?.key])

  const remove = async () => {
    if (!flag) return
    setError(null)
    if (reason.trim().length < 8) {
      setError("A reason of at least 8 characters is required — it is recorded against your name.")
      return
    }
    setSaving(true)
    try {
      const session = getSession()
      const response = await fetch(
        `${apiBaseUrl}/api/v1/settings/flags/${encodeURIComponent(flag.key)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
          },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      )
      setSaving(false)
      if (response.status === 204) {
        onDeleted()
        return
      }
      setError(
        response.status === 401
          ? "Your session expired. Sign in again."
          : response.status === 403
            ? "Flag changes need the admin role."
            : `The API refused the delete (${response.status}).`,
      )
    } catch {
      setSaving(false)
      setError("Cannot reach the Correnthian API. It may be starting, or stopped.")
    }
  }

  return (
    <AlertDialog open={flag !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {flag ? `Retire flag ${flag.key}?` : "Retire flag?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Clients must degrade with the flag absent — a deleted key a client
            hard-required turns a config change into an outage. This writes an
            audit line with your reason.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {flag && (
          <div className="space-y-1.5 py-2">
            <Label htmlFor="flag-delete-reason">Reason</Label>
            <Textarea
              id="flag-delete-reason"
              placeholder="Why this switch is being retired."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={remove} disabled={saving || !flag}>
            {saving ? "Retiring…" : "Retire flag"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
