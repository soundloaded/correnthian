"use client"

import * as React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@correnthian/ui/components/table"
import type { Contract } from "@correnthian/api-client"
import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
import { getSession } from "@/lib/auth"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

import { FreshnessBadge, ProviderStatusBadge } from "./provider-badges"
import { rankAtLeast } from "@/lib/roles"

export type ProviderRow = Contract<"GET /api/v1/providers">[number]

const STATUS_OPTIONS = ["active", "degraded", "disabled"] as const

// Same arrangement as the users table: identity first, status badge with
// the destructive degraded tone, freshness, usage counts. There is
// deliberately no credentials column — the registry never contains them
// (§6). Status changes are inline and admin-gated; the gate is cosmetic,
// RolesGuard decides, errors render under the row.
export function ProvidersTable({
  rows,
  onChanged,
}: {
  rows: ProviderRow[]
  onChanged: () => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Provider</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Freshness</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead className="pr-4">Set status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <ProviderTableRow key={row.slug} row={row} onChanged={onChanged} />
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No providers found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function ProviderTableRow({
  row,
  onChanged,
}: {
  row: ProviderRow
  onChanged: () => void
}) {
  const sessionRole = getSession()?.role ?? "user"
  const canManage = rankAtLeast(sessionRole, "admin")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Degraded or never-checked rows demand action, so they read at full
  // weight. Disabled rows dim — they are intentionally out of service.
  const dimmed = row.status === "disabled"

  const setStatus = async (status: string) => {
    if (status === row.status) return
    setSaving(true)
    setError(null)
    const result = await api.request("PATCH /api/v1/providers/:slug/status", {
      params: { slug: row.slug },
      body: { status },
    })
    setSaving(false)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  return (
    <>
      <TableRow className={dimmed ? "opacity-60" : ""}>
        <TableCell className="pl-4">
          <p className="text-sm font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.slug}</p>
        </TableCell>

        <TableCell className="text-sm">{row.category}</TableCell>

        <TableCell>
          <ProviderStatusBadge status={row.status} />
        </TableCell>

        <TableCell>
          <FreshnessBadge lastCheckedAt={row.lastCheckedAt} />
        </TableCell>

        <TableCell className="text-sm tabular-nums text-muted-foreground">
          {row._count.quotes} quotes · {row._count.redemptions} redemptions
        </TableCell>

        <TableCell className="pr-4">
          {canManage ? (
            <Select
              value={row.status}
              onValueChange={(value) => {
                if (value) setStatus(value)
              }}
              disabled={saving}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground">admin only</span>
          )}
        </TableCell>
      </TableRow>
      {error && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="py-0 pl-4 pb-3">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
