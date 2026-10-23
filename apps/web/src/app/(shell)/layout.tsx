import type { ReactNode } from "react"
import { WebNav } from "@/components/web-nav"
import { Providers } from "@/app/providers"

/**
 * Wallet shell: portfolio, buy, activity, account behind the session
 * gate. The gate reads the stored session; the API re-validates it on
 * every request, and a revoked token drops the shell via sign-out.
 */
export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <main className="flex-1 px-4 py-6">{children}</main>
        <WebNav />
      </div>
    </Providers>
  )
}
