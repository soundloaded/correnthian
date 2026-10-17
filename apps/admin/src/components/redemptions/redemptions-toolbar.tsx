"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

// The one filter the list endpoint honours. Highest-traffic states first is a
// guess the URL does not need — alphabetical keeps the control honest.
const STATE_OPTIONS = [
  "approved",
  "cancelled",
  "delivered",
  "in_production",
  "kyc_pending",
  "rejected",
  "requested",
  "shipped",
]

type RedemptionsToolbarProps = {
  state: string
  onStateChange: (value: string) => void
}

export function RedemptionsToolbar({
  state,
  onStateChange,
}: RedemptionsToolbarProps) {
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
      </div>
    </div>
  )
}
