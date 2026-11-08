"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

import { confirmPasswordReset } from "@/lib/api"
import {
  VaultField,
  VaultPrimaryButton,
} from "@/components/vault-auth"

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
        <h1
          className="mb-1 text-[22px] font-semibold tracking-wide text-gold-soft"
          style={{ fontFamily: "var(--font-display)" }}
        >
          That link is not valid
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">
          Reset links carry a token and last an hour. Open the link from your
          email again, or ask for a fresh one.
        </p>
        <Link
          href="/forgot"
          className="block w-full rounded-xl bg-[linear-gradient(180deg,#f0d67c,#d8ab2e_55%,#a37f22)] px-3 py-3 text-center text-[15px] font-semibold text-[#1d1404] shadow-[0_6px_24px_rgba(216,171,46,0.35),inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:brightness-110"
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
      <h1
        className="mb-1 text-[22px] font-semibold tracking-wide text-gold-soft"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Choose a new password
      </h1>
      <p className="mb-6 text-sm leading-relaxed text-muted">
        Eight characters or more. Your old sessions are closed when this lands.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <VaultField
          id="password"
          label="NEW PASSWORD"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Eight characters or more"
        />
        {error && (
          <div role="alert">
            <p className="text-sm text-negative">{error}</p>
            <Link
              href="/forgot"
              className="mt-1 block text-sm text-muted underline-offset-4 hover:text-gold-soft hover:underline"
            >
              Ask for a fresh link
            </Link>
          </div>
        )}
        <VaultPrimaryButton disabled={busy}>
          {busy ? "Setting…" : "Set my password"}
        </VaultPrimaryButton>
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
