"use client"

import { FileDiffIcon } from "lucide-react"

import { cn } from "@correnthian/ui/lib/utils"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import type { Contract } from "@correnthian/api-client"

import { OutcomeBadge } from "./audit-badges"

export type AuditDetail = Contract<"GET /api/v1/audit/:id">

// The payload the list withholds. `before`/`after` are two versions of one
// row: the card renders the changed keys only, so an unchanged snapshot
// does not bury the one field that moved. Null before is a create, null
// after is a delete — the card says which.
export function AuditDetailCards({ entry }: { entry: AuditDetail }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileDiffIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Entry</p>
          </div>
          <OutcomeBadge outcome={entry.outcome} />
        </CardHeader>

        <CardContent>
          <dl className="divide-y text-sm">
            <Fact label="Action" value={entry.action} mono={false} strong />
            <Fact label="Actor" value={entry.actorEmail ?? entry.actorId ?? "system"} />
            {entry.actorRole && <Fact label="Actor role" value={entry.actorRole} />}
            <Fact label="Target" value={[entry.targetType, entry.targetId].filter(Boolean).join(" · ") || "—"} mono />
            <Fact label="Reason" value={entry.reason ?? "—"} />
            <Fact label="Request" value={entry.requestId ?? "—"} mono />
            {entry.ipAddress && <Fact label="IP" value={entry.ipAddress} mono />}
            {entry.deviceId && <Fact label="Device" value={entry.deviceId} mono />}
            <Fact label="When" value={formatDateTime(entry.createdAt)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileDiffIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">State change</p>
          </div>
        </CardHeader>

        <CardContent>
          {entry.before === null && entry.after === null ? (
            <p className="text-sm text-muted-foreground">
              No state snapshots — this entry records that something happened,
              not what changed.
            </p>
          ) : (
            <div className="space-y-4">
              {entry.before === null && (
                <p className="text-xs font-medium text-muted-foreground">
                  Created — there is no before-state.
                </p>
              )}
              {entry.after === null && entry.before !== null && (
                <p className="text-xs font-medium text-muted-foreground">
                  Deleted — there is no after-state.
                </p>
              )}
              <ChangeRows before={entry.before} after={entry.after} />
              <MetadataBlock metadata={entry.metadata} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Fact({
  label,
  value,
  mono,
  strong,
}: {
  label: string
  value: string
  mono?: boolean
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 break-words text-right text-sm",
          strong && "font-medium",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  )
}

// Changed keys only: a key present on both sides with an equal value is
// context the operator already has. Values render as compact JSON — the
// trail stores redacted objects, not prose.
function ChangeRows({
  before,
  after,
}: {
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])]
  const changed = keys.filter(
    (k) => JSON.stringify((before ?? {})[k]) !== JSON.stringify((after ?? {})[k]),
  )

  if (changed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Before and after match — nothing moved.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {changed.map((key) => (
        <div key={key} className="rounded-lg border p-2.5 text-xs">
          <p className="font-mono font-medium">{key}</p>
          <div className="mt-1 grid gap-1">
            <p className="break-words font-mono text-muted-foreground">
              <span className="font-sans font-medium">before </span>
              {stringify((before ?? {})[key])}
            </p>
            <p className="break-words font-mono">
              <span className="font-sans font-medium">after </span>
              {stringify((after ?? {})[key])}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function MetadataBlock({ metadata }: { metadata: Record<string, unknown> }) {
  const keys = Object.keys(metadata)
  if (keys.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Metadata</p>
      <pre className="overflow-x-auto rounded-lg bg-muted/40 p-2.5 font-mono text-xs">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </div>
  )
}

function stringify(value: unknown): string {
  if (value === undefined) return "—"
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
