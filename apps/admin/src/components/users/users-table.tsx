"use client"

import { Link } from "@tanstack/react-router"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@correnthian/ui/components/table"
import { Button } from "@correnthian/ui/components/button"
import { Checkbox } from "@correnthian/ui/components/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@correnthian/ui/components/dropdown-menu"
import type { Contract } from "@correnthian/api-client"
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, MoreHorizontalIcon } from "lucide-react"

import { AccountStatusBadge, KycBadge, RoleBadge } from "./user-badges"
import { AccountAvatar } from "./account-avatar"

export type UserRow = Contract<"GET /api/v1/users">["items"][number]

export type UserSort = "createdAt" | "email"
export type SortDir = "asc" | "desc"

// Contacts-pattern table on live account rows: selection column, sortable
// headers, account cell with avatar + email link, row actions menu,
// numbered footer with rows-per-page. Selection here is navigation state
// only — accounts are never deleted, so there is no bulk action; the
// footer count is what multi-select is for (compare, audit-trail hop).
// The list projection carries no display name, so email is the identity
// and the fallback reads initials, never "not provided".
export function UsersTable({
  rows,
  pageIndex,
  pageCount,
  pageSize,
  totalCount,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onPageChange,
  onPageSizeChange,
  sort,
  order,
  onSortChange,
}: {
  rows: UserRow[]
  pageIndex: number
  pageCount: number
  pageSize: number
  totalCount: number
  selectedIds: Set<string>
  onToggleRow: (id: string) => void
  onToggleAll: () => void
  onPageChange: (index: number) => void
  onPageSizeChange: (size: number) => void
  sort: UserSort
  order: SortDir
  onSortChange: (sort: UserSort) => void
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
  const someSelected = rows.some((r) => selectedIds.has(r.id))

  // Same header idiom as the reference: the label is a button and the arrow
  // marks the active sort. Only `createdAt` and `email` sort server-side
  // (the DTO closes the set), so only those two headers are buttons — the
  // rest stay plain text rather than faking a client-side reorder of one
  // page. Tapping the active column flips direction; tapping the other
  // column starts descending (newest / Z-first is the useful default).
  // The arrow shows direction: up for ascending, down for descending.
  const sortHeader = (label: string, key: UserSort) => {
    const active = sort === key
    const ArrowIcon = active && order === "asc" ? ArrowUpIcon : ArrowDownIcon
    return (
      <button
        type="button"
        onClick={() => onSortChange(key)}
        className="flex items-center gap-1.5"
        aria-label={`Sort by ${label.toLowerCase()}${active ? ` (currently ${order}ending)` : ""}`}
      >
        {label}
        <ArrowIcon
          className={`size-3.5 ${active ? "text-foreground" : "text-muted-foreground/60"}`}
        />
      </button>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onCheckedChange={onToggleAll}
                aria-label="Select all accounts on this page"
              />
            </TableHead>
            <TableHead className="pl-4">{sortHeader("Account", "email")}</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>KYC</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Wallets</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead>{sortHeader("Created", "createdAt")}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => {
              const selected = selectedIds.has(row.id)
              return (
                <TableRow
                  key={row.id}
                  data-state={selected ? "selected" : undefined}
                  className={row.status !== "active" ? "opacity-60" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => onToggleRow(row.id)}
                      aria-label={`Select ${row.email}`}
                    />
                  </TableCell>

                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      <AccountAvatar accountId={row.id} title={row.email} />
                      <Link
                        to="/users/$userId"
                        params={{ userId: row.id }}
                        className="text-sm font-medium hover:underline"
                      >
                        {row.email}
                      </Link>
                    </div>
                  </TableCell>

                  <TableCell>
                    <RoleBadge role={row.role} />
                  </TableCell>

                  <TableCell>
                    <KycBadge status={row.kycStatus} />
                  </TableCell>

                  <TableCell>
                    <AccountStatusBadge status={row.status} />
                  </TableCell>

                  <TableCell className="tabular-nums">
                    {row._count.wallets}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {formatDate(row.lastLoginAt)}
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground"
                          />
                        }
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-40 rounded-xl p-2">
                        <DropdownMenuItem
                          className="gap-2"
                          render={
                            <Link
                              to="/users/$userId"
                              params={{ userId: row.id }}
                            />
                          }
                        >
                          <EyeIcon className="size-4" />
                          <span>View</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={9}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No users found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Page {pageIndex + 1} of {Math.max(pageCount, 1)}
          </div>

          <div className="text-sm text-muted-foreground">
            {selectedIds.size} of {totalCount} rows selected
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Rows per page"
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={pageIndex <= 0}
          >
            Previous
          </Button>

          {Array.from({ length: pageCount }, (_, i) => {
            const isActive = i === pageIndex
            return (
              <Button
                key={i}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(i)}
              >
                {i + 1}
              </Button>
            )
          })}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={pageIndex + 1 >= pageCount}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString()
}
