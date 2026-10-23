"use client"

import { useApiQuery } from "@/lib/use-api-query"

/**
 * Activity: the holder's own transaction history. Reads `transactions/mine`
 * — scoped to the session server-side, so one holder never sees another's.
 */
export default function ActivityPage() {
  const mine = useApiQuery("GET /api/v1/transactions/mine")

  if (mine.isLoading) return <p className="text-sm text-muted">Loading activity…</p>
  if (mine.isError || !mine.data) {
    return (
      <p role="alert" className="text-sm text-negative">
        {mine.error?.message ?? "Could not load your activity."}
      </p>
    )
  }
  if (mine.data.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Activity</h1>
        <p className="text-sm text-muted">No transactions yet.</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Activity</h1>
      <ul className="space-y-2">
        {mine.data.map((t) => (
          <li key={t.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">{t.direction}</p>
              <p className="text-sm">{t.state}</p>
            </div>
            <p className="mt-1 text-xs text-muted">
              {t.asset.symbol} · {t.wallet.address.slice(0, 10)}…
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
