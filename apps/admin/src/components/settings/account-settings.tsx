"use client"

import { BellRingIcon, ShieldAlertIcon } from "lucide-react"

import { Badge } from "@correnthian/ui/components/badge"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"
import { useApiQuery } from "@/lib/use-api-query"

// Who the operator is, from the one endpoint that answers it. The session
// cookie carries a display payload too, but it is unsigned display state —
// this is the API's answer about the bearer that made the call.
export function ProfileSettings() {
  const { data: me, isPending, isError, refetch } = useApiQuery("GET /api/v1/auth/me")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Profile</h2>
        <p className="text-sm text-muted-foreground">
          The account behind this console session, as the API sees it.
        </p>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      ) : isError || !me ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load your profile</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. This is not an all-clear.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{me.email}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Role</p>
              <div>
                <Badge variant="outline" className="font-medium">
                  {me.role}
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Account id</p>
              <p className="font-mono text-sm text-muted-foreground">{me.id}</p>
            </div>

            <p className="text-xs text-muted-foreground">
              There is no profile-write endpoint: names, avatars, and contact
              details have nowhere to be saved. What the API knows about you
              is what you see here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// This console has one operator-facing notification surface: the queue it
// can enqueue into and read back. There are no per-operator preferences —
// no mute, no filter — because no model backs them (backend gap 3), so a
// preferences form would be toggles that save nowhere.
export function NotificationsSettings() {
  const queue = useApiQuery("GET /api/v1/notifications", undefined, { limit: 5 })
  const stats = useApiQuery("GET /api/v1/notifications/stats")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          The queue this console reads and writes. Preference toggles do not
          exist yet — there is no per-operator preference model to save them
          to.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
              <BellRingIcon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Queue depth</p>
              <p className="text-xs text-muted-foreground">
                {stats.data
                  ? `${stats.data.pending} pending · ${stats.data.sent} sent · ${stats.data.failed} failed`
                  : stats.isPending
                    ? "Loading counters…"
                    : "The counters could not be reached."}
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" render={<a href="/notifications" />}>
            Open the queue
          </Button>
        </CardContent>
      </Card>

      {queue.data && queue.data.items.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              Latest queued
            </p>
            {queue.data.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{item.template}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.state} · {item.user.email}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Operator sessions are bearer tokens, not the browser sessions a
// "sign out everywhere" button would revoke — and no endpoint lists or
// revokes them per operator. What exists is the account's trusted devices,
// which is what this renders.
export function SecuritySettings() {
  const devices = useApiQuery("GET /api/v1/devices/all", undefined, { limit: 100 })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Security</h2>
        <p className="text-sm text-muted-foreground">
          Trusted devices across every account. There is no password-change
          or session-revoke endpoint for operators, so neither is offered.
        </p>
      </div>

      {devices.isPending ? (
        <p className="text-sm text-muted-foreground">Loading devices…</p>
      ) : devices.isError || !devices.data ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load devices</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. This is not an all-clear.
          </p>
          <Button variant="outline" size="sm" onClick={() => devices.refetch()}>
            Retry
          </Button>
        </div>
      ) : devices.data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <ShieldAlertIcon className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No trusted devices</p>
            <p className="text-xs text-muted-foreground">
              No account has a trusted device yet.
            </p>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="divide-y">
            {devices.data.items.map((device) => (
              <div key={device.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{device.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {device.platform} · {device.user.email}
                    {device.revokedAt ? " · revoked" : ""}
                  </p>
                </div>
                {device.revokedAt && (
                  <Badge variant="destructive" className="shrink-0">
                    revoked
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
