import { createFileRoute } from "@tanstack/react-router"
import { PasswordSuccess } from "@/components/auth/password-success"

export const Route = createFileRoute("/auth/password-success")({
  component: PasswordSuccessPage,
})

function PasswordSuccessPage() {
  return <PasswordSuccess />
}