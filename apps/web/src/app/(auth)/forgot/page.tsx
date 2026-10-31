"use client"

import Link from "next/link"
import { useState } from "react"

import { requestPasswordReset } from "@/lib/api"

export default function ForgotPage() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await requestPasswordReset(email)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    // Always this wording — the API never says whether the address is
    // known, so the page must not either.
    setSent(true)
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mb-6 text-sm text-muted">
        {sent
          ? "A link is on its way if that address holds an account."
          : "Enter the address you signed up with. A reset link follows."}
      </p>
      {sent ? (
        <div role="status" className="rounded-lg border border-border bg-background px-4 py-5 text-center">
          <p className="text-sm font-medium">Check your inbox.</p>
          <p className="mt-1 text-sm text-muted">
            The link lasts an hour and can be used once. When it arrives,
            follow it to choose a new password.
          </p>
          <p className="mt-4 text-sm text-muted">
            <Link href="/signin" className="text-foreground underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-gold-accent"
              placeholder="you@example.com"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gold-accent px-3 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send the reset link"}
          </button>
        </form>
      )}
      {!sent && (
        <p className="mt-6 border-t border-border pt-4 text-center text-sm text-muted">
          Remembered it?{" "}
          <Link href="/signin" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </>
  )
}
