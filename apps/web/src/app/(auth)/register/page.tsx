"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { register } from "@/lib/api"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await register(email, password)
    setBusy(false)
    if (!result.ok) {
      setError("That address is already in use, or the password is too short.")
      return
    }
    router.replace("/portfolio")
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Open an account</h1>
      <p className="mb-6 text-sm text-muted">
        One login for your profile. Your wallet keys are created on your
        device, and only you can move its assets.
      </p>
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
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password
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
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-gold-accent px-3 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Opening…" : "Open my account"}
        </button>
      </form>
      <p className="mt-6 border-t border-border pt-4 text-center text-sm text-muted">
        Already hold an account?{" "}
        <Link href="/signin" className="text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
