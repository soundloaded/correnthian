"use client"

import * as React from "react"

import { GlobeIcon, RotateCcwIcon, SaveIcon } from "lucide-react"

import type { ApiResult } from "@correnthian/api-client"
import { Badge } from "@correnthian/ui/components/badge"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"
import { Input } from "@correnthian/ui/components/input"
import { Label } from "@correnthian/ui/components/label"
import { Switch } from "@correnthian/ui/components/switch"
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
import { rankAtLeast } from "@/lib/roles"
import { useApiQuery } from "@/lib/use-api-query"

import {
  describeSource,
  parseSettingValue,
  reasonError,
  settingDraft,
  settingInputValue,
  type SystemSetting,
} from "./settings-field"

/**
 * The system settings, as the operator sees them.
 *
 * Every row is a setting the code declares — the list comes from the API, so
 * a setting added in a release appears here without the console being
 * changed, and a setting the console remembers that the code does not
 * declare cannot be written at all.
 *
 * The two cards at the top are the point of the page: the *published
 * configuration* is what web, mobile and marketing read. An operator who
 * changes a setting and cannot see it reach the published payload is looking
 * at a switch that does nothing.
 */
export function PlatformSettings() {
  const role = getSession()?.role ?? "user"
  const canWrite = rankAtLeast(role, "admin")
  const settings = useApiQuery("GET /api/v1/settings/system")
  // The published configuration is refetched with the settings, so the panel
  // above never shows a payload that is out of date with the change the
  // operator just made. It is the loop-closer; a stale loop-closer is worse
  // than none.
  const config = useApiQuery("GET /api/v1/config")

  const [editing, setEditing] = React.useState<{
    setting: SystemSetting
    value: string | number | boolean
  } | null>(null)
  const [resetting, setResetting] = React.useState<SystemSetting | null>(null)

  const categories = React.useMemo(() => {
    const byCategory = new Map<string, SystemSetting[]>()
    for (const setting of settings.data ?? []) {
      const list = byCategory.get(setting.category) ?? []
      list.push(setting)
      byCategory.set(setting.category, list)
    }
    return [...byCategory.entries()]
  }, [settings.data])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Platform settings</h2>
        <p className="text-sm text-muted-foreground">
          The values the platform&rsquo;s behaviour depends on. Each one is
          declared in code with a default; an override replaces that default
          until it is cleared. Changing one writes an audit line with your
          reason.
        </p>
      </div>

      <PublishedConfig config={config} />

      {settings.isPending ? (
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      ) : settings.isError || !settings.data ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load the settings</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. This is not an all-clear.
          </p>
          <Button variant="outline" size="sm" onClick={() => settings.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        categories.map(([category, items]) => (
          <section key={category} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </h3>
            {items.map((setting) => (
              <SettingRow
                key={setting.key}
                setting={setting}
                canWrite={canWrite}
                onEdit={(value) => setEditing({ setting, value })}
                onReset={() => setResetting(setting)}
              />
            ))}
          </section>
        ))
      )}

      {editing && (
        <EditSettingDialog
          setting={editing.setting}
          value={editing.value}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void settings.refetch()
            void config.refetch()
          }}
        />
      )}

      {resetting && (
        <ResetSettingDialog
          setting={resetting}
          onClose={() => setResetting(null)}
          onReset={() => {
            setResetting(null)
            void settings.refetch()
            void config.refetch()
          }}
        />
      )}
    </div>
  )
}

/**
 * One setting: what it is, what it is set to, and where that value came
 * from.
 */
