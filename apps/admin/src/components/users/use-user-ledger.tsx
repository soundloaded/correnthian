"use client"

import { useApiQuery } from "@/lib/use-api-query"
import type { Contract } from "@correnthian/api-client"

export type UserLedgerRow = Contract<"GET /api/v1/transactions">["items"][number]

const LEDGER_LIMIT = 50

// One fetch for the whole below-fold money section: the ledger table and the
// flow chart below it read the same rows. Same queryKey as calling
// useApiQuery twice with identical args, so TanStack fires one request —
// the same sharing the route already does for the audit trail.
export function useUserLedger(userId: string) {
  return useApiQuery("GET /api/v1/transactions", undefined, {
    userId,
    limit: LEDGER_LIMIT,
  })
}

export { LEDGER_LIMIT }
