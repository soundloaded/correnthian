"use client"

import type { ReactNode } from "react"
import { BoxesIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { ChainDetail } from "./chain-details-header"

/**
 * What the chain holds, from the detail projection.
 *
 * Every count comes from the API's own `_count`; the console does not
 * recount anything, because a count the console computes and the API
 * disagrees with is a count an operator cannot trust.
 */
export function ChainFactGrid({ chain }: { chain: ChainDetail }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BoxesIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">On this chain</p>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Fact label="Assets">
          <span className="text-sm font-medium tabular-nums">
            {chain._count.assets}
          </span>
        </Fact>

        <Fact label="Wallets">
          <span className="text-sm font-medium tabular-nums">
            {chain._count.wallets}
          </span>
        </Fact>

        <Fact label="Transactions">
          <span className="text-sm font-medium tabular-nums">
            {chain._count.transactions}
          </span>
        </Fact>

        <Fact label="Explorer">
          {chain.explorerUrl ? (
            <a
              href={chain.explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm font-medium underline underline-offset-4"
            >
              Open the explorer
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">Not provided</span>
          )}
        </Fact>

        <Fact label="Family">
          <span className="text-sm font-medium">{chain.family}</span>
        </Fact>

        <Fact label="Native symbol">
          <span className="text-sm font-medium">{chain.nativeSymbol}</span>
        </Fact>
      </CardContent>
    </Card>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}
