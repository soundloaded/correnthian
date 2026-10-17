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

// Only filters the list endpoint honours: action (free text), outcome, and
// requestId. There is no actor, target, or date filter server-side, so none
// is offered here. The limit is a display cap, not a filter — newest 200 at
// most, which the page says outright.
const OUTCOME_OPTIONS = ["success", "failure", "denied"]

type AuditToolbarProps = {
  action: string
  onActionChange: (value: string) => void
  outcome: string
  onOutcomeChange: (value: string) => void
  requestId: string
  onRequestIdChange: (value: string) => void
}

export function AuditToolbar({
  action,
  onActionChange,
  outcome,
  onOutcomeChange,
  requestId,
  onRequestIdChange,
}: AuditToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Filter by action, e.g. kyc.approved"
            value={action}
            onChange={(e) => onActionChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={outcome} onValueChange={(value) => onOutcomeChange(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by outcome" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            {OUTCOME_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full sm:w-56">
          <Input
            placeholder="Request ID (X-Request-Id)"
            value={requestId}
            onChange={(e) => onRequestIdChange(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
      </div>
    </div>
  )
}
