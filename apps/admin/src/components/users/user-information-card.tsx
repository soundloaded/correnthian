"use client"

import type { ReactNode } from "react"
import { UserRoundIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import { AccountStatusBadge, KycBadge, RoleBadge } from "./user-badges"
import type { UserDetail } from "./user-details-header"

// Icon + label + value rows, same rhythm as the contact information card.
// Every value comes from the detail projection; absent values read as
// "Not provided" rather than a blank an operator could misread.
export function UserInformationCard({ user }: { user: UserDetail }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <UserRoundIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Account Information</p>
        </div>
      </CardHeader>

      <CardContent className="divide-y">
        <InfoRow label="Email">
          <span className="break-all text-sm font-medium">{user.email}</span>
        </InfoRow>

        <InfoRow label="Display name">
          <span className="text-sm font-medium">
            {user.displayName ?? <EmptyValue />}
          </span>
        </InfoRow>

        <InfoRow label="Role">
          <RoleBadge role={user.role} />
        </InfoRow>

        <InfoRow label="Account status">
          <AccountStatusBadge status={user.status} />
        </InfoRow>

        <InfoRow label="KYC">
          <div className="flex flex-wrap items-center gap-2">
            <KycBadge status={user.kycStatus} />
            {user.kyc?.provider && (
              <span className="text-xs text-muted-foreground">
                via {user.kyc.provider}
                {user.kyc.providerRef ? ` · ${user.kyc.providerRef}` : ""}
              </span>
            )}
          </div>
        </InfoRow>

        <InfoRow label="Jurisdiction">
          <span className="text-sm font-medium">
            {[user.country, user.region].filter(Boolean).join(" / ") || (
              <EmptyValue />
            )}
          </span>
        </InfoRow>

        <InfoRow label="Email verified">
          <span className="text-sm font-medium">
            {user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : "No"}
          </span>
        </InfoRow>

        <InfoRow label="Last login">
          <span className="text-sm font-medium">
            {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
          </span>
        </InfoRow>

        <InfoRow label="Footprint">
          <span className="text-sm text-muted-foreground">
            {user._count.wallets} wallets · {user._count.devices} devices ·{" "}
            {user._count.sessions} sessions
          </span>
        </InfoRow>
      </CardContent>
    </Card>
  )
}

function InfoRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function EmptyValue() {
  return <span className="text-sm text-muted-foreground">Not provided</span>
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
