"use client"

import { useApiQuery } from "@/lib/use-api-query"
import { logout } from "@/lib/api"

export default function AccountPage() {
  const me = useApiQuery("GET /api/v1/auth/me")

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Account</h1>
      {me.isLoading ? (
        <p className="text-sm text-muted">Loading account…</p>
      ) : me.isError || !me.data ? (
        <p role="alert" className="text-sm text-negative">
          {me.error?.message ?? "Could not load your account."}
        </p>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium">{me.data.email}</p>
          <p className="mt-1 text-xs text-muted">Role: {me.data.role}</p>
        </div>
      )}
      <button
        onClick={() => logout()}
        className="w-full rounded-md border border-border px-4 py-2 text-sm"
      >
        Sign out
      </button>
    </div>
  )
}
