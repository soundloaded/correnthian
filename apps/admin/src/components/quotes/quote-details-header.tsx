"use client"

import { ArrowLeftIcon, TagsIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"
import { Avatar, AvatarFallback } from "@correnthian/ui/components/avatar"
import type { Contract } from "@correnthian/api-client"

import {
  ExecutionQualityBadge,
  QuoteStateBadge,
  RailKindBadge,
} from "./quote-badges"

export type QuoteDetail = Contract<"GET /api/v1/swaps/quotes/:id">

// Identity only: quotes are read-only in the console — execution happens in
// the account holder's wallet — so the right side holds just a back link.
export function QuoteDetailsHeader({ quote }: { quote: QuoteDetail }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14" shape="square">
            <AvatarFallback>
              <TagsIcon className="size-6" />
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-lg font-semibold leading-none">
                {quote.id.slice(0, 12)}…
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <QuoteStateBadge state={quote.state} />
              <RailKindBadge kind={quote.rail.kind} />
              <ExecutionQualityBadge quality={quote.executionQuality} />
            </div>

            <p className="text-sm text-muted-foreground">
              via rail {quote.rail.id} · expires {formatDate(quote.expiresAt)}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-1.5"
          nativeButton={false} render={<Link to="/quotes" />}
        >
          <ArrowLeftIcon className="size-4" />
          All quotes
        </Button>
      </CardContent>
    </Card>
  )
}

export function QuoteNotFound({ quoteId }: { quoteId: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <TagsIcon className="size-10 text-muted-foreground" />

      <h2 className="text-lg font-semibold">Quote not found</h2>

      <p className="text-sm text-muted-foreground">
        No quote with id {quoteId} exists, or you cannot see it.
      </p>

      <Button variant="outline" nativeButton={false} render={<Link to="/quotes" />}>
        <ArrowLeftIcon className="mr-2 size-4" />
        Back to Quotes
      </Button>
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
