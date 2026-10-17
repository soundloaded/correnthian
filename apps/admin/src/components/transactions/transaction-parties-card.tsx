"use client"

import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { NetworkIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { TransactionDetail } from "./transaction-details-header"

// Every relation the API resolved server-side — the console never joins, so
// "no provider" reads as a fact rather than a lookup the page forgot.
export function TransactionPartiesCard({ tx }: { tx: TransactionDetail }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <NetworkIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Parties</p>
        </div>
      </CardHeader>

      <CardContent className="divide-y">
        <InfoRow label="Account">
          <Link
            to="/users/$userId"
            params={{ userId: tx.user.id }}
            className="text-sm font-medium hover:underline"
          >
            {tx.user.email}
          </Link>
        </InfoRow>

        <InfoRow label="Wallet">
          <span className="break-all font-mono text-sm font-medium">
            {tx.wallet.address}
          </span>
        </InfoRow>

        <InfoRow label="Chain">
          <span className="text-sm font-medium">
            {tx.chain.name}{" "}
            <span className="text-muted-foreground">· {tx.chain.family}</span>
          </span>
        </InfoRow>

        <InfoRow label="Asset">
          <span className="text-sm font-medium">
            {tx.asset.symbol}{" "}
            <span className="text-muted-foreground">· {tx.asset.name}</span>
          </span>
        </InfoRow>

        <InfoRow label="Provider">
          <span className="text-sm font-medium">
            {tx.provider ? (
              tx.provider.name
            ) : (
              <span className="text-muted-foreground">None — no provider</span>
            )}
          </span>
        </InfoRow>
      </CardContent>
    </Card>
  )
}

function InfoRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}
