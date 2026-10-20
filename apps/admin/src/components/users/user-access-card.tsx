"use client"

import * as React from "react"

import { ShieldCheckIcon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
import { getSession } from "@/lib/auth"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"
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

import type { UserDetail } from "./user-details-header"
import { rankAtLeast } from "@/lib/roles"

const ROLE_OPTIONS = ["user", "support", "compliance", "admin", "owner"] as const

const STATUS_OPTIONS = ["active", "suspended", "closed"] as const

// Both mutations need the admin role server-side. The UI hides the controls
// for anyone below it, but that gate is display-only — RolesGuard decides.
// A non-admin reading the session cookie sees a read-only page, never a
// button that will only bounce. Errors render inline, never as a toast: a
// permission change that silently disappears is indistinguishable from one
// that never happened.
export function UserAccessCard({
  user,
  onChanged,
}: {
  user: UserDetail
  onChanged: () => void
}) {
  const sessionRole = getSession()?.role ?? "user"
  const canManage = rankAtLeast(sessionRole, "admin")

  const [role, setRole] = React.useState(user.role)
  const [status, setStatus] = React.useState(user.status)
  const [pendingStatus, setPendingStatus] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState<"role" | "status" | null>(null)

  // The detail refetch after a mutation returns fresh values; the selects
  // follow them. Without this they would sit on the stale pre-save choice.
  React.useEffect(() => {
    setRole(user.role)
    setStatus(user.status)
  }, [user.role, user.status])

  if (!canManage) {
    return (
      <Card>
        <AccessCardHeader />
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Role and status changes need the admin role. Your session is{" "}
            {sessionRole}, so this account is read-only for you.
          </p>
        </CardContent>
      </Card>
    )
  }

  const saveRole = async () => {
    setSaving("role")
    setError(null)
    const result = await api.request("PATCH /api/v1/users/:id/role", {
      method: "PATCH",
      params: { id: user.id },
      body: { role },
    })
    setSaving(null)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  // Destructive statuses confirm first, and the dialog says what survives:
  // suspending revokes sessions but leaves wallets and balances untouched
  // on-chain, and closing is permanent in the console's vocabulary.
  const confirmStatus = async () => {
    if (!pendingStatus) return
    setSaving("status")
    setError(null)
    const result = await api.request("PATCH /api/v1/users/:id/status", {
      method: "PATCH",
      params: { id: user.id },
      body: { status: pendingStatus },
    })
    setSaving(null)
    setPendingStatus(null)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  const requestStatusChange = (value: string) => {
    if (value === "active" || value === user.status) {
      setStatus(value)
      return
    }
    setPendingStatus(value)
  }

  return (
    <Card>
      <AccessCardHeader />
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Role</p>
          <div className="flex items-center gap-2">
            <Select
              value={role}
              onValueChange={(value) => {
                if (value) setRole(value)
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={saveRole}
              disabled={saving !== null || role === user.role}
            >
              {saving === "role" ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <Select
            value={status}
            onValueChange={(value) => {
              if (value) requestStatusChange(value)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <AlertDialog
          open={pendingStatus !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPendingStatus(null)
              setStatus(user.status)
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingStatus === "suspended"
                  ? "Suspend this account?"
                  : "Close this account?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingStatus === "suspended"
                  ? "The account signs out everywhere immediately: all sessions are revoked. Wallets, balances, and history survive untouched — suspension blocks access, it does not move funds."
                  : "The account is closed in the console. Its wallets and on-chain balances are unaffected; nothing on-chain can be closed from here."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={confirmStatus}
                disabled={saving !== null}
              >
                {saving === "status" ? "Saving…" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

function AccessCardHeader() {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Access</p>
      </div>
    </CardHeader>
  )
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
