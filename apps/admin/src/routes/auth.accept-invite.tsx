import { createFileRoute } from "@tanstack/react-router"
import { AcceptInvite } from "@/components/auth/accept-invite"

export const Route = createFileRoute("/auth/accept-invite")({
  component: AcceptInvitePage,
})

function AcceptInvitePage() {
  return <AcceptInvite />
}