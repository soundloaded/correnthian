import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { WebNav } from "@/components/web-nav"
import { Providers } from "@/app/providers"
import { ShellGate } from "@/components/shell-gate"

/**
 * Wallet shell: portfolio, buy, activity, account behind the session
 * gate. The gate reads the stored session client-side (the token lives
 * in memory mirrored to localStorage — no server to hold a cookie);
 * the API re-validates it on every request, and a revoked token drops
 * the shell via sign-out. An unauthenticated visitor is sent to
 * sign-in rather than shown a dead shell of error cards.
 */
export default function ShellLayout({ children }: { children: ReactNode }) {
  void redirect
  return (
    <Providers>
      <ShellGate>
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <main className="flex-1 px-4 py-6">{children}</main>
          <WebNav />
        </div>
      </ShellGate>
    </Providers>
  )
}
