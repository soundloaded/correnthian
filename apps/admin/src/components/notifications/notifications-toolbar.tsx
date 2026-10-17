"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

// The only filter the list endpoint honours. There is no channel or
// template param, so those get no control here — invented client-side
// filtering over page one would masquerade as search.
const STATE_OPTIONS = ["pending", "sent", "failed"]

type NotificationsToolbarProps = {
  state: string
  onStateChange: (value: string) => void
}

export function NotificationsToolbar({
  state,
  onStateChange,
}: NotificationsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Select value={state} onValueChange={(value) => onStateChange(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {STATE_OPTIONS.map((option) => (
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
