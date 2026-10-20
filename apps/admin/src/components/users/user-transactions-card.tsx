"use client"

import { Link } from "@tanstack/react-router"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ArrowUpDownIcon,
} from "lucide-react"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { useApiQuery } from "@/lib/use-api-query"
import type { Contract } from "@correnthian/api-client"

import { TxStateBadge } from "../transactions/transaction-badges"

type TxRow = Contract<"GET /api/v1/transactions">["items"][number]

const PAGE_LIMIT = 10

// The account's money movement, newest first — the same table idiom as the
// operator's transactions page, scoped to this user. The endpoint takes a
// `userId` filter, so the rows are the account's own, not a client-side
// slice of a global list. Direction shows as an arrow, not a word: out is
// money leaving, in is money arriving.
export function UserTransactionsCard({ userId }: { userId: string }) {
  const { data, isLoading, isError, refetch } = useApiQuery(
    "GET /api/v1/transactions",
    undefined,
    { userId, limit: PAGE_LIMIT },
  )

  const rows: TxRow[] = data?.items ?? []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <p className="text-sm font-semibold">Transactions</p>
        {data && (
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false} render={<Link to="/transactions" />}
            className="h-7 text-xs text-muted-foreground"
          >
            Open full ledger
            <ArrowUpDownIcon className="size-3" />
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading transactions…</p>
        ) : isError ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              The transaction list did not answer. This is not an all-clear.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm font-medium hover:underline"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No transactions for this account yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Direction</th>
                  <th className="pb-2 pr-3 font-medium">Asset</th>
                  <th className="pb-2 pr-3 text-right font-medium">Amount</th>
                  <th className="pb-2 pr-3 font-medium">State</th>
                  <th className="pb-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((tx) => {
                  const Out = tx.direction === "out" ? ArrowUpRightIcon : ArrowDownLeftIcon
                  return (
                    <tr key={tx.id}>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Out className="size-3.5 text-muted-foreground" />
                          <span className="capitalize">{tx.direction}</span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-medium">{tx.asset.symbol}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {tx.amountUsd === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          `$${tx.amountUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <TxStateBadge state={tx.state} />
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
