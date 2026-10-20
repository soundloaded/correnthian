"use client"

import { Link } from "@tanstack/react-router"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@correnthian/ui/components/table"
import { Button } from "@correnthian/ui/components/button"
import { Avatar, AvatarFallback } from "@correnthian/ui/components/avatar"

import { AccountStatusBadge, KycBadge, RoleBadge } from "@/components/users/user-badges"
import { getSession } from "@/lib/auth"
import { TeamMemberActions } from "./team-member-actions"
import { getAvatarColor, getInitials } from "./team-utils"
import type { TeamRow } from "./team-member-card"

interface TeamTableProps {
  members: TeamRow[]
  onChanged: () => void
}

// Same arrangement as the users table: identity first, badges for the
// enumerated states, dates muted. Inactive accounts dim — a suspended
// operator must read as suspended, never as live.
export function TeamTable({ members, onChanged }: TeamTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>KYC</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Wallets</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead className="w-12 pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {members.map((member) => (
            <TableRow
              key={member.id}
              className={member.status !== "active" ? "opacity-60" : ""}
            >
              <TableCell className="pl-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback
                      className={`text-xs font-medium ${getAvatarColor(member.email)}`}
                    >
                      {getInitials(member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/users/$userId"
                        params={{ userId: member.id }}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {member.email}
                      </Link>
                      <YouBadge memberId={member.id} />
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      since {formatDate(member.createdAt)}
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <RoleBadge role={member.role} />
              </TableCell>

              <TableCell>
                <KycBadge status={member.kycStatus} />
              </TableCell>

              <TableCell>
                <AccountStatusBadge status={member.status} />
              </TableCell>

              <TableCell className="tabular-nums">
                {member._count.wallets}
              </TableCell>

              <TableCell className="text-muted-foreground">
                {formatDate(member.lastLoginAt)}
              </TableCell>

              <TableCell className="pr-4">
                <TeamMemberActions member={member} onChanged={onChanged} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function TeamTableViewAll() {
  return (
    <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/users" />}>
      View
    </Button>
  )
}

function YouBadge({ memberId }: { memberId: string }) {
  const session = getSession()
  if (!session || session.userId !== memberId) return null
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      You
    </span>
  )
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString()
}
