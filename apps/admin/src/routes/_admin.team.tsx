import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { TeamHeader } from "@/components/team/team-header"
import { TeamMemberCard } from "@/components/team/team-member-card"
import { TeamStats } from "@/components/team/team-stats"
import { TeamTable } from "@/components/team/team-table"
import { useTeamList } from "@/components/team/use-team-list"

const PAGE_LIMIT = 25

export const Route = createFileRoute("/_admin/team")({
  component: TeamPage,
})

function TeamPage() {
  const team = useTeamList()
  const navigate = useNavigate()

  return (
    <div className="flex flex-1 flex-col gap-4">
      <TeamHeader
        onNavigate={() => void navigate({ to: "/users" })}
      />

      <TeamStats />

      {team.toolbar}

      {team.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading team…</p>
      ) : team.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load the team</p>
          <p className="text-sm text-muted-foreground">
            The API did not answer. The list below may be stale or empty —
            this is not an all-clear.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => team.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : team.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <div className="space-y-1">
            <p className="text-sm font-medium">No accounts found</p>
            <p className="text-xs text-muted-foreground">
              Try a different search or clear the filters.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={team.clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : team.view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {team.rows.map((member) => (
            <TeamMemberCard
              key={member.id}
              member={member}
              onChanged={() => team.refetch()}
            />
          ))}
        </div>
      ) : (
        <TeamTable members={team.rows} onChanged={() => team.refetch()} />
      )}

      {!team.isLoading && !team.isError && team.rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {team.pageIndex + 1} · showing up to {PAGE_LIMIT} per
            page. The list holds at most {PAGE_LIMIT} rows — when a next
            page exists, more accounts remain.
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={team.previousPage}
              disabled={!team.hasPrevious}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={team.nextPage}
              disabled={!team.hasNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
