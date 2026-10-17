"use client"

import { ArrowLeftIcon, ReceiptTextIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent } from "@correnthian/ui/components/card"
import { Avatar, AvatarFallback } from "@correnthian/ui/components/avatar"
import type { Contract } from "@correnthian/api-client"

import { ActiveBadge, KindBadge, OperationBadge } from "./fee-badges"

export type FeeRuleDetail = Contract<"GET /api/v1/fees/rules/:id">

// Identity only: label + id, operation/kind/state badges, back link on the
// right. Same card arrangement as the user header.
export function FeeDetailsHeader({ rule }: { rule: FeeRuleDetail }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14" shape="square">
            <AvatarFallback>
              <ReceiptTextIcon className="size-6" />
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold leading-none">{rule.label}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <OperationBadge operation={rule.operation} />
              <KindBadge kind={rule.kind} />
              <ActiveBadge active={rule.active} />
            </div>

            <p className="font-mono text-xs text-muted-foreground">{rule.id}</p>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-1.5"
          render={<Link to="/fees" />}
        >
          <ArrowLeftIcon className="size-4" />
          All rules
        </Button>
      </CardContent>
    </Card>
  )
}

export function FeeRuleNotFound({ ruleId }: { ruleId: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <ReceiptTextIcon className="size-10 text-muted-foreground" />

      <h2 className="text-lg font-semibold">Fee rule not found</h2>

      <p className="text-sm text-muted-foreground">
        No fee rule with id {ruleId} exists, or you cannot see it.
      </p>

      <Button variant="outline" render={<Link to="/fees" />}>
        <ArrowLeftIcon className="mr-2 size-4" />
        Back to Fee rules
      </Button>
    </div>
  )
}
