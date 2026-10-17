"use client"

import * as React from "react"

import { useApiQuery } from "@/lib/use-api-query"
import { AssetsToolbar, type AssetsFilters } from "./assets-toolbar"

// The registry caps at 200 rows per request (§6: request 200 and say so when
// full). The list endpoint returns a bare array, not a keyset page, so there
// is no cursor to carry — filters travel in the query key instead.
const LIST_LIMIT = 200

const EMPTY: AssetsFilters = { category: "all", chainId: "", issuerId: "", enabled: "all" }

export const ASSETS_LIST_LIMIT = LIST_LIMIT

export function useAssetsList() {
  const [filters, setFilters] = React.useState<AssetsFilters>(EMPTY)
  const debouncedChainId = useDebouncedValue(filters.chainId.trim(), 300)
  const debouncedIssuerId = useDebouncedValue(filters.issuerId.trim(), 300)

  const query = useApiQuery("GET /api/v1/assets", undefined, {
    category: filters.category === "all" ? undefined : filters.category,
    chainId: debouncedChainId === "" ? undefined : debouncedChainId,
    issuerId: debouncedIssuerId === "" ? undefined : debouncedIssuerId,
    enabled: filters.enabled === "all" ? undefined : filters.enabled,
    limit: LIST_LIMIT,
  })

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    isFull: (query.data?.length ?? 0) >= LIST_LIMIT,
    toolbar: <AssetsToolbar filters={filters} onChange={setFilters} />,
  }
}

// The id boxes fire on every keystroke; the query must not. Same reason as
// the users search: a round-trip per character against the shared rate limit.
function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
