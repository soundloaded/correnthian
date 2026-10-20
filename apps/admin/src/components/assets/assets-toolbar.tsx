"use client"

import { SearchIcon } from "lucide-react"

import { Input } from "@correnthian/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

// Only filters the list endpoint honours: category, chainId, issuerId,
// enabled. There is no search param, so the text boxes filter chain and
// issuer by exact value — the list DTO takes raw strings, no validation
// help. `issuerId` is matched against the issuer's slug.
const CATEGORY_OPTIONS = ["crypto", "stablecoin", "metal", "treasury", "fund", "other"]

export type AssetsFilters = {
  category: string
  chainId: string
  issuerId: string
  enabled: string
}

type AssetsToolbarProps = {
  filters: AssetsFilters
  onChange: (next: AssetsFilters) => void
}

export function AssetsToolbar({ filters, onChange }: AssetsToolbarProps) {
  const set = (patch: Partial<AssetsFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-48">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Chain id…"
            value={filters.chainId}
            onChange={(e) => set({ chainId: e.target.value })}
            className="pl-9"
          />
        </div>

        <div className="relative w-full sm:w-48">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Issuer slug…"
            value={filters.issuerId}
            onChange={(e) => set({ issuerId: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select value={filters.category} onValueChange={(value) => set({ category: value ?? "all" })}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.enabled} onValueChange={(value) => set({ enabled: value ?? "all" })}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">Enabled + disabled</SelectItem>
            <SelectItem value="true">Enabled</SelectItem>
            <SelectItem value="false">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
