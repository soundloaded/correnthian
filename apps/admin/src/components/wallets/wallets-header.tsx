"use client"

// Count-only header. The list endpoint returns the whole registry for the
// signed-in operator with no stats sibling, so the badge counts the rows —
// and the copy says whose wallets these are, because the endpoints are
// scoped to the session, not to every account in the system.
export function WalletsHeader({ count }: { count: number | null }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Wallets</h1>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {count === null ? "…" : `${count} registered`}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Addresses registered to your operator account. Labelling, guardians,
          and primary move nothing on-chain — they organise what is already
          there.
        </p>
      </div>
    </div>
  )
}
