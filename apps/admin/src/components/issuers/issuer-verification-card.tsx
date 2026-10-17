"use client"

import * as React from "react"

import { ShieldCheckIcon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
import { getSession } from "@/lib/auth"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { Input } from "@correnthian/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

import type { IssuerDetail } from "./issuer-details-header"

const TIER_OPTIONS = ["issuer_verified", "community_verified", "unverified"] as const

// All three mutations need compliance server-side. The UI hides the card
// below it, but that gate is display-only — RolesGuard decides. Errors
// render inline, never as a toast. Licence edits send one field at a time
// (the DTO treats omission as "leave alone"), and issuer_verified without
// evidence is refused server-side — the form says so before it bounces.
export function IssuerVerificationCard({
  issuer,
  onChanged,
}: {
  issuer: IssuerDetail
  onChanged: () => void
}) {
  const sessionRole = getSession()?.role ?? "user"
  const canVerify = rankAtLeast(sessionRole, "compliance")

  const [tier, setTier] = React.useState(issuer.verifiedTier)
  const [riskFlag, setRiskFlag] = React.useState("")
  const [licenceType, setLicenceType] = React.useState("")
  const [licenceRef, setLicenceRef] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState<"tier" | "risk" | "licences" | null>(null)

  // The detail refetch after a mutation returns fresh values; the tier
  // select follows them. Without this it sits on the stale pre-save choice.
  React.useEffect(() => {
    setTier(issuer.verifiedTier)
  }, [issuer.verifiedTier])

  if (!canVerify) {
    return (
      <Card>
        <VerificationCardHeader />
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Verification changes need the compliance role. Your session is{" "}
            {sessionRole}, so this issuer is read-only for you.
          </p>
        </CardContent>
      </Card>
    )
  }

  const saveTier = async () => {
    setSaving("tier")
    setError(null)
    const result = await api.request("PATCH /api/v1/issuers/:slug/verification", {
      params: { slug: issuer.slug },
      body: { tier },
    })
    setSaving(null)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
  }

  const addRiskFlag = async () => {
    const flag = riskFlag.trim()
    if (flag.length < 2) {
      setError("A risk flag needs at least 2 characters.")
      return
    }
    setSaving("risk")
    setError(null)
    const result = await api.request("PATCH /api/v1/issuers/:slug/risk-flags", {
      params: { slug: issuer.slug },
      body: { flag },
    })
    setSaving(null)
    if (result.status === "ok") {
      setRiskFlag("")
      onChanged()
    } else setError(toMessage(result))
  }

  // One evidence field at a time: omission means "leave alone" on this DTO,
  // so a combined save would need to merge untouched arrays client-side and
  // risk clearing what it never fetched. Appending one entry avoids that.
  const appendLicence = async (field: "licenseTypes" | "licenseRefs", value: string) => {
    const trimmed = value.trim()
    if (trimmed === "") {
      setError("Type a value before appending it.")
      return
    }
    setSaving("licences")
    setError(null)
    const current = field === "licenseTypes" ? issuer.licenseTypes : issuer.licenseRefs
    const result = await api.request("PATCH /api/v1/issuers/:slug/licences", {
      params: { slug: issuer.slug },
      body: { [field]: [...current, trimmed] },
    })
    setSaving(null)
    if (result.status === "ok") {
      if (field === "licenseTypes") setLicenceType("")
      else setLicenceRef("")
      onChanged()
    } else setError(toMessage(result))
  }

  return (
    <Card>
      <VerificationCardHeader />
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Verification tier</p>
          <div className="flex items-center gap-2">
            <Select
              value={tier}
              onValueChange={(value) => {
                if (value) setTier(value)
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={saveTier}
              disabled={saving !== null || tier === issuer.verifiedTier}
            >
              {saving === "tier" ? "Saving…" : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            issuer_verified requires licence evidence — the API refuses a bare
            tier.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Attach risk flag — propagates to every asset from this issuer
          </p>
          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g. sanctions-watch…"
              value={riskFlag}
              onChange={(e) => setRiskFlag(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={addRiskFlag}
              disabled={saving !== null}
            >
              {saving === "risk" ? "Saving…" : "Attach"}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Append licence evidence
          </p>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Licence type…"
              value={licenceType}
              onChange={(e) => setLicenceType(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => appendLicence("licenseTypes", licenceType)}
              disabled={saving !== null}
            >
              {saving === "licences" ? "Saving…" : "Add"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Licence reference…"
              value={licenceRef}
              onChange={(e) => setLicenceRef(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => appendLicence("licenseRefs", licenceRef)}
              disabled={saving !== null}
            >
              {saving === "licences" ? "Saving…" : "Add"}
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function VerificationCardHeader() {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Verification</p>
      </div>
    </CardHeader>
  )
}

const RANK: Record<string, number> = {
  user: 0,
  support: 1,
  compliance: 2,
  admin: 3,
  owner: 4,
}

// Fail-closed mirror of the API rank table.
function rankAtLeast(actual: string, required: string): boolean {
  return (RANK[actual.trim().toLowerCase()] ?? -1) >= (RANK[required] ?? 99)
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
