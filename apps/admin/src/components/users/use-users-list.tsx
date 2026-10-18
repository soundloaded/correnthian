"use client"

import * as React from "react"

import { useApiQuery } from "@/lib/use-api-query"
import { UsersToolbar } from "./users-toolbar"

const PAGE_SIZES = [10, 25, 50] as const

// Server-driven filtering with keyset pagination. Filters and the cursor
// travel in the query key, so changing one resets the page stack: a cursor
// minted under other filters points into the wrong slice. Page size changes
// reset for the same reason. Selection is component state keyed by account
// id — it survives page changes (unlike row indices), and clears on any
// filter change because the selected rows may no longer match.
export function useUsersList() {
  const [search, setSearch] = React.useState("")
  const [role, setRole] = React.useState("all")
  const [kycStatus, setKycStatus] = React.useState("all")
  const [pageSize, setPageSize] = React.useState<number>(25)
  const [cursors, setCursors] = React.useState<(string | null)[]>([null])
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  const pageIndex = cursors.length - 1
  const cursor = cursors[pageIndex] ?? undefined
  const debouncedSearch = useDebouncedValue(search, 300)

  const query = useApiQuery("GET /api/v1/users", undefined, {
    search: debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
    role: role === "all" ? undefined : role,
    kycStatus: kycStatus === "all" ? undefined : kycStatus,
    limit: pageSize,
    cursor,
  })

  const resetPages = React.useCallback(() => {
    setCursors([null])
    setSelectedIds(new Set())
  }, [])

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

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    resetPages()
  }

  const goToPage = (index: number) => {
    setCursors((prev) => {
      if (index < 0 || index >= prev.length) return prev
      return prev.slice(0, index + 1)
    })
  }

  const nextPage = () => {
    const next = query.data?.nextCursor ?? null
    if (next) setCursors((prev) => [...prev, next])
  }

  const previousPage = () => {
    goToPage(pageIndex - 1)
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const rows = query.data?.items ?? []
    setSelectedIds((prev) => {
      const allSelected =
        rows.length > 0 && rows.every((r) => prev.has(r.id))
      if (allSelected) {
        const next = new Set(prev)
        for (const r of rows) next.delete(r.id)
        return next
      }
      return new Set([...prev, ...rows.map((r) => r.id)])
    })
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
        selectedCount={selectedIds.size}
      />
    ),
    hasNext: (query.data?.nextCursor ?? null) !== null,
    hasPrevious: pageIndex > 0,
    pageCount: cursors.length + (query.data?.nextCursor ? 1 : 0),
    pageIndex,
    pageSize,
    pageSizes: PAGE_SIZES,
    nextPage,
    previousPage,
    goToPage,
    onPageSizeChange: handlePageSizeChange,
    selectedIds,
    onToggleRow: toggleRow,
    onToggleAll: toggleAll,
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
