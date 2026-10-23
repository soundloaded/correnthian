"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { getQueryClient } from "@/lib/query-client"

/**
 * Client boundary for the shell: the query cache lives below it, so
 * Server Components stay server-side and only interactive islands
 * opt into the client.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
  )
}
