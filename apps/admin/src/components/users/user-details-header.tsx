"use client"

import { ArrowLeftIcon, UserRoundIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"
import type { Contract } from "@correnthian/api-client"

import { AccountStatusBadge, KycBadge, RoleBadge } from "./user-badges"
import { AccountAvatar } from "./account-avatar"

export type UserDetail = Contract<"GET /api/v1/users/:id">

// Identity only: no contact actions exist for accounts (no email/call/task
// affordances), so the right side holds just a back link. Same card
// arrangement as the contact header, minus buttons that would call nothing.
export function UserDetailsHeader({ user }: { user: UserDetail }) {
  const title = user.displayName || user.email

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <AccountAvatar
            accountId={user.id}
            title={title}
            className="size-14"
          />

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold leading-none">{title}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <RoleBadge role={user.role} />
              <KycBadge status={user.kycStatus} />
              <AccountStatusBadge status={user.status} />
            </div>

            <p className="text-sm text-muted-foreground">
              {user.displayName ? user.email : user.id} · since{" "}
              {formatDate(user.createdAt)}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-1.5"
          nativeButton={false} render={<Link to="/users" />}
        >
          <ArrowLeftIcon className="size-4" />
          All users
        </Button>
      </CardContent>
    </Card>
  )
}

export function UserNotFound({ userId }: { userId: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <UserRoundIcon className="size-10 text-muted-foreground" />

      <h2 className="text-lg font-semibold">Account not found</h2>

      <p className="text-sm text-muted-foreground">
        No account with id {userId} exists, or you cannot see it.
      </p>

      <Button variant="outline" nativeButton={false} render={<Link to="/users" />}>
        <ArrowLeftIcon className="mr-2 size-4" />
        Back to Users
      </Button>
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
