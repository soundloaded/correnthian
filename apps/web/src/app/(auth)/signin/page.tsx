"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

import { login, requestMagicLink } from "@/lib/api"
import {
  VaultError,
  VaultField,
  VaultNotice,
  VaultPrimaryButton,
  VaultTabs,
} from "@/components/vault-auth"

type Mode = "password" | "magic"

const TABS = [
  { value: "password", label: "Password" },
  { value: "magic", label: "Email link" },
] as const

function EnvelopeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <rect x="1.5" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="m2.5 4.5 5 3.5 5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <rect x="3" y="6.5" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 6.5V5a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function SigninForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
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
      setError("Those details were not recognised. Check both and try again.")
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
      <h1
        className="mb-1 text-[22px] font-semibold tracking-wide text-gold-soft"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {mode === "password" ? "Open your vault" : "Sign in by email"}
      </h1>
      <p className="mb-5 text-sm leading-relaxed text-muted">
        {mode === "password"
          ? "Welcome back. Your wallet opens after this."
          : "No password to remember — a link lands in your inbox."}
      </p>

      <VaultTabs
        options={TABS}
        value={mode}
        onChange={(v) => {
          setMode(v as Mode)
          setError(null)
          setSent(false)
        }}
      />

      {notice && (
        <>
          <VaultNotice>
            <p className="text-sm font-medium text-gold-soft">{notice}</p>
          </VaultNotice>
          <div className="mb-4" />
        </>
      )}

      {mode === "password" ? (
        <form onSubmit={onPassword} className="space-y-4">
          <VaultField
            id="email"
            label="EMAIL"
            icon={<EnvelopeIcon />}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <VaultField
            id="password"
            label="PASSWORD"
            icon={<LockIcon />}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:text-gold-soft"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            }
          />
          <div className="text-right">
            <Link
              href="/forgot"
              className="text-xs text-muted underline-offset-4 transition hover:text-gold-soft hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          {error && <VaultError>{error}</VaultError>}
          <VaultPrimaryButton busy={busy}>
            {busy ? "Opening your vault…" : "Sign in"}
          </VaultPrimaryButton>
        </form>
      ) : sent ? (
        <VaultNotice>
          <p className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-gold-accent/40 bg-gold-accent/10 text-gold-soft">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="m3.5 9.5 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </p>
          <p className="text-sm font-medium text-gold-soft">Check your inbox.</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            If that address holds an account, a sign-in link is on its way. It
            lasts fifteen minutes.
          </p>
        </VaultNotice>
      ) : (
        <form onSubmit={onMagic} className="space-y-4">
          <VaultField
            id="magic-email"
            label="EMAIL"
            icon={<EnvelopeIcon />}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          {error && <VaultError>{error}</VaultError>}
          <VaultPrimaryButton busy={busy}>
            {busy ? "Sending…" : "Email me a sign-in link"}
          </VaultPrimaryButton>
        </form>
      )}

      <div className="mt-6 border-t border-border pt-4 text-center text-sm">
        <p className="text-muted">
          New here?{" "}
          <Link
            href="/register"
            className="font-semibold text-gold-soft underline-offset-4 hover:underline"
          >
            Open an account
          </Link>
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted/80">
          Protected by your device — keys never leave it.
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
