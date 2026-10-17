"use client"

import * as React from "react"

import { useApiQuery } from "@/lib/use-api-query"
import { UsersToolbar } from "./users-toolbar"

const PAGE_LIMIT = 25

// Server-driven filtering with keyset pagination. Filters and the cursor
// travel in the query key, so changing one resets the page stack: a cursor
// minted under other filters points into the wrong slice.
export function useUsersList() {
  const [search, setSearch] = React.useState("")
  const [role, setRole] = React.useState("all")
  const [kycStatus, setKycStatus] = React.useState("all")
  const [cursors, setCursors] = React.useState<(string | null)[]>([null])

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
    toolbar: (
      <UsersToolbar
        search={search}
        onSearchChange={handleSearchChange}
        role={role}
        onRoleChange={handleRoleChange}
        kycStatus={kycStatus}
        onKycStatusChange={handleKycStatusChange}
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
