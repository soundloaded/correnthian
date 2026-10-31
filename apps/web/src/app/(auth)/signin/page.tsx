"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

import { login, requestMagicLink } from "@/lib/api"

type Mode = "password" | "magic"

function SigninForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const notice =
    searchParams.get("reset") === "done"
      ? "Your password is set. Sign in with it below."
      : null

  async function onPassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await login(email, password)
    setBusy(false)
    if (!result.ok) {
      // Wrong password or unknown address read the same — the API never
      // says which, so neither do we.
      setError("Those details were not recognised.")
      return
    }
    router.replace("/portfolio")
  }

  async function onMagic(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await requestMagicLink(email)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    // Always this, whether or not the address is known.
    setSent(true)
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 text-sm text-muted">
        {mode === "password"
          ? "Welcome back. Your wallet opens after this."
          : "No password to remember — a link lands in your inbox."}
      </p>

      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      {mode === "password" ? (
        <form onSubmit={onPassword} className="space-y-4">
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
            <div className="mb-1 flex items-baseline justify-between">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <Link href="/forgot" className="text-xs text-muted hover:text-foreground">
                Forgot it?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-gold-accent"
              placeholder="••••••••"
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
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : sent ? (
        <div role="status" className="rounded-lg border border-border bg-background px-4 py-5 text-center">
          <p className="text-sm font-medium">Check your inbox.</p>
          <p className="mt-1 text-sm text-muted">
            If that address holds an account, a sign-in link is on its way. It
            lasts fifteen minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={onMagic} className="space-y-4">
          <div>
            <label htmlFor="magic-email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="magic-email"
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
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      )}

      <div className="mt-6 border-t border-border pt-4 text-center text-sm">
        {mode === "password" ? (
          <button
            type="button"
            onClick={() => {
              setMode("magic")
              setError(null)
            }}
            className="text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Email me a sign-in link instead
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMode("password")
              setError(null)
              setSent(false)
            }}
            className="text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Sign in with my password instead
          </button>
        )}
        <p className="mt-3 text-muted">
          New here?{" "}
          <Link href="/register" className="text-foreground underline-offset-4 hover:underline">
            Open an account
          </Link>
        </p>
      </div>
    </>
  )
}

export default function SigninPage() {
  return (
    <Suspense>
      <SigninForm />
    </Suspense>
  )
}
