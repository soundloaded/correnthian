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

  const token = searchParams.get("token")

  useEffect(() => {
    // No token means the link was opened bare — but state is derived, not
    // effected: the synchronous setState the effect used to hold tripped
    // the cascading-render rule without buying anything.
    if (!token) return
    let live = true
    consumeMagicLink(token).then((result) => {
      if (!live) return
      if (result.ok) {
        router.replace("/")
      } else {
        setState("failed")
      }
    })
    return () => {
      live = false
    }
  }, [router, searchParams, token])

  if (!token || state === "failed") {
    return (
      <>
        <h1
          className="mb-1 text-[22px] font-semibold tracking-wide text-gold-soft"
          style={{ fontFamily: "var(--font-display)" }}
        >
          That link has expired
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">
          Sign-in links last fifteen minutes and work once. Ask for a fresh
          one and it will land in your inbox.
        </p>
        <Link
          href="/signin"
          className="block w-full rounded-xl bg-[linear-gradient(180deg,#f0d67c,#d8ab2e_55%,#a37f22)] px-3 py-3 text-center text-[15px] font-semibold text-[#1d1404] shadow-[0_6px_24px_rgba(216,171,46,0.35),inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:brightness-110"
        >
          Back to sign in
        </Link>
      </>
    )
  }

  return (
    <>
      <h1
        className="mb-1 text-[22px] font-semibold tracking-wide text-gold-soft"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Signing you in…
      </h1>
      <p className="mb-6 text-sm leading-relaxed text-muted">
        Checking the link from your email.
      </p>
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
