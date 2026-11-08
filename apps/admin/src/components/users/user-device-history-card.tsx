"use client"

import { ScanLineIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { useApiQuery } from "@/lib/use-api-query"
import type { Contract } from "@correnthian/api-client"

import type { UserDetail } from "./user-details-header"

type DeviceRow = Contract<"GET /api/v1/devices/all">["items"][number]

// The device history, including the revoked rows the detail projection holds
// back. `devices/all` has no userId filter — it searches by the owning
// account's email — so the rows are narrowed client-side to this account's id.
// A contains-search on a test email can match siblings (authverify-… shares a
// prefix), which is why the id check, not the search, decides what renders.
export function UserDeviceHistoryCard({ user }: { user: UserDetail }) {
  const { data, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/devices/all",
    undefined,
    { search: user.email, includeRevoked: "true", limit: 50 },
  )

  const rows = (data?.items ?? []).filter((d) => d.user.id === user.id)
  const revoked = rows.filter((d) => d.revokedAt !== null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLineIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Device history</p>
        </div>
        {data && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {rows.length} total · {revoked.length} revoked
          </span>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading device history…
          </p>
        ) : isError ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Device history is not visible to your role. This is a permission
              boundary, not an empty history.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm font-medium hover:underline"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No devices ever registered to this account.
          </p>
        ) : (
          <div className="divide-y">
            {rows.map((device) => (
              <DeviceHistoryRow key={device.id} device={device} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DeviceHistoryRow({ device }: { device: DeviceRow }) {
  const isRevoked = device.revokedAt !== null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {device.label || device.platform}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {device.platform} · trusted {formatDate(device.trustedAt)}
        </p>
      </div>
      <span
        className={
          isRevoked
            ? "rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
            : "rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
        }
      >
        {isRevoked
          ? `revoked ${formatDate(device.revokedAt as string)}`
          : `active · seen ${formatDate(device.lastSeenAt)}`}
      </span>
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
