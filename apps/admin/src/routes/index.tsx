import { createFileRoute, redirect } from "@tanstack/react-router"

import { canAccessConsole, clearSession, getSession } from "@/lib/auth"

/**
 * The console has no marketing surface.
 *
 * `/` used to render a fictional SaaS landing page — "Nexora CRM",
 * "$49 lifetime access", invented testimonials — at the root of a metals
 * platform's *operations* console. It advertised a product that does not
 * exist, at a price the repository forbids writing, to nobody who should be
 * reading it: operators go to the dashboard, and everyone else is bounced
 * at the shell. So the root sends each visitor where they belong: a staff
 * session to the dashboard, anyone else to sign-in.
 */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const session = getSession()
    if (session && canAccessConsole(session.role)) {
      throw redirect({ to: "/dashboard" })
    }
    clearSession()
    throw redirect({ to: "/auth/login" })
  },
})
