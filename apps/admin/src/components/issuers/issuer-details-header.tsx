"use client"

import { ArrowLeftIcon, Building2Icon } from "lucide-react"
import { Link } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"
import { Avatar, AvatarFallback } from "@correnthian/ui/components/avatar"
import type { Contract } from "@correnthian/api-client"

import { RiskFlagBadge, TierBadge } from "./issuer-badges"

export type IssuerDetail = Contract<"GET /api/v1/issuers/:slug">

// Identity only: name + slug + jurisdiction, tier and risk badges, back
// link on the right. Same card arrangement as the user header.
export function IssuerDetailsHeader({ issuer }: { issuer: IssuerDetail }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14" shape="square">
            <AvatarFallback>{getInitials(issuer.name)}</AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold leading-none">{issuer.name}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <TierBadge tier={issuer.verifiedTier} />
              {issuer.riskFlags.map((flag) => (
                <RiskFlagBadge key={flag} flag={flag} />
              ))}
            </div>

            <p className="text-sm text-muted-foreground">
              {issuer.slug} · {issuer.jurisdiction}
              {issuer.website ? ` · ${issuer.website}` : ""}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-1.5"
          nativeButton={false} render={<Link to="/issuers" />}
        >
          <ArrowLeftIcon className="size-4" />
          All issuers
        </Button>
      </CardContent>
    </Card>
  )
}

export function IssuerNotFound({ slug }: { slug: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Building2Icon className="size-10 text-muted-foreground" />

      <h2 className="text-lg font-semibold">Issuer not found</h2>

      <p className="text-sm text-muted-foreground">
        No issuer with slug {slug} exists, or you cannot see it.
      </p>

      <Button variant="outline" nativeButton={false} render={<Link to="/issuers" />}>
        <ArrowLeftIcon className="mr-2 size-4" />
        Back to Issuers
      </Button>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}
