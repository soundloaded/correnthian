"use client"

import type { ReactNode } from "react"
import { LandmarkIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { ProviderDetail } from "./provider-details-header"

/**
 * What the provider does, from the detail projection.
 *
 * Every count comes from the API's own `_count`; quotes and redemptions are
 * what the provider has actually been used for, not what it claims to do.
 * The notes render verbatim, so the operator reads what was recorded —
 * never a second implementation of it.
 */
export function ProviderFactGrid({ provider }: { provider: ProviderDetail }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <LandmarkIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">What it does</p>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Fact label="Category">
          <span className="text-sm font-medium">{provider.category}</span>
        </Fact>

        <Fact label="Last checked">
          <span className="text-sm font-medium">
            {provider.lastCheckedAt
              ? new Date(provider.lastCheckedAt).toLocaleString()
              : "Never"}
          </span>
        </Fact>

        <Fact label="Quotes served">
          <span className="text-sm font-medium tabular-nums">
            {provider._count.quotes}
          </span>
        </Fact>

        <Fact label="Redemptions handled">
          <span className="text-sm font-medium tabular-nums">
            {provider._count.redemptions}
          </span>
        </Fact>

        <Fact label="Capabilities">
          <span className="text-sm font-medium">
            {provider.capabilities.join(", ") || "None listed"}
          </span>
        </Fact>

        <Fact label="Notes">
          <span className="text-sm text-muted-foreground">
            {provider.notes ?? "None recorded"}
          </span>
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
