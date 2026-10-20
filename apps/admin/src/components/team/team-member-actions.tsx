"use client"

import * as React from "react"
import {
  ArrowRightLeft,
  MoreHorizontal,
  UserCheck,
  UserX,
} from "lucide-react"

import type { ApiResult } from "@correnthian/api-client"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@correnthian/ui/components/dropdown-menu"
import { api } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { rankAtLeast } from "@/lib/roles"
import type { TeamRow } from "./team-member-card"

const ROLE_OPTIONS = ["user", "support", "compliance", "admin", "owner"] as const

interface TeamMemberActionsProps {
  member: TeamRow
  onChanged: () => void
}

// Row actions call the same admin-gated PATCH endpoints the user detail
// page uses. The menu hides for anyone below admin — the UI gate is
// display-only, RolesGuard decides — and errors render inline in the
// dialog that made them, never as a toast. Destructive statuses confirm
// first and say what survives. There is no remove: accounts are never
// deleted, only suspended or closed.
export function TeamMemberActions({ member, onChanged }: TeamMemberActionsProps) {
  const session = getSession()
  const canManage = rankAtLeast(session?.role ?? "user", "admin")
  const isYou = session?.userId === member.id

  const [role, setRole] = React.useState(member.role)
  const [pendingStatus, setPendingStatus] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState<"role" | "status" | null>(null)

  React.useEffect(() => {
    setRole(member.role)
  }, [member.role])

  if (!canManage) return null

  const saveRole = async () => {
    setSaving("role")
    setError(null)
    const result = await api.request("PATCH /api/v1/users/:id/role", {
      method: "PATCH",
      params: { id: member.id },
      body: { role },
    })
    setSaving(null)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  const confirmStatus = async () => {
    if (!pendingStatus) return
    setSaving("status")
    setError(null)
    const result = await api.request("PATCH /api/v1/users/:id/status", {
      method: "PATCH",
      params: { id: member.id },
      body: { status: pendingStatus },
    })
    setSaving(null)
    setPendingStatus(null)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  const requestStatusChange = (value: string) => {
    if (value === "active" || value === member.status) return
    setPendingStatus(value)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${member.email}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRightLeft /> Change role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={role}
                  onValueChange={(value) => {
                    if (value) {
                      setRole(value)
                      setError(null)
                    }
                  }}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option}>
                      {option}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {role !== member.role && (
              <DropdownMenuItem
                onClick={saveRole}
                disabled={saving !== null}
              >
                {saving === "role" ? "Saving role…" : `Save role: ${role}`}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          {!isYou && (
            <>
              <DropdownMenuSeparator />

              {member.status === "active" ? (
                <>
                  <DropdownMenuItem onClick={() => requestStatusChange("suspended")}>
                    <UserX /> Suspend
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => requestStatusChange("closed")}
                  >
                    <UserX /> Close account
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => setPendingStatus("active")}>
                  <UserCheck /> Reactivate
                </DropdownMenuItem>
              )}
            </>
          )}

          {error && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                <span role="alert" className="font-normal normal-case text-destructive">
                  {error}
                </span>
              </DropdownMenuLabel>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === "suspended"
                ? "Suspend this account?"
                : pendingStatus === "closed"
                  ? "Close this account?"
                  : "Reactivate this account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === "suspended"
                ? "The account signs out everywhere immediately: all sessions are revoked. Wallets, balances, and history survive untouched — suspension blocks access, it does not move funds."
                : pendingStatus === "closed"
                  ? "The account is closed in the console. Its wallets and on-chain balances are unaffected; nothing on-chain can be closed from here."
                  : "The account regains access with its existing role. Nothing else changes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingStatus === "active" ? "default" : "destructive"}
              onClick={confirmStatus}
              disabled={saving !== null}
            >
              {saving === "status" ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
