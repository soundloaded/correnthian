
import { createFileRoute } from "@tanstack/react-router"

import { Register } from "@/components/auth/register"

export const Route = createFileRoute("/auth/register")({
  component: RegisterPage,
})

function RegisterPage() {
  return <Register />
}