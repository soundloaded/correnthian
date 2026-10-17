"use client"

import { LayoutGrid, List, Search } from "lucide-react"

import { Button } from "@correnthian/ui/components/button"
import { Input } from "@correnthian/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"
import { Tabs, TabsList, TabsTrigger } from "@correnthian/ui/components/tabs"
import type { TeamView } from "./use-team-list"

// Only filters the list endpoint honours. ListUsersDto takes role,
// kycStatus, country, search — there is no status param, so status is
// display-only in the cards and gets no control here. Country is accepted
// but left out: a free-text ISO box adds validation work for a filter
// operators rarely need.
const ROLE_OPTIONS = ["user", "support", "compliance", "admin", "owner"]

const KYC_OPTIONS = ["not_started", "pending", "approved", "rejected", "expired"]

interface TeamToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  role: string
  onRoleChange: (value: string) => void
  kycStatus: string
  onKycStatusChange: (value: string) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
  view: TeamView
  onViewChange: (view: TeamView) => void
}

export function TeamToolbar({
  search,
  onSearchChange,
  role,
  onRoleChange,
  kycStatus,
  onKycStatusChange,
  hasActiveFilters,
  onClearFilters,
  view,
  onViewChange,
}: TeamToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by email or name..."
            className="h-9 w-full bg-background pl-9"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
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
            className="h-9 gap-1.5 text-muted-foreground"
            onClick={onClearFilters}
          >
            Clear
          </Button>
        )}
      </div>

      <Tabs value={view} onValueChange={(v) => onViewChange(v as TeamView)}>
        <TabsList className="grid h-9 w-[120px] grid-cols-2">
          <TabsTrigger value="grid" className="px-2" aria-label="Grid view">
            <LayoutGrid className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="list" className="px-2" aria-label="List view">
            <List className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
