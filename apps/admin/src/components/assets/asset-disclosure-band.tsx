"use client"

import { FileTextIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@correnthian/ui/components/card"

// The disclosure string rendered verbatim from the detail projection (§6):
// never rebuilt from `asset.backing` on the client, so the product's claim
// cannot drift in the direction easiest to get wrong. Full-bleed band.
export function AssetDisclosureBand({ disclosure }: { disclosure: string }) {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Backing disclosure</p>
        </div>
      </CardHeader>

      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{disclosure}</p>
      </CardContent>
    </Card>
  )
}
