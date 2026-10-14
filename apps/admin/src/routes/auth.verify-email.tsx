import { createFileRoute } from "@tanstack/react-router"
import { VerifyEmail } from "@/components/auth/verify-email"

export const Route = createFileRoute("/auth/verify-email")({
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  return <VerifyEmail />
}