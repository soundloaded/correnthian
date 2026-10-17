"use client"

import * as React from "react"
import {
    SearchIcon,
    SmartphoneIcon,
    UserIcon,
} from "lucide-react"

import { Button } from "@correnthian/ui/components/button"
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@correnthian/ui/components/command"
import { useNavigate } from "@tanstack/react-router"
import { useApiQuery } from "@/lib/use-api-query"

/**
 * Search coverage is backend-shaped: only `users` and `devices/all` accept
 * a `search` param (email / display name / owner email). Every other list
 * endpoint filters by enum or id, never by free text, so a palette group
 * without a filtering endpoint would be a lie either way — invented rows,
 * or a client-side slice of page one masquerading as search. Groups with
 * no backend filtering were cut rather than faked.
 *
 * Account hits navigate to the account detail; device hits stay terminal
 * because this console has no device-detail route, so they carry the
 * operator's facts inline (platform, owner) instead of navigating somewhere
 * that cannot act on them.
 */

const MIN_CHARS = 2

export function HeaderSearch() {
    const [open, setOpen] = React.useState(false)
    const [term, setTerm] = React.useState("")
    const navigate = useNavigate()

    const trimmed = term.trim()
    const active = open && trimmed.length >= MIN_CHARS

    // Unconditional hooks with a one-row query while idle: the palette must
    // not fire real searches before the operator typed enough to mean it,
    // and the idle fetch warms the cache for the first keystroke.
    const users = useApiQuery("GET /api/v1/users", undefined, active ? { search: trimmed, limit: 5 } : { limit: 1 })
    const devices = useApiQuery("GET /api/v1/devices/all", undefined, active ? { search: trimmed, limit: 5 } : { limit: 1 })

    const searching = active && (users.isPending || devices.isPending)
    const failed = active && (users.isError || devices.isError)

    return (
        <>
            {/* Desktop search trigger */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="
          relative hidden w-64 md:block
          rounded-lg
          outline-none
          focus-visible:ring-1
          focus-visible:ring-ring
        "
            >
                <SearchIcon
                    className="
            absolute left-2.5 top-1/2
            size-4 -translate-y-1/2
            text-muted-foreground
          "
                />

                <div
                    className="
            flex h-8 w-full items-center
            rounded-lg
            border border-border/70
            bg-muted/30
            pl-8 pr-12
            text-left text-sm
            text-muted-foreground
            shadow-none
            transition-colors
            hover:bg-muted/50
          "
                >
                    Search...
                </div>

                <kbd
                    className="
            pointer-events-none
            absolute right-2 top-1/2
            flex h-5 -translate-y-1/2
            items-center gap-0.5
            rounded border border-border/70
            bg-background
            px-1.5
            text-[10px]
            font-medium
            text-muted-foreground
          "
                >
                    <span>⌘</span>
                    <span>K</span>
                </kbd>
            </button>

            {/* Mobile search */}
            <Button
                variant="ghost"
                size="icon"
                className="
          size-8
          text-muted-foreground
          hover:bg-muted
          hover:text-foreground
          md:hidden
        "
                aria-label="Search"
                onClick={() => setOpen(true)}
            >
                <SearchIcon className="size-4" />
            </Button>

            {/* Search dialog */}
            <CommandDialog
                open={open}
                onOpenChange={(value) => {
                    setOpen(value)
                    if (!value) setTerm("")
                }}
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search accounts and devices by email..."
                        value={term}
                        onValueChange={setTerm}
                    />

                    <CommandList>
                        {!active && (
                            <CommandItem disabled value="hint">
                                <SearchIcon />
                                <span className="text-muted-foreground">
                                    Type at least {MIN_CHARS} characters to search accounts and devices.
                                </span>
                            </CommandItem>
                        )}

                        {active && searching && (
                            <CommandItem disabled value="searching">
                                <SearchIcon />
                                <span className="text-muted-foreground">Searching…</span>
                            </CommandItem>
                        )}

                        {active && !searching && failed && (
                            <CommandItem disabled value="failed">
                                <SearchIcon />
                                <span className="text-muted-foreground">
                                    The search request failed — try again.
                                </span>
                            </CommandItem>
                        )}

                        {active && !searching && !failed
                            && (users.data?.items.length ?? 0) === 0
                            && (devices.data?.items.length ?? 0) === 0 && (
                            <CommandEmpty>No results found.</CommandEmpty>
                        )}

                        {active && !searching && !failed && (users.data?.items.length ?? 0) > 0 && (
                            <CommandGroup heading="Accounts">
                                {users.data!.items.map((u) => (
                                    <CommandItem
                                        key={u.id}
                                        value={`${u.email} ${u.role}`}
                                        onSelect={() => {
                                            setOpen(false)
                                            void navigate({ to: "/users/$userId", params: { userId: u.id } })
                                        }}
                                    >
                                        <UserIcon />
                                        <span className="min-w-0 flex-1 truncate">{u.email}</span>
                                        <span className="w-44 shrink-0 truncate text-right text-xs text-muted-foreground">
                                            {u.role} · {u.kycStatus} · {u._count.wallets}w / {u._count.devices}d
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {active && !searching && !failed && (devices.data?.items.length ?? 0) > 0 && (
                            <CommandGroup heading="Devices">
                                {devices.data!.items.map((d) => (
                                    <CommandItem
                                        key={d.id}
                                        value={`${d.label} ${d.user.email}`}
                                        onSelect={() => setOpen(false)}
                                    >
                                        <SmartphoneIcon />
                                        <span className="min-w-0 flex-1 truncate">{d.label}</span>
                                        <span className="w-44 shrink-0 truncate text-right text-xs text-muted-foreground">
                                            {d.platform} · {d.user.email}{d.revokedAt ? " · revoked" : ""}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </CommandDialog>
        </>
    )
}
