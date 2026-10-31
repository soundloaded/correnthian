"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { consumeMagicLink } from "@/lib/api"

/**
 * Landing route for the sign-in-link emails (`/auth/magic?token=…`).
 * Consumes the token into a session on load: success walks straight into
 * the wallet, failure explains the link is spent and points back.
 */
function MagicConsume() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<"working" | "failed">("working")

  useEffect(() => {
    const token = searchParams.get("token")
    if (!token) {
      setState("failed")
      return
    }
    let live = true
    consumeMagicLink(token).then((result) => {
      if (!live) return
      if (result.ok) {
        router.replace("/portfolio")
      } else {
        setState("failed")
      }
    })
    return () => {
      live = false
    }
  }, [router, searchParams])

  if (state === "failed") {
    return (
      <>
        <h1 className="mb-1 text-xl font-semibold tracking-tight">That link has expired</h1>
        <p className="mb-6 text-sm text-muted">
          Sign-in links last fifteen minutes and work once. Ask for a fresh
          one and it will land in your inbox.
        </p>
        <Link
          href="/signin"
          className="block w-full rounded-lg bg-gold-accent px-3 py-2 text-center text-sm font-semibold text-black transition hover:brightness-110"
        >
          Back to sign in
        </Link>
      </>
    )
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Signing you in…</h1>
      <p className="mb-6 text-sm text-muted">Checking the link from your email.</p>
      <div aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-gold-accent" />
      </div>
    </>
  )
}

export default function MagicPage() {
  return (
    <Suspense>
      <MagicConsume />
    </Suspense>
  )
}
