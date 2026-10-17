"use client"

import { Badge } from "@correnthian/ui/components/badge"
import { Button } from "@correnthian/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@correnthian/ui/components/table"
import { cn } from "@correnthian/ui/lib/utils"
import type { Contract } from "@correnthian/api-client"

export type RuleRow = Contract<"GET /api/v1/compliance/rules">[number]

const CAPABILITIES = [
  { key: "canBuyCrypto", label: "Buy" },
  { key: "canSellCrypto", label: "Sell" },
  { key: "canUseMetals", label: "Metals" },
  { key: "canRedeem", label: "Redeem" },
] as const

function CapabilityDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      title={`${label}: ${on ? "allowed" : "blocked"}`}
      className={cn(
        "inline-block size-2 rounded-full",
        on ? "bg-emerald-500" : "bg-muted-foreground/30",
      )}
    />
  )
}

// Country then region, as the endpoint answers. Identity (country/region)
// is never editable — changing where a rule applies is a new rule, not an
// edit, so the table shows it as fixed text and the dialog does not offer it.
export function RulesTable({
  rows,
  canEdit,
  onEdit,
}: {
  rows: RuleRow[]
  canEdit: boolean
  onEdit: (rule: RuleRow) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Jurisdiction</TableHead>
            <TableHead>Buy</TableHead>
            <TableHead>Sell</TableHead>
            <TableHead>Metals</TableHead>
            <TableHead>Redeem</TableHead>
            <TableHead>KYC</TableHead>
            <TableHead>Blocked providers</TableHead>
            <TableHead>Status</TableHead>
            {canEdit && <TableHead className="w-20 pr-4" />}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(!row.active && "opacity-60")}
              >
                <TableCell className="pl-4">
                  <span className="text-sm font-medium">{row.country}</span>
                  {row.region ? (
                    <span className="text-sm text-muted-foreground"> · {row.region}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground"> · country-wide</span>
                  )}
                </TableCell>

                {CAPABILITIES.map(({ key, label }) => (
                  <TableCell key={key}>
                    <CapabilityDot on={row[key]} label={label} />
                  </TableCell>
                ))}

                <TableCell className="text-sm text-muted-foreground">
                  {row.kycRequired ? "required" : "not required"}
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {row.blockedProviders.length > 0 ? row.blockedProviders.join(", ") : "—"}
                </TableCell>

                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium",
                      row.active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                        : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
                    )}
                  >
                    {row.active ? "active" : "inactive"}
                  </Badge>
                </TableCell>

                {canEdit && (
                  <TableCell className="pr-4">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
                      Edit
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={canEdit ? 9 : 8}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No jurisdiction rules.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
