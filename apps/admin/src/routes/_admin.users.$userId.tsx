import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import { UserAccessCard } from "@/components/users/user-access-card"
import { UserActivityCard } from "@/components/users/user-activity-card"
import { UserDeviceHistoryCard } from "@/components/users/user-device-history-card"
import { UserDevicesCard } from "@/components/users/user-devices-card"
import {
  UserDetailsHeader,
  UserNotFound,
} from "@/components/users/user-details-header"
import { UserFlowChart } from "@/components/users/user-flow-chart"
import { UserInformationCard } from "@/components/users/user-information-card"
import { UserLedgerTable } from "@/components/users/user-ledger-table"
import { UserRelatedCard } from "@/components/users/user-related-card"
import { UserStatsStrip } from "@/components/users/user-stats-strip"
import { UserTransactionsCard } from "@/components/users/user-transactions-card"
import { UserWalletsCard } from "@/components/users/user-wallets-card"
import { UserWidgetsCard } from "@/components/users/user-widgets-card"

export const Route = createFileRoute("/_admin/users/$userId")({
  component: UserDetailsPage,
})

function UserDetailsPage() {
  const { userId } = Route.useParams()
  const { data: user, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/users/:id",
    { id: userId },
  )
  // The stats strip needs the audit total without a second fetch: the
  // activity card owns that query, so the count lifts here and drops back
  // down as a prop. One request, two renders.
  const audit = useApiQuery(
    "GET /api/v1/audit/actor/:actorId",
    { actorId: userId },
    undefined,
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Loading account…</p>
      </div>
    )
  }

  if (isError || !user) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
          <p className="text-sm font-medium">Could not load this account</p>
          <p className="text-sm text-muted-foreground">
            {isError
              ? "The API did not answer, or this account does not exist."
              : "This account may have been removed or does not exist."}
          </p>
          {isError ? (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          ) : (
            <UserNotFound userId={userId} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Profile Header */}
      <UserDetailsHeader user={user} />

      {/* Headline counters */}
      <UserStatsStrip
        user={user}
        auditCount={audit.data ? audit.data.length : null}
      />

      {/* Details Layout: info left, widgets center, other info right */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(220px,0.85fr)_minmax(320px,1.45fr)_minmax(220px,0.85fr)]">
        {/* Left Column — who this is */}
        <div className="space-y-4">
          <UserInformationCard user={user} />
          <UserDevicesCard user={user} />
        </div>

        {/* Center Column — widgets */}
        <div className="space-y-4">
          <UserWidgetsCard user={user} />
          <UserTransactionsCard userId={user.id} />
        </div>

        {/* Right Column — what the console may do, plus where else to look */}
        <div className="space-y-4">
          <UserAccessCard user={user} onChanged={() => refetch()} />
          <UserWalletsCard user={user} />
          <UserRelatedCard />
        </div>
      </div>

      {/* Below fold: the account's record — ledger, flow, devices, activity */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <UserLedgerTable userId={user.id} />
          <UserFlowChart userId={user.id} />
        </div>
        <div className="space-y-4">
          <UserDeviceHistoryCard user={user} />
          <UserActivityCard userId={user.id} />
        </div>
      </div>
    </div>
  )
}
