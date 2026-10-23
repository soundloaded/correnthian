"use client"

import { QueryClient } from "@tanstack/react-query"

/**
 * One query client for the wallet shell. Single instance so the cache
 * survives navigation; default options stay conservative — user money data
 * refetches rather than serving a stale balance.
 */
let client: QueryClient | null = null

export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: 1,
        },
      },
    })
  }
  return client
}
