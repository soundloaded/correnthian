"use client"

import { ArrowLeftIcon, CoinsIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"
import { Avatar, AvatarFallback } from "@correnthian/ui/components/avatar"
import type { Contract } from "@correnthian/api-client"

import { CustodyBadge, EnabledBadge, TierBadge } from "./asset-badges"

export type AssetDetail = Contract<"GET /api/v1/assets/:assetId">

// Identity only: symbol + name + issuer, badges for the enumerated states,
// back link on the right. Same card arrangement as the user header.
export function AssetDetailsHeader({ asset }: { asset: AssetDetail }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14" shape="square">
            <AvatarFallback>{asset.asset.symbol.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold leading-none">{asset.asset.symbol}</h1>
              <span className="text-sm text-muted-foreground">{asset.asset.name}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <CustodyBadge model={asset.asset.backing.custodyModel} />
              <TierBadge tier={asset.asset.trust.verifiedTier} />
              <EnabledBadge enabled={asset.asset.enabled} />
            </div>

            <p className="text-sm text-muted-foreground">
              {asset.asset.issuer.issuerName} · {asset.asset.assetId}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-1.5"
          render={<Link to="/assets" />}
        >
          <ArrowLeftIcon className="size-4" />
          All assets
        </Button>
      </CardContent>
    </Card>
  )
}

export function AssetNotFound({ assetId }: { assetId: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <CoinsIcon className="size-10 text-muted-foreground" />

      <h2 className="text-lg font-semibold">Asset not found</h2>

      <p className="text-sm text-muted-foreground">
        No asset with id {assetId} exists, or you cannot see it.
      </p>

      <Button variant="outline" render={<Link to="/assets" />}>
        <ArrowLeftIcon className="mr-2 size-4" />
        Back to Assets
      </Button>
    </div>
  )
}
