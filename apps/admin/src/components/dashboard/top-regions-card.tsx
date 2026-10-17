"use client"

import {
  ArrowRightIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
} from "lucide-react"

import { Button } from "@correnthian/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@correnthian/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@correnthian/ui/components/dropdown-menu"
import { useApiQuery } from "@/lib/use-api-query"

// ---------------------------------------------------------------------------
// Live jurisdiction rules. The mock showed countries by pipeline share;
// the backend stores no per-country volume, so this slot shows what it
// does store: the redemption permission per jurisdiction from
// GET /compliance/rules. The ranked-row arrangement stays; countries the
// backend has never ruled on never appear — absence is the honest answer.
// ---------------------------------------------------------------------------

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  NG: "Nigeria",
  AE: "United Arab Emirates",
  SG: "Singapore",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  IN: "India",
}

function countryName(code: string) {
  return COUNTRY_NAMES[code] ?? code
}

export function TopRegionsCard() {
  const { data: rules, refetch } = useApiQuery(
    "GET /api/v1/compliance/rules",
  )

  // One row per country; a region-specific rule only narrows that row.
  const byCountry = new Map<string, { redeem: boolean; kyc: boolean }>()
  for (const rule of rules ?? []) {
    const row = byCountry.get(rule.country) ?? { redeem: true, kyc: false }
    if (!rule.active) continue
    row.redeem = row.redeem && rule.canRedeem
    row.kyc = row.kyc || rule.kycRequired
    byCountry.set(rule.country, row)
  }
  const rows = [...byCountry.entries()]
    .map(([country, flags], i) => ({ rank: i + 1, country, ...flags }))
    .sort((a, b) => a.country.localeCompare(b.country))
    .map((row, i) => ({ ...row, rank: i + 1 }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <p className="text-sm font-semibold">Redemption by Jurisdiction</p>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
              />
            }
          >
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl p-2">
            <DropdownMenuItem className="gap-2" onClick={() => refetch()}>
              <RefreshCwIcon className="size-4" />
              <span>Refresh</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        <div className="divide-y">
          {rows.map((row) => (
            <div
              key={row.country}
              className="flex items-center justify-between py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm text-muted-foreground">
                  {row.rank}
                </span>

                <p className="text-sm font-medium">
                  {countryName(row.country)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                    row.redeem
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-400"
                  }`}
                >
                  {row.redeem ? "Redeemable" : "Blocked"}
                </span>
                {row.kyc && (
                  <span className="text-xs text-muted-foreground">
                    KYC required
                  </span>
                )}
              </div>
            </div>
          ))}

          {rules && rows.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No jurisdiction rules yet.
            </p>
          )}
          {!rules && (
            <p className="py-6 text-center text-sm text-muted-foreground">—</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="border-t bg-background">
        <Button variant="outline" className="w-full gap-1.5">
          View more
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  )
}
