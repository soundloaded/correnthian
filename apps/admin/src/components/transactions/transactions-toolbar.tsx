"use client"

import { Input } from "@correnthian/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

// Only filters ListTransactionsDto honours: state, direction, chainId,
// walletId, userId. There is no text search on this endpoint, so there is no
// search box — the id boxes are exact-match lookups, not search.
const STATE_OPTIONS = [
  "created",
  "signed",
  "broadcast",
  "pending",
  "confirmed",
  "failed",
  "cancelled",
  "expired",
]

const DIRECTION_OPTIONS = ["in", "out", "internal"]

export type TransactionsFilters = {
  state: string
  direction: string
  chainId: string
  walletId: string
  userId: string
}

type TransactionsToolbarProps = {
  filters: TransactionsFilters
  onChange: (next: TransactionsFilters) => void
}

export function TransactionsToolbar({
  filters,
  onChange,
}: TransactionsToolbarProps) {
  const set = (patch: Partial<TransactionsFilters>) =>
    onChange({ ...filters, ...patch })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Select
          value={filters.state}
          onValueChange={(value) => set({ state: value ?? "all" })}
        >
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

        <Select
          value={filters.direction}
          onValueChange={(value) => set({ direction: value ?? "all" })}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by direction" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            {DIRECTION_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Chain id…"
          value={filters.chainId}
          onChange={(e) => set({ chainId: e.target.value })}
          className="w-full sm:w-36"
        />

        <Input
          placeholder="Wallet id…"
          value={filters.walletId}
          onChange={(e) => set({ walletId: e.target.value })}
          className="w-full sm:w-44"
        />

        <Input
          placeholder="User id…"
          value={filters.userId}
          onChange={(e) => set({ userId: e.target.value })}
          className="w-full sm:w-44"
        />
      </div>
    </div>
  )
}
