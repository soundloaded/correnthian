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

// Only filters the operator endpoint honours: platform, email search, and
// the includeRevoked flag. There is no per-account revocation action here —
// revocation is the account holder's own DELETE, so revoked rows render
// dimmed and verifiable rather than actionable.
const PLATFORM_OPTIONS = ["ios", "android", "web"]

type DevicesToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  platform: string
  onPlatformChange: (value: string) => void
  revoked: string
  onRevokedChange: (value: string) => void
}

export function DevicesToolbar({
  search,
  onSearchChange,
  platform,
  onPlatformChange,
  revoked,
  onRevokedChange,
}: DevicesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search by account email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            // The API caps the term at 200 characters and answers a longer
            // one with a validation failure that replaces the whole table.
            maxLength={200}
            className="pl-9"
          />
        </div>

        <Select value={platform} onValueChange={(value) => onPlatformChange(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by platform" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {PLATFORM_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={revoked} onValueChange={(value) => onRevokedChange(value ?? "included")}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Revoked devices" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="included">Include revoked</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="revoked">Revoked only</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
