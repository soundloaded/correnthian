import { createFileRoute } from "@tanstack/react-router"

import { MemberFormSheet } from "@/components/team/member-form-sheet"
import { TeamEmptyState } from "@/components/team/team-empty-state"
import { TeamHeader } from "@/components/team/team-header"
import { TeamMemberCard } from "@/components/team/team-member-card"
import { TeamStats } from "@/components/team/team-stats"
import { TeamTable } from "@/components/team/team-table"
import { TeamToolbar } from "@/components/team/team-toolbar"
import { useTeam } from "@/components/team/use-team"

export const Route = createFileRoute("/_admin/team")({
  component: TeamPage,
})

function TeamPage() {
  const team = useTeam()

  const rowActions = {
    onEdit: team.openEdit,
    onChangeRole: team.changeRole,
    onSetStatus: team.setStatus,
    onRemove: team.removeMember,
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <TeamHeader memberCount={team.members.length} onInvite={team.openInvite} />

      <TeamStats stats={team.stats} />

      <TeamToolbar
        search={team.search}
        onSearchChange={team.setSearch}
        filters={team.filters}
        onFiltersChange={team.setFilters}
        hasActiveFilters={team.hasActiveFilters}
        onClearFilters={team.clearFilters}
        view={team.view}
        onViewChange={team.setView}
      />

      {team.filteredMembers.length === 0 ? (
        <TeamEmptyState onClear={team.clearFilters} />
      ) : team.view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {team.filteredMembers.map((member) => (
            <TeamMemberCard key={member.id} member={member} {...rowActions} />
          ))}
        </div>
      ) : (
        <TeamTable members={team.filteredMembers} {...rowActions} />
      )}

      <MemberFormSheet
        key={team.form.key}
        open={team.form.open}
        onOpenChange={team.setFormOpen}
        initial={team.form.draft}
        onSave={team.saveMember}
      />
    </div>
  )
}