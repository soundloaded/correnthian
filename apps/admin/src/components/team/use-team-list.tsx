"use client"

import * as React from "react"

import { useApiQuery } from "@/lib/use-api-query"
import { TeamToolbar } from "./team-toolbar"

const PAGE_LIMIT = 25

export type TeamView = "grid" | "list"

// Team is a view over the accounts registry, not a roster of its own: the
// rows come from `GET /api/v1/users` with the same server-driven filters
// the users page honours (search, role, kycStatus — the DTO has no status
// param, so status is display-only and gets no control). Cursors travel in
// the query key, so changing any filter resets the page stack.
export function useTeamList() {
  const [search, setSearch] = React.useState("")
  const [role, setRole] = React.useState("all")
  const [kycStatus, setKycStatus] = React.useState("all")
  const [cursors, setCursors] = React.useState<(string | null)[]>([null])
  const [view, setView] = React.useState<TeamView>("grid")

  const pageIndex = cursors.length - 1
  const cursor = cursors[pageIndex] ?? undefined
  const debouncedSearch = useDebouncedValue(search, 300)

  const query = useApiQuery("GET /api/v1/users", undefined, {
    search: debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
    role: role === "all" ? undefined : role,
    kycStatus: kycStatus === "all" ? undefined : kycStatus,
    limit: PAGE_LIMIT,
    cursor,
  })

  const resetPages = () => setCursors([null])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    resetPages()
  }

  const handleRoleChange = (value: string) => {
    setRole(value)
    resetPages()
  }

  const handleKycStatusChange = (value: string) => {
    setKycStatus(value)
    resetPages()
  }

  const clearFilters = () => {
    setSearch("")
    setRole("all")
    setKycStatus("all")
    resetPages()
  }

  const nextPage = () => {
    const next = query.data?.nextCursor ?? null
    if (next) setCursors((prev) => [...prev, next])
  }

  const previousPage = () => {
    setCursors((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }

  return {
    rows: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    view,
    setView,
    clearFilters,
    toolbar: (
      <TeamToolbar
        search={search}
        onSearchChange={handleSearchChange}
        role={role}
        onRoleChange={handleRoleChange}
        kycStatus={kycStatus}
        onKycStatusChange={handleKycStatusChange}
        hasActiveFilters={
          search.trim() !== "" || role !== "all" || kycStatus !== "all"
        }
        onClearFilters={clearFilters}
        view={view}
        onViewChange={setView}
      />
    ),
    hasNext: (query.data?.nextCursor ?? null) !== null,
    hasPrevious: pageIndex > 0,
    pageIndex,
    nextPage,
    previousPage,
  }
}

// The search box fires on every keystroke; the query must not. A tiny local
// debounce beats a round-trip per character against the shared rate limit.
function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
