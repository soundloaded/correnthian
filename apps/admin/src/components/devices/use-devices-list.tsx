"use client"

import * as React from "react"

import { useApiQuery } from "@/lib/use-api-query"
import { DevicesToolbar } from "./devices-toolbar"

const PAGE_LIMIT = 25

// Server-driven filtering with keyset pagination, same idiom as the
// notifications queue. Search matches the owning account's email, platform is
// the device platform, and the revoked selector maps onto the endpoint's
// includeRevoked flag: "active" asks for active only, the other two ask for
// everything. The endpoint has no revoked-only filter, so "revoked" narrows
// client-side — the page says the list holds at most PAGE_LIMIT rows, never
// that it is whole, so a boundary row landing on the next page is honest.
export function useDevicesList() {
  const [search, setSearch] = React.useState("")
  const [platform, setPlatform] = React.useState("all")
  const [revoked, setRevoked] = React.useState("included")
  const [cursors, setCursors] = React.useState<(string | null)[]>([null])

  const pageIndex = cursors.length - 1
  const cursor = cursors[pageIndex] ?? undefined
  const debouncedSearch = useDebouncedValue(search, 300)

  const query = useApiQuery("GET /api/v1/devices/all", undefined, {
    search: debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
    platform: platform === "all" ? undefined : platform,
    includeRevoked: revoked === "active" ? false : true,
    limit: PAGE_LIMIT,
    cursor,
  })

  const resetPages = () => setCursors([null])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    resetPages()
  }

  const handlePlatformChange = (value: string) => {
    setPlatform(value)
    resetPages()
  }

  const handleRevokedChange = (value: string) => {
    setRevoked(value)
    resetPages()
  }

  const nextPage = () => {
    const next = query.data?.nextCursor ?? null
    if (next) setCursors((prev) => [...prev, next])
  }

  const previousPage = () => {
    setCursors((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }

  const items = query.data?.items ?? []
  const rows =
    revoked === "revoked" ? items.filter((row) => row.revokedAt !== null) : items

  return {
    rows,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    toolbar: (
      <DevicesToolbar
        search={search}
        onSearchChange={handleSearchChange}
        platform={platform}
        onPlatformChange={handlePlatformChange}
        revoked={revoked}
        onRevokedChange={handleRevokedChange}
      />
    ),
    hasNext: (query.data?.nextCursor ?? null) !== null,
    hasPrevious: pageIndex > 0,
    pageIndex,
    nextPage,
    previousPage,
  }
}

// The search box fires on every keystroke; the query must not. Same local
// debounce as the users list — a round-trip per character against the shared
// rate limit is never worth it.
function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
