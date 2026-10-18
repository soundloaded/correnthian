"use client"

import { ScanLineIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { UserDetail } from "./user-details-header"

// Devices registered to this account, from the detail projection. Every row
// is the platform, label, and trust state — no key material ever leaves the
// API, so there is nothing here to leak. Revoked rows never reach this card:
// the projection holds them back, so the total below is active devices while
// the stats strip above names the revoked remainder.
export function UserDevicesCard({ user }: { user: UserDetail }) {
  const devices = user.devices

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLineIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Devices</p>
        </div>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {devices.length} total
        </span>
      </CardHeader>

      <CardContent>
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No devices registered to this account.
          </p>
        ) : (
          <div className="divide-y">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {device.label || device.platform}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {device.platform} · trusted{" "}
                    {formatDate(device.trustedAt)}
                  </p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  seen {formatDate(device.lastSeenAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
