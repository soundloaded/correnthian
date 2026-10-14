import { createFileRoute } from "@tanstack/react-router"
import { TwoFactor } from "@/components/auth/two-factor"

export const Route = createFileRoute("/auth/two-factor")({
  component: TwoFactorPage,
})

function TwoFactorPage() {
  return <TwoFactor />
}