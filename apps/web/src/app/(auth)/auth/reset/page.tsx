"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

import { confirmPasswordReset } from "@/lib/api"

/**
 * Landing route for the reset-link emails (`/auth/reset?token=…`).
 * Sets the new password, then — per the product call — lands back at
 * sign-in with a notice, so the fresh session opens from one place.
 * A missing or spent token reads the same: ask for a fresh link.
 */
function ResetConsume() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return (
      <>
        <h1 className="mb-1 text-xl font-semibold tracking-tight">That link is not valid</h1>
        <p className="mb-6 text-sm text-muted">
          Reset links carry a token and last an hour. Open the link from your
          email again, or ask for a fresh one.
        </p>
        <Link
          href="/forgot"
          className="block w-full rounded-lg bg-gold-accent px-3 py-2 text-center text-sm font-semibold text-black transition hover:brightness-110"
        >
          Ask for a fresh link
        </Link>
      </>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await confirmPasswordReset(token as string, password)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.replace("/signin?reset=done")
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mb-6 text-sm text-muted">
        Eight characters or more. Your old sessions are closed when this lands.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-gold-accent"
            placeholder="Eight characters or more"
          />
        </div>
        {error && (
          <div role="alert">
            <p className="text-sm text-negative">{error}</p>
            <Link href="/forgot" className="mt-1 block text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
              Ask for a fresh link
            </Link>
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-gold-accent px-3 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Setting…" : "Set my password"}
        </button>
      </form>
    </>
  )
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetConsume />
    </Suspense>
  )
}
