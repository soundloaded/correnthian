"use client"

import { ArrowLeftIcon, ArrowLeftRightIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"
import { Avatar, AvatarFallback } from "@correnthian/ui/components/avatar"
import type { Contract } from "@correnthian/api-client"

import { TxDirectionBadge, TxStateBadge } from "./transaction-badges"

export type TransactionDetail = Contract<"GET /api/v1/transactions/:id">

// Identity only: the actions for this row live in the card below, so the
// right side holds just a back link. Same card arrangement as the user header.
export function TransactionDetailsHeader({ tx }: { tx: TransactionDetail }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14" shape="square">
            <AvatarFallback>
              <ArrowLeftRightIcon className="size-6" />
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-lg font-semibold leading-none">
                {tx.id.slice(0, 12)}…
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <TxStateBadge state={tx.state} />
              <TxDirectionBadge direction={tx.direction} />
            </div>

            <p className="text-sm text-muted-foreground">
              {tx.asset.symbol} · {tx.asset.name} · since{" "}
              {formatDate(tx.createdAt)}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-1.5"
          nativeButton={false} render={<Link to="/transactions" />}
        >
          <ArrowLeftIcon className="size-4" />
          All transactions
        </Button>
      </CardContent>
    </Card>
  )
}

export function TransactionNotFound({ txId }: { txId: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <ArrowLeftRightIcon className="size-10 text-muted-foreground" />

      <h2 className="text-lg font-semibold">Transaction not found</h2>

      <p className="text-sm text-muted-foreground">
        No transaction with id {txId} exists, or you cannot see it.
      </p>

      <Button variant="outline" nativeButton={false} render={<Link to="/transactions" />}>
        <ArrowLeftIcon className="mr-2 size-4" />
        Back to Transactions
      </Button>
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
