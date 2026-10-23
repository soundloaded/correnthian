"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { register } from "@/lib/api"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await register(email.trim(), password)
    setBusy(false)
    if (result.ok) router.push("/")
    else setError("Registration was not accepted.")
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <h1 className="text-lg font-semibold">Create your Correnthian account</h1>
      <p className="mt-1 text-sm text-muted">
        Your account holds your profile — your wallet keys stay on your device.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-gold-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  )
}
