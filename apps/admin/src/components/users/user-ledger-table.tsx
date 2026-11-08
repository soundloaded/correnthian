"use client"

import { Link } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { UserDetail } from "./user-details-header"
import { TxStateBadge } from "../transactions/transaction-badges"
import { useUserLedger, LEDGER_LIMIT } from "./use-user-ledger"

// The ledger, newest first — direction, asset, amount, state, when. Same row
// shape as the operator's transactions table, filtered to this account by
// `userId`. The pre-rebuild card copied this shape with its own query; now
// the chart below reads the same hook, so one request feeds both.
export function UserLedgerTable({ userId }: { userId: string }) {
  const { data, isLoading, isError, refetch } = useUserLedger(userId)
  const rows = data?.items ?? []
  const hasMore = (data?.nextCursor ?? null) !== null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">Transaction ledger</p>
          {data && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {hasMore ? `${rows.length}+` : rows.length}
            </span>
          )}
        </div>
        {rows.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link to="/transactions" search={{ userId }} />
            }
            className="h-7 text-xs text-muted-foreground"
          >
            Open full ledger
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading transactions…
          </p>
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
                {rows.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2.5 pr-3 capitalize">{tx.direction}</td>
                    <td className="py-2.5 pr-3 font-medium">
                      {tx.asset.symbol}
                    </td>
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
                ))}
              </tbody>
            </table>
            {hasMore && (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing the latest {LEDGER_LIMIT} — open the full ledger for
                the rest.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// A thin account is the normal case for a test user, not a failure. The empty
// state says what exists (nothing yet) and what the operator can do next,
// rather than a blank table that reads as a broken fetch.
function EmptyLedger({ user }: { user?: UserDetail }) {
  void user
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">
      No transactions for this account yet.
    </p>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
