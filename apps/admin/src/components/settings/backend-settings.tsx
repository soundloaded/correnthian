"use client"

import { PlugIcon, ScrollTextIcon } from "lucide-react"

import { cn } from "@correnthian/ui/lib/utils"
import { Badge } from "@correnthian/ui/components/badge"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"
import { useApiQuery } from "@/lib/use-api-query"

// What the rails look like right now. Read-only: the list and health
// endpoints project status and capability, and status writes belong to the
// providers page (Assay's lane owns the PATCH), not to a settings toggle.
export function IntegrationsSettings() {
  const list = useApiQuery("GET /api/v1/providers")
  const health = useApiQuery("GET /api/v1/providers/health")

  const loading = list.isPending || health.isPending
  const failed = list.isError || health.isError

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Provider rails and their health, as the API reports them. Status
          changes live on the providers page; nothing here writes.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading providers…</p>
      ) : failed || !list.data || !health.data ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load providers</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. This is not an all-clear.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void list.refetch()
              void health.refetch()
            }}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {health.data.providers.length} rails checked
            {health.data.providers.every((p) => p.lastCheckedAt)
              ? ""
              : " — some rails were never checked and read destructive, not grey."}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {list.data.map((provider) => (
              <Card key={provider.slug}>
                <CardContent className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <PlugIcon className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{provider.name}</p>
                      <StatusBadge status={provider.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {provider.category} · {provider.capabilities.join(", ") || "no capabilities listed"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {provider.lastCheckedAt
                        ? `Checked ${new Date(provider.lastCheckedAt).toLocaleString()}`
                        : "Never checked"}
                      {" · "}
                      {provider._count.quotes} quotes · {provider._count.redemptions} redemptions
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// A degraded rail is still offered to users: it takes the destructive
// tone, not grey. Same rule the providers page follows.
function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        status === "degraded" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
        status === "disabled" && "text-muted-foreground",
      )}
    >
      {status}
    </Badge>
  )
}

// Recent denials and the reasons behind them. Read-only: the trail is the
// record, and the record is append-only.
export function DataSettings() {
  const audit = useApiQuery("GET /api/v1/audit", undefined, { limit: 50, outcome: "denied" })
  const actorNote =
    "The trail lists actor emails, resolved server-side — a cuid alone is not actionable."

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Data</h2>
        <p className="text-sm text-muted-foreground">
          What the console refuses, and why. {actorNote} There is no
          import, export, retention, or backup endpoint — those panels were
          CRM fiction over record types with no backend models.
        </p>
      </div>

      {audit.isPending ? (
        <p className="text-sm text-muted-foreground">Loading denials…</p>
      ) : audit.isError || !audit.data ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load the trail</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The absence of rows below is not an
            all-clear.
          </p>
          <Button variant="outline" size="sm" onClick={() => audit.refetch()}>
            Retry
          </Button>
        </div>
      ) : audit.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <ScrollTextIcon className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No denials recorded</p>
            <p className="text-xs text-muted-foreground">
              The last 50 trail entries hold no denied action. That is the
              trail's answer, not an absence of data.
            </p>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="divide-y">
            {audit.data.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{entry.action}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.actorEmail ?? entry.actorId ?? "unknown actor"}
                    {entry.reason ? ` — ${entry.reason}` : " — no reason recorded"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
