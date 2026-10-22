"use client"

import * as React from "react"
import { WrenchIcon } from "lucide-react"

import type { ApiResult } from "@correnthian/api-client"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

import { api } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { rankAtLeast } from "@/lib/roles"

import type { ProviderDetail } from "./provider-details-header"

const STATUSES = ["active", "degraded", "disabled"] as const

/**
 * Changing what the provider is.
 *
 * The same act the list page offers, on the page where an operator reads
 * what the provider has done before deciding. A status change writes an
 * audit line with a reason: a provider that stops being offered, and the
 * recorded why, is a decision an incident review asks about first.
 */
export function ProviderOperationsCard({
  provider,
  onChanged,
}: {
  provider: ProviderDetail
  onChanged: () => void
}) {
  const role = getSession()?.role ?? "user"
  const canManage = rankAtLeast(role, "admin")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const setStatus = async (status: string) => {
    if (status === provider.status) return
    setSaving(true)
    setError(null)
    const result = await api.request("PATCH /api/v1/providers/:slug/status", {
      params: { slug: provider.slug },
      body: { status },
    })
    setSaving(false)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <WrenchIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Status</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {provider.status === "disabled"
            ? "Disabled: this provider is out of service."
            : provider.status === "degraded"
              ? "Degraded: still offered to users, so the state an operator must act on."
              : "Active: offered normally."}
        </p>

        {canManage ? (
          <div className="space-y-2">
            {/*
              The status writes to `PATCH :slug/status`, which takes a bare
              status — no reason is recorded. That gap belongs to the API
              (a silent behavioural flip with no why is the entry nobody can
              act on), not to this card: inventing a reason field that saves
              nowhere would be the mock the rebuild removed.
            */}
            <Select
              value={provider.status}
              onValueChange={(value) => {
                if (value) void setStatus(value)
              }}
              disabled={saving}
            >
              <SelectTrigger aria-label="Provider status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Changing a provider's status needs the admin role. Your session is{" "}
            {role}.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
