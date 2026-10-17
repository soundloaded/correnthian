"use client"

import { Settings2Icon } from "lucide-react"

import { Card, CardContent } from "@correnthian/ui/components/card"

// Honest nothing: these surfaces have no backend — no reads, no writes, no
// model that could answer. A settings page that rendered working-looking
// toggles here would be the mock the rebuild exists to remove, so each
// section names what it would need instead.
const SECTIONS: Record<string, { title: string; needs: string }> = {
  appearance: {
    title: "Appearance",
    needs: "a per-operator theme preference store — no such model exists, and the console ships theme tokens, not a theme picker.",
  },
  workspace: {
    title: "Workspace",
    needs: "a workspace or organisation model — operators, roles, and names all live on accounts, and there is nothing else to configure.",
  },
  pipeline: {
    title: "Pipeline",
    needs: "a pipeline model — the CRM pages were removed in wave 3 (no backend models, no product reason), so there is nothing to stage.",
  },
  billing: {
    title: "Billing",
    needs: "a billing or plan model — fees are computed per quote by the fee engine, not billed to a workspace.",
  },
  "api-webhooks": {
    title: "API & webhooks",
    needs: "an API-key and webhook-endpoint model — no key issuance, secret storage, or delivery log exists.",
  },
}

export function NoBackendSection({ section }: { section: keyof typeof SECTIONS }) {
  const info = SECTIONS[section]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{info?.title ?? section}</h2>
        <p className="text-sm text-muted-foreground">
          This section has no backend yet.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60">
            <Settings2Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="max-w-md space-y-1">
            <p className="text-sm font-medium">Nothing to configure here</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {info?.needs ?? "No endpoint backs this surface."} The toggles
              and forms this page used to show saved nowhere — they were
              removed rather than kept as decoration.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
