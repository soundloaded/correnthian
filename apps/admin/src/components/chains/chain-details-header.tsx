"use client"

import { ArrowLeftIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

import type { Contract } from "@correnthian/api-client"
import { Avatar, AvatarFallback } from "@correnthian/ui/components/avatar"
import { Badge } from "@correnthian/ui/components/badge"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"

import { EnabledBadge, NetworkBadge } from "./chain-badges"

export type ChainDetail = Contract<"GET /api/v1/chains/:id">

/**
 * Identity only: the chain, its badges, and a way back to the list.
 *
 * The chain's RPC endpoints are not here, and never will be: the API does
 * not return them, because they are infrastructure configuration and
 * publishing them invites a third party onto our paid quota.
 */
export function ChainDetailsHeader({ chain }: { chain: ChainDetail }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14" shape="square">
            <AvatarFallback>{chain.nativeSymbol.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold leading-none">{chain.name}</h1>
              <span className="text-sm text-muted-foreground">Chain {chain.id}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <NetworkBadge isTestnet={chain.isTestnet} />
              <EnabledBadge enabled={chain.enabled} />
              <Badge variant="outline" className="rounded-md px-2 py-0.5 text-xs font-medium">
                {chain.family}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              {chain.nativeSymbol} · {chain.decimals} decimals
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-1.5"
          nativeButton={false}
          render={<Link to="/chains" />}
        >
          <ArrowLeftIcon className="size-4" />
          All chains
        </Button>
      </CardContent>
    </Card>
  )
}

/** The not-found state, with the way back. */
export function ChainNotFound({ chainId }: { chainId: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        No chain with the id <span className="font-mono">{chainId}</span>.
      </p>
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<Link to="/chains" />}
      >
        All chains
      </Button>
    </div>
  )
}
