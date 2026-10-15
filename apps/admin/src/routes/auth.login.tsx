
import { createFileRoute, redirect } from "@tanstack/react-router"

import { Login } from "@/components/auth/login"
import { canAccessConsole, getSession } from "@/lib/auth"

export const Route = createFileRoute("/auth/login")({
  /**
   * Signed-in operators never see the form: the router redirects them in
   * the load pipeline, which — unlike an effect inside the component —
   * cannot lose a race with the initial route commit.
   */
  beforeLoad: () => {
    const session = getSession()
    if (session && canAccessConsole(session.role)) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: AuthLoginPage,
})

function AuthLoginPage() {
  return <Login />
}