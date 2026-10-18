"use client"

import { SearchIcon, XCircleIcon } from "lucide-react"

import { Button } from "@correnthian/ui/components/button"
import { Input } from "@correnthian/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

// Only filters the list endpoint honours. ListUsersDto takes role,
// kycStatus, country, search — there is no status param, so status is
// display-only in the table and gets no control here. Country is accepted
// but left out: a free-text ISO box adds validation work for a filter
// operators rarely need.
const ROLE_OPTIONS = ["user", "support", "compliance", "admin", "owner"]

const KYC_OPTIONS = ["not_started", "pending", "approved", "rejected", "expired"]

type UsersToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  role: string
  onRoleChange: (value: string) => void
  kycStatus: string
  onKycStatusChange: (value: string) => void
  selectedCount: number
}

export function UsersToolbar({
  search,
  onSearchChange,
  role,
  onRoleChange,
  kycStatus,
  onKycStatusChange,
  selectedCount,
}: UsersToolbarProps) {
  const hasActiveFilters =
    search.trim() !== "" || role !== "all" || kycStatus !== "all"

  const clearAll = () => {
    onSearchChange("")
    onRoleChange("all")
    onKycStatusChange("all")
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search email or name..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={role} onValueChange={(value) => onRoleChange(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={kycStatus}
          onValueChange={(value) => onKycStatusChange(value ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filter by KYC" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All KYC states</SelectItem>
            {KYC_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="gap-1.5 text-muted-foreground"
          >
            <XCircleIcon className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {selectedCount > 0 && (
        <p className="text-sm text-muted-foreground" role="status">
          {selectedCount} selected
        </p>
      )}
    </div>
  )
}
