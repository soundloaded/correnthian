"use client"

import type { ReactNode } from "react"
import { LandmarkIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

import { AttestationBadge } from "./asset-badges"
import type { AssetDetail } from "./asset-details-header"

// Custody model, custodian, vaults, attestation freshness — the fact grid
// above the disclosure (§6). Every value comes from the detail projection;
// absent values read as "Not provided" rather than a blank.
export function AssetFactGrid({ asset }: { asset: AssetDetail }) {
  const backing = asset.asset.backing

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <LandmarkIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Backing</p>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Fact label="Custody model">
          <span className="text-sm font-medium">{backing.custodyModel.replaceAll("_", " ")}</span>
        </Fact>

        <Fact label="Custodian">
          <span className="text-sm font-medium">
            {backing.custodian ?? <EmptyValue />}
          </span>
        </Fact>

        <Fact label="Vault locations">
          {backing.vaultLocation.length > 0 ? (
            <span className="text-sm font-medium">{backing.vaultLocation.join(" · ")}</span>
          ) : (
            <EmptyValue />
          )}
        </Fact>

        <Fact label="Attestation">
          <div className="flex flex-wrap items-center gap-2">
            <AttestationBadge lastAttestation={backing.lastAttestation} />
            {backing.attestationCadence !== "none" && (
              <span className="text-xs text-muted-foreground">
                {backing.attestationCadence} cadence
              </span>
            )}
          </div>
        </Fact>

        <Fact label="Proof of reserve">
          {backing.proofOfReserve ? (
            <a
              href={backing.proofOfReserve}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm font-medium hover:underline"
            >
              {backing.proofOfReserve}
            </a>
          ) : (
            <EmptyValue />
          )}
        </Fact>

        <Fact label="Weight per token">
          <span className="text-sm font-medium">
            {[backing.gramsPerToken != null ? `${backing.gramsPerToken} g` : null,
              backing.ouncesPerToken != null ? `${backing.ouncesPerToken} oz` : null,
            ].filter(Boolean).join(" · ") || <EmptyValue />}
          </span>
        </Fact>
      </CardContent>
    </Card>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
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
