"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { getSession } from "@/lib/auth"

/**
 * Session gate for the wallet shell. Reads the stored session on mount;
 * with none, leaves for sign-in rather than rendering a dead shell of
 * error cards. A stored token is re-validated by the API on every
 * request — a revoked token drops the shell through the 401 path.
 */
export function ShellGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!getSession()) router.replace("/signin")
    else setReady(true)
  }, [router])

  if (!ready) {
    return <p className="px-4 py-6 text-sm text-muted">Checking session…</p>
  }
  return <>{children}</>
}
