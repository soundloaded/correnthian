"use client"

import * as React from "react"

import { useApiQuery } from "@/lib/use-api-query"
import { RedemptionsToolbar } from "./redemptions-toolbar"

const PAGE_LIMIT = 25

// Server-driven filtering with keyset pagination. The filter and the cursor
// travel in the query key, so changing one resets the page stack: a cursor
// minted under another state points into the wrong slice.
export function useRedemptionsList() {
  const [state, setState] = React.useState("all")
  const [cursors, setCursors] = React.useState<(string | null)[]>([null])

  const pageIndex = cursors.length - 1
  const cursor = cursors[pageIndex] ?? undefined

  const query = useApiQuery("GET /api/v1/redemptions", undefined, {
    state: state === "all" ? undefined : state,
    limit: PAGE_LIMIT,
    cursor,
  })

  const handleStateChange = (value: string) => {
    setState(value)
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
      <RedemptionsToolbar state={state} onStateChange={handleStateChange} />
    ),
    hasNext: (query.data?.nextCursor ?? null) !== null,
    hasPrevious: pageIndex > 0,
    pageIndex,
    nextPage,
    previousPage,
  }
}
