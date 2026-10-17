"use client"

import { WalletIcon } from "lucide-react"

import { Badge } from "@correnthian/ui/components/badge"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@correnthian/ui/components/tooltip"

import type { UserDetail } from "./user-details-header"

// A smart account whose deploy has not confirmed exists nowhere on-chain:
// it cannot hold or move anything, so it must never read as live. That is
// the "not yet" badge, not a grey "pending" an operator could misread.
// Deploy state is real — it comes from the detail projection's wallets.
export function UserWalletsCard({ user }: { user: UserDetail }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <WalletIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Wallets</p>
        </div>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {user.wallets.length} total
        </span>
      </CardHeader>

      <CardContent>
        {user.wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This account has no wallets.
          </p>
        ) : (
          <div className="divide-y">
            {user.wallets.map((wallet) => {
              const undeployed = wallet.kind === "smart" && !wallet.deployed

              return (
                <div
                  key={wallet.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium">
                      {wallet.address}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {wallet.label ?? wallet.kind} · {wallet.chainId}
                      {wallet.isPrimary ? " · primary" : ""}
                    </p>
                  </div>

                  {undeployed ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge
                          variant="outline"
                          className="rounded-md border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
                        >
                          not yet
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        The deploy transaction has not confirmed. This wallet
                        exists nowhere on-chain and cannot hold or move
                        anything.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Badge
                      variant="outline"
                      className="rounded-md border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                    >
                      live
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
