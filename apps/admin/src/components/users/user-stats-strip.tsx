"use client"

import { CoinsIcon } from "lucide-react"

import { Card, CardContent } from "@correnthian/ui/components/card"

import type { UserDetail } from "./user-details-header"

// Four headline counters: wallets, active devices, sessions, audit entries.
// The audit total rides on the activity card's own query, so this strip takes
// it as a prop rather than fetching twice. Same KPI-card idiom as the
// dashboard. Devices counts active only: the detail projection holds revoked
// devices back from the array but `_count` still includes them, so `total −
// active` is the revoked remainder this names.
export function UserStatsStrip({
  user,
  auditCount,
}: {
  user: UserDetail
  auditCount: number | null
}) {
  const stats = [
    {
      label: "Wallets",
      value: user._count.wallets,
      hint:
        user.wallets.length === 0
          ? "No wallets yet"
          : user.wallets.every((w) => w.kind === "smart" && !w.deployed)
            ? "None deployed on-chain"
            : `${user.wallets.filter((w) => w.deployed || w.kind !== "smart").length} live on-chain`,
    },
    {
      label: "Devices",
      value: user.devices.length,
      hint: deviceHint(user.devices.length, user._count.devices),
    },
    {
      label: "Sessions",
      value: user._count.sessions,
      hint: user.status === "active" ? "Account active" : `Account ${user.status}`,
    },
    {
      label: "Audit entries",
      value: auditCount,
      hint: auditCount === null ? "…" : "Everything this account did",
    },
  ]

  return (
    <div className="grid grid-cols-12 gap-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className="relative col-span-12 overflow-hidden bg-card/80 backdrop-blur-sm bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px] sm:col-span-6 xl:col-span-3"
        >
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
              <div className="flex size-8 items-center justify-center rounded-lg border border-border p-0.5 shadow">
                <div className="flex size-full items-center justify-center rounded-md bg-primary/10 text-primary">
                  <CoinsIcon className="size-4" />
                </div>
              </div>
            </div>
            <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
              {stat.value === null ? "—" : stat.value}
            </div>
            <div className="mt-1.5 text-xs">
              <span className="text-muted-foreground">{stat.hint}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function deviceHint(active: number, total: number): string {
  const revoked = total - active
  if (active === 0 && revoked === 0) return "No devices registered"
  if (active === 0) return `${revoked} revoked`
  return revoked > 0 ? `${active} active · ${revoked} revoked` : `${active} active`
}
