"use client"

import { ArrowLeftIcon, WalletIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"
import { Avatar, AvatarFallback } from "@correnthian/ui/components/avatar"
import type { Contract } from "@correnthian/api-client"

import { DeployBadge, KindBadge, PrimaryBadge } from "./wallet-badges"

export type WalletDetail = Contract<"GET /api/v1/wallets/:id">

// Identity only: address + label + chain, kind/deploy/primary badges, back
// link on the right. Same card arrangement as the user header.
export function WalletDetailsHeader({ wallet }: { wallet: WalletDetail }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14" shape="square">
            <AvatarFallback>
              <WalletIcon className="size-6" />
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-lg font-semibold leading-none">
                {wallet.display}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <KindBadge kind={wallet.kind} />
              <DeployBadge kind={wallet.kind} deployed={wallet.deployed} />
              <PrimaryBadge isPrimary={wallet.isPrimary} />
            </div>

            <p className="text-sm text-muted-foreground">
              {wallet.label ?? "no label"} · {wallet.chainId} · since{" "}
              {formatDate(wallet.createdAt)}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-1.5"
          render={<Link to="/wallets" />}
        >
          <ArrowLeftIcon className="size-4" />
          All wallets
        </Button>
      </CardContent>
    </Card>
  )
}

export function WalletNotFound({ walletId }: { walletId: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <WalletIcon className="size-10 text-muted-foreground" />

      <h2 className="text-lg font-semibold">Wallet not found</h2>

      <p className="text-sm text-muted-foreground">
        No wallet with id {walletId} is registered to this account.
      </p>

      <Button variant="outline" render={<Link to="/wallets" />}>
        <ArrowLeftIcon className="mr-2 size-4" />
        Back to Wallets
      </Button>
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
