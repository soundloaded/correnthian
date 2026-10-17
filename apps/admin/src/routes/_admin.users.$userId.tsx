import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { useApiQuery } from "@/lib/use-api-query"
import { UserAccessCard } from "@/components/users/user-access-card"
import { UserActivityCard } from "@/components/users/user-activity-card"
import {
  UserDetailsHeader,
  UserNotFound,
} from "@/components/users/user-details-header"
import { UserInformationCard } from "@/components/users/user-information-card"
import { UserWalletsCard } from "@/components/users/user-wallets-card"

export const Route = createFileRoute("/_admin/users/$userId")({
  component: UserDetailsPage,
})

function UserDetailsPage() {
  const { userId } = Route.useParams()
  const { data: user, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/users/:id",
    { id: userId },
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

      {/* Details Layout */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(220px,0.85fr)_minmax(320px,1.45fr)_minmax(220px,0.85fr)]">
        {/* Left Column */}
        <div className="space-y-4">
          <UserInformationCard user={user} />
          <UserWalletsCard user={user} />
        </div>

        {/* Center Column */}
        <div className="space-y-4">
          <UserActivityCard userId={user.id} />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <UserAccessCard user={user} onChanged={() => refetch()} />
        </div>
      </div>
    </div>
  )
}
