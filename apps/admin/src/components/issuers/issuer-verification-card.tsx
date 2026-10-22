"use client"

import * as React from "react"

import { CheckCircle2Icon, ShieldCheckIcon, XCircleIcon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult, Contract } from "@correnthian/api-client"
import { getSession } from "@/lib/auth"
import { Button } from "@correnthian/ui/components/button"
import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"
import { Input } from "@correnthian/ui/components/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@correnthian/ui/components/alert-dialog"
import { Label } from "@correnthian/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"
import { Textarea } from "@correnthian/ui/components/textarea"

import type { IssuerDetail } from "./issuer-details-header"
import { rankAtLeast } from "@/lib/roles"

const TIER_OPTIONS = ["issuer_verified", "community_verified", "unverified"] as const

/**
 * The tier decision, with the evidence it is made on.
 *
 * Two display rules here mirror two server rules:
 *
 *  - **A reason of at least 8 characters** goes with every tier change.
 *    The server refuses a change without one, and the audit line records
 *    it — so the form asks before it sends rather than bouncing after.
 *  - **The machine checks run before the decision.** The preview below
 *    is the same evaluation the promotion enforces: licences on record, a
 *    fresh attestation, cited proof URLs answering over HTTPS. It reads
 *    the registry, and writes nothing — so "promote" is never the first
 *    time anyone looked.
 */
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
  const [tierDialog, setTierDialog] = React.useState(false)

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

  const removeRiskFlag = async (flag: string) => {
    setSaving("risk")
    setError(null)
    // The typed client answers 200 with the updated issuer — the same
    // shape the contract parses, which is how the console stays honest
    // about what it just wrote.
    const result = await api.request("DELETE /api/v1/issuers/:slug/risk-flags/:flag", {
      params: { slug: issuer.slug, flag },
    })
    setSaving(null)
    if (result.status === "ok") onChanged()
    else setError(toMessage(result))
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
              onClick={() => setTierDialog(true)}
              disabled={saving !== null || tier === issuer.verifiedTier}
            >
              {saving === "tier" ? "Saving…" : "Review…"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            issuer_verified requires licence evidence plus a custodian and a
            proof-of-reserves URL — the API refuses a bare tier.
          </p>
        </div>

        {tierDialog && (
          <TierChangeDialog
            issuer={issuer}
            tier={tier}
            onClose={() => setTierDialog(false)}
            onSaved={() => {
              setTierDialog(false)
              onChanged()
            }}
          />
        )}

        <VerificationPreview issuer={issuer} />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Risk flags — attach, or detach one that no longer applies
          </p>
          {issuer.riskFlags.length > 0 ? (
            <ul className="space-y-1.5">
              {issuer.riskFlags.map((flag) => (
                <li key={flag} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm">{flag}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeRiskFlag(flag)}
                    disabled={saving !== null}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No flags attached.</p>
          )}
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

/**
 * What the machine can check, before the operator decides.
 *
 * Read-only: it fetches the preview route with the evidence the dialog
 * cites, and writes nothing. A failed check names the missing half, so the
 * operator knows whether to record more evidence or to stop — the page
 * says "not yet" before the server has to.
 */
function VerificationPreview({ issuer }: { issuer: IssuerDetail }) {
  const [custodian, setCustodian] = React.useState("")
  const [proofUrl, setProofUrl] = React.useState("")
  const [preview, setPreview] = React.useState<Contract<
    "GET /api/v1/issuers/:slug/verification-checks"
  > | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [checking, setChecking] = React.useState(false)

  const runChecks = async () => {
    setChecking(true)
    setError(null)
    setPreview(null)
    const result = await api.request("GET /api/v1/issuers/:slug/verification-checks", {
      params: { slug: issuer.slug },
      query: {
        ...(custodian.trim() ? { custodian: custodian.trim() } : {}),
        ...(proofUrl.trim() ? { proofOfReserves: proofUrl.trim() } : {}),
      },
    })
    setChecking(false)
    if (result.status === "ok") setPreview(result.data)
    else setError(toMessage(result))
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Check the evidence before promoting — what the tier change will verify
      </p>
      <div className="space-y-1.5">
        <Input
          placeholder="Custodian the tier would cite…"
          value={custodian}
          onChange={(e) => setCustodian(e.target.value)}
        />
        <Input
          placeholder="Proof-of-reserves URL the tier would cite…"
          value={proofUrl}
          onChange={(e) => setProofUrl(e.target.value)}
        />
        <Button size="sm" variant="outline" onClick={runChecks} disabled={checking}>
          {checking ? "Checking…" : "Run checks"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {preview && (
        <ul className="space-y-1.5">
          {preview.checks.map((check) => (
            <li key={check.name} className="flex items-start gap-2 text-sm">
              {check.passed ? (
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <span>
                <span className="font-medium">{check.name.replaceAll("-", " ")}</span>
                {" — "}
                <span className="text-muted-foreground">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The tier change, with the two things the server will ask for: the
 * evidence an `issuer_verified` promotion demands, and the reason the
 * audit line records. The dialog says that reason's floor out loud — 8
 * characters — so the operator learns it before the request bounces.
 */
function TierChangeDialog({
  issuer,
  tier,
  onClose,
  onSaved,
}: {
  issuer: IssuerDetail
  tier: string
  onClose: () => void
  onSaved: () => void
}) {
  const [custodian, setCustodian] = React.useState("")
  const [proofUrl, setProofUrl] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const needsEvidence = tier === "issuer_verified"
  const reasonShort = reason.trim().length < 8

  const save = async () => {
    if (reasonShort) {
      setError("A reason of at least 8 characters is required — it is recorded against your name.")
      return
    }
    if (needsEvidence && !custodian.trim()) {
      setError("An issuer_verified tier needs a custodian — who holds the metal.")
      return
    }
    if (needsEvidence && !proofUrl.trim()) {
      setError("An issuer_verified tier needs a proof-of-reserves URL — what page says the metal is there.")
      return
    }
    setSaving(true)
    setError(null)
    const result = await api.request("PATCH /api/v1/issuers/:slug/verification", {
      params: { slug: issuer.slug },
      body: {
        tier,
        ...(needsEvidence
          ? { custodian: custodian.trim(), proofOfReserves: proofUrl.trim() }
          : {}),
        reason: reason.trim(),
      },
    })
    setSaving(false)
    if (result.status === "ok") onSaved()
    else setError(toMessage(result))
  }

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Set verification tier to {tier.replaceAll("_", " ")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This is recorded against your name, with what the machine
            checked behind it. lowering the tier is as consequential as
            raising it — the tier is the product.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          {needsEvidence && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="tier-custodian">Custodian</Label>
                <Input
                  id="tier-custodian"
                  placeholder="Who holds the metal…"
                  value={custodian}
                  onChange={(e) => setCustodian(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tier-proof">Proof of reserves</Label>
                <Input
                  id="tier-proof"
                  placeholder="https://…"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tier-reason">Reason</Label>
            <Textarea
              id="tier-reason"
              placeholder="Why this tier, in your own words…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters. It is recorded against your name, and it
              is what the next person to read this entry will actually need.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Back</AlertDialogCancel>
          <AlertDialogAction onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Set tier"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
