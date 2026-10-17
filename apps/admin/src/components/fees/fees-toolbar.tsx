"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

// Only filters the rules endpoint honours: operation, kind, active. The
// vocabularies come from the fee DTOs, so the options are enumerated
// rather than free text.
const OPERATION_OPTIONS = ["swap", "buy", "sell", "redeem", "onramp", "offramp"]

const KIND_OPTIONS = ["network", "provider", "correnthian"]

export type FeesFilters = {
  operation: string
  kind: string
  active: string
}

type FeesToolbarProps = {
  filters: FeesFilters
  onChange: (next: FeesFilters) => void
}

export function FeesToolbar({ filters, onChange }: FeesToolbarProps) {
  const set = (patch: Partial<FeesFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Select value={filters.operation} onValueChange={(value) => set({ operation: value ?? "all" })}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Filter by operation" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All operations</SelectItem>
            {OPERATION_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.kind} onValueChange={(value) => set({ kind: value ?? "all" })}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by kind" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {KIND_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.active} onValueChange={(value) => set({ active: value ?? "all" })}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">Active + inactive</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
