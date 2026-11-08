"use client"

import * as React from "react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { UserDetail } from "./user-details-header"

// Widgets, not fields. Each tile answers one question about the account from
// the detail projection alone — no extra request. Thin accounts read as quiet
// rather than empty: a zero with a sentence beats a missing tile an operator
// could read as a failed load.
export function UserWidgetsCard({ user }: { user: UserDetail }) {
  const tiles = useWidgets(user)

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold">Overview</p>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-lg border border-border p-3"
            >
              <p className="text-xs text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums">
                {tile.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {tile.hint}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function useWidgets(user: UserDetail) {
  return React.useMemo(() => {
    const liveWallets = user.wallets.filter(
      (w) => w.deployed || w.kind !== "smart",
    )
    const deployedSmart = user.wallets.filter(
      (w) => w.kind === "smart" && w.deployed,
    )
    const activeDevices = user.devices.length
    const revokedDevices = user._count.devices - activeDevices
    const chainIds = [...new Set(user.wallets.map((w) => w.chainId))]

    const kycHint =
      user.kycStatus === "approved"
        ? (user.kyc?.provider
            ? `Verified via ${user.kyc.provider}`
            : "Verified")
        : user.kycStatus === "pending"
          ? "Review in the compliance queue"
          : user.kycStatus === "rejected" || user.kycStatus === "expired"
            ? "Needs a new review"
            : "Never started"

    return [
      {
        label: "Live wallets",
        value: `${liveWallets.length}`,
        hint:
          user.wallets.length === 0
            ? "No wallets yet"
            : liveWallets.length === user.wallets.length
              ? `All ${user.wallets.length} on-chain`
              : `${user.wallets.length - liveWallets.length} awaiting deploy`,
      },
      {
        label: "Primary wallet",
        value: user.wallets.some((w) => w.isPrimary) ? "Set" : "—",
        hint:
          user.wallets.find((w) => w.isPrimary)?.chainId ??
          (user.wallets.length === 0 ? "No wallets yet" : "None marked primary"),
      },
      {
        label: "Active devices",
        value: `${activeDevices}`,
        hint:
          revokedDevices > 0
            ? `${revokedDevices} revoked`
            : activeDevices > 0
              ? "Trusted and current"
              : "None registered",
      },
      {
        label: "Chains",
        value: `${chainIds.length}`,
        hint:
          chainIds.length === 0
            ? "No wallets yet"
            : chainIds.slice(0, 2).join(", ") +
              (chainIds.length > 2 ? ` +${chainIds.length - 2}` : ""),
      },
      {
        label: "KYC",
        value:
          user.kycStatus === "approved"
            ? "Passed"
            : user.kycStatus === "pending"
              ? "Pending"
              : user.kycStatus === "rejected"
                ? "Rejected"
                : user.kycStatus === "expired"
                  ? "Expired"
                  : "Not started",
        hint: kycHint,
      },
      {
        label: "Deployed smart wallets",
        value: `${deployedSmart.length}`,
        hint:
          deployedSmart.length > 0
            ? "On-chain and usable"
            : user.wallets.some((w) => w.kind === "smart")
              ? "Awaiting deploy"
              : "No smart wallets",
      },
    ]
  }, [user])
}
