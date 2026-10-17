"use client"

import type { ReactNode } from "react"
import { ListFilterIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { FeeRuleDetail } from "./fee-details-header"

// Every selector the rule carries, as the stored row reads it. Selectors are
// what decide whether a quote matches, so they render verbatim — a null
// selector means unrestricted, and the copy says so rather than leaving a
// blank an operator could misread as "not loaded".
export function FeeSelectorsCard({ rule }: { rule: FeeRuleDetail }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ListFilterIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Selectors</p>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Selector label="Basis">
          <span className="text-sm font-medium">{rule.basis}</span>
        </Selector>

        <Selector label="Charge">
          <span className="text-sm font-medium tabular-nums">
            {rule.basis === "fixed"
              ? rule.fixedUsd != null
                ? `$${rule.fixedUsd}`
                : "no amount stored"
              : rule.rateBps != null
                ? `${(rule.rateBps / 100).toFixed(2)}% (${rule.rateBps} bps)`
                : "no rate stored"}
          </span>
        </Selector>

        <Selector label="Asset">
          <span className="text-sm font-medium">
            {rule.assetId ?? rule.assetCategory ?? <Unrestricted />}
          </span>
        </Selector>

        <Selector label="Provider">
          <span className="text-sm font-medium">
            {rule.providerSlug ?? <Unrestricted />}
          </span>
        </Selector>

        <Selector label="Jurisdiction">
          <span className="text-sm font-medium">
            {[rule.country, rule.region].filter(Boolean).join(" / ") || <Unrestricted />}
          </span>
        </Selector>

        <Selector label="Notional window">
          <span className="text-sm font-medium tabular-nums">
            {[rule.minNotionalUsd ? `≥ $${rule.minNotionalUsd}` : null,
              rule.maxNotionalUsd ? `≤ $${rule.maxNotionalUsd}` : null,
            ].filter(Boolean).join(" · ") || <Unrestricted />}
          </span>
        </Selector>

        <Selector label="Priority">
          <span className="text-sm font-medium tabular-nums">
            {rule.priority} — higher wins
          </span>
        </Selector>

        <Selector label="Specificity">
          <span className="text-sm tabular-nums text-muted-foreground">
            asset {rule.specificity.asset} · provider {rule.specificity.provider} ·{" "}
            jurisdiction {rule.specificity.jurisdiction} · notional {rule.specificity.notional}
          </span>
        </Selector>

        <Selector label="Effective">
          <span className="text-sm font-medium">
            {[rule.effectiveFrom ? formatDate(rule.effectiveFrom) : "always",
              rule.effectiveUntil ? `until ${formatDate(rule.effectiveUntil)}` : null,
            ].filter(Boolean).join(" ")}
          </span>
        </Selector>
      </CardContent>
    </Card>
  )
}

function Selector({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Unrestricted() {
  return <span className="text-sm text-muted-foreground">unrestricted</span>
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
