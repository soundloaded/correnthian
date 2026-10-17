"use client"

import { cn } from "@correnthian/ui/lib/utils"
import { ScaleIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import type { IssuerDetail } from "./issuer-details-header"

// The evidence is the page, not the badge (§6): licence types and references
// sit behind a left rule that turns destructive when an issuer_verified
// issuer has nothing behind it. "Nothing" counts licence types, references,
// website, and notes together — a bare tier with no trail is the state the
// rule exists to catch.
export function IssuerEvidenceCard({ issuer }: { issuer: IssuerDetail }) {
  const hasEvidence =
    issuer.licenseTypes.length > 0 ||
    issuer.licenseRefs.length > 0 ||
    issuer.website != null ||
    issuer.notes != null

  const bareVerified = issuer.verifiedTier === "issuer_verified" && !hasEvidence

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ScaleIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Licence evidence</p>
        </div>
      </CardHeader>

      <CardContent>
        <div
          className={cn(
            "space-y-3 border-l-2 pl-4",
            bareVerified ? "border-l-destructive" : "border-l-border",
          )}
        >
          {bareVerified && (
            <p role="alert" className="text-sm font-medium text-destructive">
              Verified with no evidence behind the tier. Record licences or
              lower the tier — a bare issuer_verified claim is what this rule
              exists to catch.
            </p>
          )}

          <EvidenceRow label="Licence types">
            {issuer.licenseTypes.length > 0 ? (
              <span className="text-sm font-medium">{issuer.licenseTypes.join(" · ")}</span>
            ) : (
              <EmptyValue />
            )}
          </EvidenceRow>

          <EvidenceRow label="Licence references">
            {issuer.licenseRefs.length > 0 ? (
              <span className="break-all text-sm font-medium">{issuer.licenseRefs.join(" · ")}</span>
            ) : (
              <EmptyValue />
            )}
          </EvidenceRow>

          <EvidenceRow label="Website">
            {issuer.website ? (
              <a
                href={issuer.website}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-medium hover:underline"
              >
                {issuer.website}
              </a>
            ) : (
              <EmptyValue />
            )}
          </EvidenceRow>

          <EvidenceRow label="Notes">
            {issuer.notes ? (
              <p className="whitespace-pre-wrap text-sm">{issuer.notes}</p>
            ) : (
              <EmptyValue />
            )}
          </EvidenceRow>
        </div>
      </CardContent>
    </Card>
  )
}

function EvidenceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function EmptyValue() {
  return <span className="text-sm text-muted-foreground">Not provided</span>
}
