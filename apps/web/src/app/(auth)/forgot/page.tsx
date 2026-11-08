"use client"

import Link from "next/link"
import { useState } from "react"

import { requestPasswordReset } from "@/lib/api"
import {
  VaultField,
  VaultNotice,
  VaultPrimaryButton,
} from "@/components/vault-auth"

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
      <h1
        className="mb-1 text-[22px] font-semibold tracking-wide text-gold-soft"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Reset your password
      </h1>
      <p className="mb-6 text-sm leading-relaxed text-muted">
        {sent
          ? "A link is on its way if that address holds an account."
          : "Enter the address you signed up with. A reset link follows."}
      </p>
      {sent ? (
        <VaultNotice>
          <p className="text-sm font-medium text-gold-soft">Check your inbox.</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            The link lasts an hour and can be used once. When it arrives,
            follow it to choose a new password.
          </p>
          <p className="mt-4 text-sm text-muted">
            <Link
              href="/signin"
              className="text-gold-soft underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </VaultNotice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <VaultField
            id="email"
            label="EMAIL"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          {error && (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}
          <VaultPrimaryButton disabled={busy}>
            {busy ? "Sending…" : "Send the reset link"}
          </VaultPrimaryButton>
        </form>
      )}
      {!sent && (
        <p className="mt-6 border-t border-border pt-4 text-center text-sm text-muted">
          Remembered it?{" "}
          <Link
            href="/signin"
            className="text-gold-soft underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      )}
    </>
  )
}
