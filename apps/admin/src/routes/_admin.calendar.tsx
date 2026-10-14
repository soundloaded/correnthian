import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { CalendarPage } from "@/components/calendar/calendar-page"

export const Route = createFileRoute("/_admin/calendar")({
  component: CalendarRoute,
})

function CalendarRoute() {
  // The calendar depends on the visitor's local date and time zone, so it is
  // rendered on the client only (avoids server/client hydration mismatches).
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="flex-1" />

  return <CalendarPage />
}