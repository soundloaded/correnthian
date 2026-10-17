"use client"

import * as React from "react"

import { useApiQuery } from "@/lib/use-api-query"
import { QuotesToolbar } from "./quotes-toolbar"

const PAGE_LIMIT = 25

// Server-driven filtering with keyset pagination. Filters and the cursor
// travel in the query key, so changing one resets the page stack: a cursor
// minted under other filters points into the wrong slice.
export function useQuotesList() {
  const [state, setState] = React.useState("all")
  const [railKind, setRailKind] = React.useState("all")
  const [cursors, setCursors] = React.useState<(string | null)[]>([null])

  const pageIndex = cursors.length - 1
  const cursor = cursors[pageIndex] ?? undefined

  const query = useApiQuery("GET /api/v1/swaps/quotes", undefined, {
    state: state === "all" ? undefined : state,
    railKind: railKind === "all" ? undefined : railKind,
    limit: PAGE_LIMIT,
    cursor,
  })

  const resetPages = () => setCursors([null])

  const handleStateChange = (value: string) => {
    setState(value)
    resetPages()
  }

  const handleRailKindChange = (value: string) => {
    setRailKind(value)
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
      <QuotesToolbar
        state={state}
        onStateChange={handleStateChange}
        railKind={railKind}
        onRailKindChange={handleRailKindChange}
      />
    ),
    hasNext: (query.data?.nextCursor ?? null) !== null,
    hasPrevious: pageIndex > 0,
    pageIndex,
    nextPage,
    previousPage,
  }
}
