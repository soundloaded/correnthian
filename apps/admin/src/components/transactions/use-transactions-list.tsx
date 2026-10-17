"use client"

import * as React from "react"

import { useApiQuery } from "@/lib/use-api-query"
import {
  TransactionsToolbar,
  type TransactionsFilters,
} from "./transactions-toolbar"

const PAGE_LIMIT = 25

const EMPTY_FILTERS: TransactionsFilters = {
  state: "all",
  direction: "all",
  chainId: "",
  walletId: "",
  userId: "",
}

// Server-driven filtering with keyset pagination. Filters and the cursor
// travel in the query key, so changing one resets the page stack: a cursor
// minted under other filters points into the wrong slice.
export function useTransactionsList() {
  const [filters, setFilters] = React.useState<TransactionsFilters>(EMPTY_FILTERS)
  const [cursors, setCursors] = React.useState<(string | null)[]>([null])

  const pageIndex = cursors.length - 1
  const cursor = cursors[pageIndex] ?? undefined
  const debounced = useDebouncedValue(filters, 300)

  const query = useApiQuery("GET /api/v1/transactions", undefined, {
    state: debounced.state === "all" ? undefined : debounced.state,
    direction: debounced.direction === "all" ? undefined : debounced.direction,
    chainId: debounced.chainId.trim() === "" ? undefined : debounced.chainId.trim(),
    walletId: debounced.walletId.trim() === "" ? undefined : debounced.walletId.trim(),
    userId: debounced.userId.trim() === "" ? undefined : debounced.userId.trim(),
    limit: PAGE_LIMIT,
    cursor,
  })

  const handleChange = (next: TransactionsFilters) => {
    setFilters(next)
    setCursors([null])
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
      <TransactionsToolbar filters={filters} onChange={handleChange} />
    ),
    hasNext: (query.data?.nextCursor ?? null) !== null,
    hasPrevious: pageIndex > 0,
    pageIndex,
    nextPage,
    previousPage,
  }
}

// The id boxes fire on every keystroke; the query must not. A tiny local
// debounce beats a round-trip per character against the shared rate limit.
function useDebouncedValue(
  value: TransactionsFilters,
  delayMs: number,
): TransactionsFilters {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
