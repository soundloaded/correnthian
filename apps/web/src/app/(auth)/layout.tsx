import type { ReactNode } from "react"

/**
 * Auth shell: the brand moment before the wallet. One centred glass panel
 * on obsidian, the wordmark, and the one-sentence custody promise — shared
 * by sign-in, register, and the reset flow so all four pages read as one
 * product. Gold appears once (the wordmark accent); everything else is
 * silver on obsidian.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-xl font-semibold tracking-tight">
          Correnthian<span className="text-gold-accent">.</span>
        </p>
        <p className="mt-2 max-w-xs text-sm text-muted">
          Your gold and crypto, in a wallet only you can move.
        </p>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_rgba(0,0,0,0.45)] sm:p-8">
        {children}
      </div>
      <p className="mt-6 max-w-xs text-center text-xs text-muted">
        Your account holds your profile — your wallet keys never leave your
        device.
      </p>
    </div>
  )
}
