"use client"

import type { ReactNode } from "react"

/**
 * Shared vault-dressing for every auth route: warm obsidian ground with a
 * low gold glow, serif wordmark, one hairline-gold card, custody footnote.
 * Mobile-first single column; on wide screens the column stays narrow and
 * the glow carries the empty space. Gold appears in the wordmark and the
 * primary action only — everything else is champagne on obsidian.
 */
export function VaultShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center overflow-hidden bg-background px-5 pb-10 pt-10 sm:pt-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(216,171,46,0.16),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_110%,rgba(122,95,28,0.12),transparent_60%)]"
      />
      {/* Hairline ingot mark — the one quiet emblem above the wordmark. */}
      <div aria-hidden className="relative mb-4 flex items-center gap-2">
        <span className="h-px w-10 bg-gradient-to-r from-transparent to-gold-accent/70" />
        <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
          <path
            d="M6 1h10l5 8H1L6 1Z"
            stroke="#d8ab2e"
            strokeOpacity="0.9"
            strokeWidth="1.2"
            fill="rgba(216,171,46,0.12)"
          />
          <path d="M6 1l3 8M11 1l1.5 8M16 1l-1.5 8" stroke="#d8ab2e" strokeOpacity="0.45" strokeWidth="0.8" />
        </svg>
        <span className="h-px w-10 bg-gradient-to-l from-transparent to-gold-accent/70" />
      </div>
      <header className="relative mb-7 text-center">
        <p
          className="font-display text-[26px] font-semibold tracking-[0.22em] text-gold-soft"
          style={{ fontFamily: "var(--font-display)" }}
        >
          CORRENTHIAN
        </p>
        <p className="mt-1 text-[11px] font-medium tracking-[0.32em] text-muted">
          PRIVATE VAULT
        </p>
      </header>
      <main className="vault-rise relative w-full max-w-sm rounded-2xl border border-border bg-card px-6 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(240,214,124,0.12)] sm:px-8">
        {children}
      </main>
      <p className="relative mt-6 flex max-w-[19rem] items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-muted">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="mt-0.5 shrink-0">
          <rect x="2" y="5" width="8" height="6" rx="1.2" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.1" />
          <path d="M4 5V3.8a2 2 0 0 1 4 0V5" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.1" />
        </svg>
        <span>
          Your account holds your profile — your wallet keys never leave your
          device.
        </span>
      </p>
    </div>
  )
}

/** Small-caps gold label over a dark inset input, gold ring on focus. */
export function VaultField({
  id,
  label,
  icon,
  trailing,
  ...props
}: {
  id: string
  label: string
  icon?: ReactNode
  trailing?: ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[11px] font-semibold tracking-[0.18em] text-muted"
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/70">
            {icon}
          </span>
        )}
        <input
          id={id}
          {...props}
          className={`w-full rounded-xl border border-border bg-[#0b0805] py-3 text-[15px] text-foreground outline-none transition placeholder:text-muted/60 focus:border-gold-accent/70 focus:ring-2 focus:ring-gold-accent/25 ${icon ? "pl-10" : "px-3.5"} ${trailing ? "pr-11" : icon ? "pr-3.5" : ""}`}
        />
        {trailing && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>
        )}
      </div>
    </div>
  )
}

/**
 * The one gold moment on the page: bullion gradient, dark ink text.
 * `busy` swaps the label for a spinner + label so the button keeps its
 * size and the holder sees the request is in flight.
 */
export function VaultPrimaryButton({
  children,
  disabled,
  busy,
}: {
  children: ReactNode
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={disabled || busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(180deg,#f0d67c,#d8ab2e_55%,#a37f22)] px-3 py-3 text-[15px] font-semibold text-[#1d1404] shadow-[0_6px_24px_rgba(216,171,46,0.35),inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:brightness-110 active:brightness-95 disabled:opacity-60 disabled:shadow-none"
    >
      {busy && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="animate-spin">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
          <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  )
}

/** Error line with a small alert mark — never a bare red sentence. */
export function VaultError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-negative/30 bg-negative/10 px-3.5 py-2.5 text-sm leading-snug text-negative"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="mt-0.5 shrink-0">
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 4v3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7" cy="9.8" r="0.8" fill="currentColor" />
      </svg>
      <span>{children}</span>
    </p>
  )
}

/**
 * Segmented mode tabs — password vs magic link. One control, thumb slides
 * by translate, aria-pressed tells assistive tech which side is live.
 */
export function VaultTabs({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div
      role="tablist"
      aria-label="Sign-in method"
      className="relative mb-6 grid grid-cols-2 rounded-xl border border-border bg-[#0b0805] p-1"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-[linear-gradient(180deg,rgba(240,214,124,0.22),rgba(216,171,46,0.12))] ring-1 ring-gold-accent/30 transition-transform duration-200"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={`relative rounded-lg px-3 py-2 text-[13px] font-semibold transition ${active ? "text-gold-soft" : "text-muted hover:text-foreground"}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Status card — inbox-check confirmations and link-failure explanations. */
export function VaultNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-gold-accent/25 bg-[#0b0805] px-4 py-5 text-center"
    >
      {children}
    </div>
  )
}

/** Quiet underline toggle beneath the card divider. */
export function VaultSwitch({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted underline-offset-4 transition hover:text-gold-soft hover:underline"
    >
      {children}
    </button>
  )
}
