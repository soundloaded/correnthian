"use client"

import { Link } from "@tanstack/react-router"
import { CoinsIcon } from "lucide-react"

import { Badge } from "@correnthian/ui/components/badge"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { IssuerDetail } from "./issuer-details-header"

// The detail projection's own asset list — no second fetch, no join on the
// client. A row of "not provided" would lie about the data, so an issuer
// with no assets says so plainly.
export function IssuerAssetsCard({ issuer }: { issuer: IssuerDetail }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CoinsIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Assets</p>
        </div>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {issuer.assets.length} total
        </span>
      </CardHeader>

      <CardContent>
        {issuer.assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No assets are registered under this issuer.
          </p>
        ) : (
          <div className="divide-y">
            {issuer.assets.map((asset) => (
              <div
                key={asset.assetId}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    to="/assets/$assetId"
                    params={{ assetId: asset.assetId }}
                    className="text-sm font-medium hover:underline"
                  >
                    {asset.symbol}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {asset.name}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={
                    asset.enabled
                      ? "rounded-md border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                      : "rounded-md border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                  }
                >
                  {asset.enabled ? "enabled" : "disabled"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
