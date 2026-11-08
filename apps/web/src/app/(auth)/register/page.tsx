"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { register } from "@/lib/api"
import {
  VaultField,
  VaultPrimaryButton,
} from "@/components/vault-auth"

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
      <h1
        className="mb-1 text-[22px] font-semibold tracking-wide text-gold-soft"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Claim your vault
      </h1>
      <p className="mb-6 text-sm leading-relaxed text-muted">
        One login for your profile. Your wallet keys are created on your
        device, and only you can move its assets.
      </p>
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
        <VaultField
          id="password"
          label="PASSWORD"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Eight characters or more"
        />
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <VaultPrimaryButton disabled={busy}>
          {busy ? "Opening…" : "Open my account"}
        </VaultPrimaryButton>
      </form>
      <p className="mt-6 border-t border-border pt-4 text-center text-sm text-muted">
        Already hold an account?{" "}
        <Link
          href="/signin"
          className="text-gold-soft underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  )
}
