"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

// Only filters ListQuotesDto honours: state and railKind. No text search, no
// asset filter — those arrive on neither param, so they get no control here.
const STATE_OPTIONS = [
  "quoted",
  "awaiting_payment",
  "broadcast",
  "settled",
  "failed",
  "expired",
]

const RAIL_OPTIONS = ["provider", "dex", "cex", "otc"]

type QuotesToolbarProps = {
  state: string
  onStateChange: (value: string) => void
  railKind: string
  onRailKindChange: (value: string) => void
}

export function QuotesToolbar({
  state,
  onStateChange,
  railKind,
  onRailKindChange,
}: QuotesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Select value={state} onValueChange={(value) => onStateChange(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {STATE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={railKind}
          onValueChange={(value) => onRailKindChange(value ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by rail" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All rails</SelectItem>
            {RAIL_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
