"use client"

export function DashboardHeader() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Title */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Dashboard
        </h2>

        <p className="text-sm text-muted-foreground">
          Live operations across accounts, quotes, redemptions and settlement.
        </p>
      </div>
    </div>
  )
}