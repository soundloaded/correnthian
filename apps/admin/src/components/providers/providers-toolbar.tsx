"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"

// Only the filter the list endpoint honours: category. The provider
// categories are the registry's own vocabulary, so the options are
// enumerated rather than free text.
const CATEGORY_OPTIONS = [
  "metals",
  "onramp",
  "offramp",
  "rpc",
  "pricing",
  "kyc",
  "sanctions",
  "indexer",
]

type ProvidersToolbarProps = {
  category: string
  onCategoryChange: (value: string) => void
}

export function ProvidersToolbar({ category, onCategoryChange }: ProvidersToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Select value={category} onValueChange={(value) => onCategoryChange(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-44">
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
      </div>
    </div>
  )
}
