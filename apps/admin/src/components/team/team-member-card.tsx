"use client"

import { Mail } from "lucide-react"

import type { Contract } from "@correnthian/api-client"
import { Badge } from "@correnthian/ui/components/badge"
import { Card } from "@correnthian/ui/components/card"
import { Avatar, AvatarFallback } from "@correnthian/ui/components/avatar"
import { Link } from "@tanstack/react-router"

import { AccountStatusBadge, KycBadge, RoleBadge } from "@/components/users/user-badges"
import { getSession } from "@/lib/auth"
import { TeamMemberActions } from "./team-member-actions"
import { getAvatarColor, getInitials } from "./team-utils"

export type TeamRow = Contract<"GET /api/v1/users">["items"][number]

interface TeamMemberCardProps {
  member: TeamRow
  onChanged: () => void
}

// The team-cards arrangement, kept: identity, badges, account facts, footer.
// What changed is the source — a live account row instead of a Nexora
// salesman — so quota bars, deal counts, edit sheets and remove dialogs are
// gone. The list projection carries no display name; the card titles on the
// email and links to the detail where the name lives.
export function TeamMemberCard({ member, onChanged }: TeamMemberCardProps) {
  const title = member.email
  const isMuted = member.status !== "active"

  return (
    <Card
      className={`gap-0 border-border/70 py-0 shadow-xs transition-all duration-200 hover:border-border hover:shadow-md ${
        isMuted ? "opacity-70" : ""
      }`}
    >
      <div className="space-y-4 p-4">
        {/* Identity */}
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarFallback
              className={`text-sm font-medium ${getAvatarColor(title)}`}
            >
              {getInitials(title)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <Link
              to="/users/$userId"
              params={{ userId: member.id }}
              className="truncate text-sm font-semibold leading-tight hover:underline"
            >
              {title}
            </Link>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {member.role} · since {formatDate(member.createdAt)}
            </p>
          </div>

          <TeamMemberActions member={member} onChanged={onChanged} />
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <RoleBadge role={member.role} />
          <KycBadge status={member.kycStatus} />
          <AccountStatusBadge status={member.status} />
        </div>

        {/* Contact */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{member.email}</span>
          </div>
          <p className="truncate">
            {[member.country, member.region].filter(Boolean).join(" · ") || "No location"}
          </p>
        </div>

        {/* Account facts */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center">
          <div>
            <div className="text-base font-bold leading-tight tabular-nums">{member._count.wallets}</div>
            <div className="text-[11px] text-muted-foreground">Wallets</div>
          </div>
          <div>
            <div className="text-base font-bold leading-tight tabular-nums">{member._count.devices}</div>
            <div className="text-[11px] text-muted-foreground">Devices</div>
          </div>
          <div>
            <div className="text-base font-bold leading-tight">
              {member.lastLoginAt ? formatDate(member.lastLoginAt) : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground">Last login</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="truncate">{member.id}</span>
        <YouBadge memberId={member.id} />
      </div>
    </Card>
  )
}

// The session knows the signed-in account; the row knows its own id. No
// extra request, no prop threading from the page.
function YouBadge({ memberId }: { memberId: string }) {
  const session = getSession()
  if (!session || session.userId !== memberId) return null
  return (
    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
      You
    </Badge>
  )
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString()
}
