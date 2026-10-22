"use client"

import { ArrowLeftIcon, PlugIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

import type { Contract } from "@correnthian/api-client"
import { Avatar, AvatarFallback } from "@correnthian/ui/components/avatar"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"

import { FreshnessBadge, ProviderStatusBadge } from "./provider-badges"

export type ProviderDetail = Contract<"GET /api/v1/providers/:slug">

/**
 * Identity only: the provider, its state, and a way back to the list.
 *
 * No credentials — the registry never contains them, and the detail
 * projection is no exception. Never-checked rows stay destructive in tone:
 * no freshness signal means the status column cannot be trusted.
 */
export function ProviderDetailsHeader({ provider }: { provider: ProviderDetail }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14" shape="square">
            <AvatarFallback>
              <PlugIcon className="size-6" />
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold leading-none">{provider.name}</h1>
              <span className="text-sm text-muted-foreground">{provider.slug}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <ProviderStatusBadge status={provider.status} />
              <FreshnessBadge lastCheckedAt={provider.lastCheckedAt} />
            </div>

            <p className="text-sm text-muted-foreground">
              {provider.category} · {provider.capabilities.join(", ") || "no capabilities listed"}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-1.5"
          nativeButton={false}
          render={<Link to="/providers" />}
        >
          <ArrowLeftIcon className="size-4" />
          All providers
        </Button>
      </CardContent>
    </Card>
  )
}

/** The not-found state, with the way back. */
export function ProviderNotFound({ slug }: { slug: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        No provider with the slug <span className="font-mono">{slug}</span>.
      </p>
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<Link to="/providers" />}
      >
        All providers
      </Button>
    </div>
  )
}
