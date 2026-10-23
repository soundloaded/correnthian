"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV = [
  { href: "/", label: "Portfolio" },
  { href: "/buy", label: "Buy" },
  { href: "/activity", label: "Activity" },
  { href: "/account", label: "Account" },
] as const

/**
 * Bottom tab bar for the wallet shell. Portfolio first — the holder's own
 * metal is the home screen, not a market. Gold accent reserved for the
 * active metal-adjacent state, never general brand.
 */
export function WebNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Wallet" className="sticky bottom-0 border-t border-border bg-card">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-2">
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "block rounded-md px-4 py-2 text-sm font-medium text-gold-soft"
                    : "block rounded-md px-4 py-2 text-sm text-muted"
                }
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