function SettingRow({
  setting,
  canWrite,
  onEdit,
  onReset,
}: {
  setting: SystemSetting
  canWrite: boolean
  onEdit: (value: string | number | boolean) => void
  onReset: () => void
}) {
  const [draft, setDraft] = React.useState(settingInputValue(setting))

  // The API is the authority; when it answers with a different value, the
  // field follows it rather than keeping what was typed.
  React.useEffect(() => {
    setDraft(settingInputValue(setting))
  }, [setting.value, setting.source])

  const isBoolean = setting.type === "boolean"
  const enabled = setting.value === true

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">{setting.label}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {setting.key}
            </p>
            <p className="max-w-2xl text-xs text-muted-foreground">
              {setting.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline">{describeSource(setting)}</Badge>
            {setting.clientVisible && (
              <Badge variant="outline" className="gap-1">
                <GlobeIcon className="size-3" />
                published
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isBoolean ? (
            <div className="flex items-center gap-2">
              <Switch
                checked={enabled}
                disabled={!canWrite}
                onCheckedChange={(next) => onEdit(next)}
                aria-label={`${setting.label} is ${enabled ? "on" : "off"}`}
              />
              <span className="text-sm text-muted-foreground">
                {enabled ? "on" : "off"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                className="w-40"
                inputMode={setting.type === "number" ? "numeric" : "text"}
                value={draft}
                disabled={!canWrite}
                aria-label={setting.label}
                onChange={(e) => setDraft(e.target.value)}
              />
              {canWrite && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const parsed = parseSettingValue(setting, draft)
                    if (!parsed.ok) return
                    onEdit(parsed.value)
                  }}
                >
                  <SaveIcon className="size-4" />
                  Save
                </Button>
              )}
            </div>
          )}

          {canWrite && setting.source === "override" && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={onReset}
            >
              <RotateCcwIcon className="size-4" />
              Reset to default
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * The published configuration — what a client reads.
 *
 * It is the same route the console's own preview reads, so an operator can
 * see the payload rather than trust that a write propagated.
 */
function PublishedConfig({
  config,
}: {
  config: ReturnType<typeof useApiQuery<"GET /api/v1/config">>
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Published to clients</p>
          <p className="text-xs text-muted-foreground">
            What web, mobile and marketing read from{" "}
            <span className="font-mono">GET /api/v1/config</span>. A setting
            that is not published here is not something a client can see.
          </p>
        </div>

        {config.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : config.isError || !config.data ? (
          <p className="text-sm text-muted-foreground">
            The published configuration could not be reached.
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">API version</span>{" "}
              {config.data.version}
            </p>
            <p>
              <span className="text-muted-foreground">Maintenance</span>{" "}
              {config.data.maintenance.active ? "on" : "off"}
              {config.data.maintenance.message
                ? ` — ${config.data.maintenance.message}`
                : ""}
            </p>
            <p>
              <span className="text-muted-foreground">Chains</span>{" "}
              {config.data.chains.length === 0
                ? "none enabled"
                : config.data.chains.map((chain) => chain.name).join(", ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Confirm a change, and say why.
 *
 * The value is confirmed rather than applied on the keystroke: a setting
 * that changes the platform for every account the moment a switch is
 * touched is one keystroke away from an incident, and the reason is what
 * the audit trail needs anyway.
 */
function EditSettingDialog({
  setting,
  value,
  onClose,
  onSaved,
}: {
  setting: SystemSetting
  value: string | number | boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = React.useState(settingDraft(setting, value))
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    setError(null)
    const missingReason = reasonError(reason)
    if (missingReason) {
      setError(missingReason)
      return
    }
    const parsed = parseSettingValue(setting, draft)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setSaving(true)
    const result = await api.request("PATCH /api/v1/settings/system/:key", {
      method: "PATCH",
      params: { key: setting.key },
      body: { value: parsed.value, reason: reason.trim() },
    })
    setSaving(false)
    if (result.status === "ok") {
      onSaved()
      return
    }
    setError(toMessage(result))
  }

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Change {setting.label}</AlertDialogTitle>
          <AlertDialogDescription>
            {setting.description} This writes an audit line with your reason.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {setting.type === "boolean" ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">Value</p>
              <Switch
                checked={value === true}
                aria-label={`${setting.label} value`}
                onCheckedChange={(next) => setDraft(next ? "on" : "off")}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="setting-value">Value</Label>
              <Input
                id="setting-value"
                inputMode={setting.type === "number" ? "numeric" : "text"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              {setting.min !== undefined && setting.max !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Between {setting.min} and {setting.max}. The default is{" "}
                  {String(setting.value)}.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="setting-reason">Reason</Label>
            <Input
              id="setting-reason"
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
            {saving ? "Saving…" : "Save change"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Put the declared default back.
 *
 * Deleting is not "clearing a value" here — it is putting the setting back
 * to the value the code declares, and the audit line says so.
 */
function ResetSettingDialog({
  setting,
  onClose,
  onReset,
}: {
  setting: SystemSetting
  onClose: () => void
  onReset: () => void
}) {
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const reset = async () => {
    setError(null)
    const missingReason = reasonError(reason)
    if (missingReason) {
      setError(missingReason)
      return
    }
    setSaving(true)
    try {
      const session = getSession()
      const response = await fetch(
        `${apiBaseUrl}/api/v1/settings/system/${encodeURIComponent(setting.key)}`,
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
        onReset()
        return
      }
      setError(
        response.status === 401
          ? "Your session expired. Sign in again."
          : response.status === 403
            ? "Setting changes need the admin role."
            : `The API refused the reset (${response.status}).`,
      )
    } catch {
      setSaving(false)
      setError("Cannot reach the Correnthian API. It may be starting, or stopped.")
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset {setting.label}?</AlertDialogTitle>
          <AlertDialogDescription>
            The override is removed and the declared default takes effect again
            — {String(setting.value)} at the moment of writing, and whatever the
            code declares after that. This writes an audit line with your
            reason.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="setting-reset-reason">Reason</Label>
          <Input
            id="setting-reset-reason"
            placeholder="Why this override is being removed."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={reset} disabled={saving}>
            {saving ? "Resetting…" : "Reset to default"}
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
