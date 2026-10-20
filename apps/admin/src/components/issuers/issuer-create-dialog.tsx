"use client"

import * as React from "react"

import { PlusIcon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult } from "@correnthian/api-client"
import { getSession } from "@/lib/auth"
import { rankAtLeast } from "@/lib/roles"
import { Button } from "@correnthian/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@correnthian/ui/components/dialog"
import { Input } from "@correnthian/ui/components/input"
import { Label } from "@correnthian/ui/components/label"
import { Textarea } from "@correnthian/ui/components/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@correnthian/ui/components/alert-dialog"

import { buildIssuerCreateBody } from "./issuer-create-body"
import type { IssuerCreateBody, IssuerCreateForm } from "./issuer-create-body"

const EMPTY_FORM: IssuerCreateForm = {
  slug: "",
  name: "",
  jurisdiction: "",
  licenseTypes: "",
  licenseRefs: "",
  website: "",
  notes: "",
}

// Registration is compliance-only server-side, and so is every later tier
// change — which is why the form has no tier field: an issuer is created
// unverified and earning a tier is a separate, audited act. The gate here
// is display-only; RolesGuard decides. Errors render inline, never as a
// toast.
export function IssuerCreateDialog({ onCreated }: { onCreated: () => void }) {
  const sessionRole = getSession()?.role ?? "user"
  const canCreate = rankAtLeast(sessionRole, "compliance")

  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<IssuerCreateForm>(EMPTY_FORM)
  const [pending, setPending] = React.useState<IssuerCreateBody | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  if (!canCreate) {
    return (
      <p className="max-w-sm text-sm text-muted-foreground">
        Registering an issuer needs the compliance role. Your session is{" "}
        {sessionRole}, so this registry is read-only for you.
      </p>
    )
  }

  const set = (patch: Partial<IssuerCreateForm>) =>
    setForm((current) => ({ ...current, ...patch }))

  const close = () => {
    setOpen(false)
    setError(null)
    setPending(null)
    setForm(EMPTY_FORM)
  }

  const requestCreate = (event: React.FormEvent) => {
    event.preventDefault()
    const built = buildIssuerCreateBody(form)
    if (!built.ok) {
      setError(built.error)
      return
    }
    setError(null)
    setPending(built.body)
  }

  const confirmCreate = async () => {
    if (!pending) return
    setSaving(true)
    setError(null)
    const result = await api.request("POST /api/v1/issuers", {
      method: "POST",
      body: pending,
    })
    setSaving(false)
    if (result.status === "ok") {
      setPending(null)
      close()
      onCreated()
      return
    }
    setPending(null)
    setError(toMessage(result))
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Register issuer
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register an issuer</DialogTitle>
            <DialogDescription>
              An issuer is the entity that stands behind a token. A new one is
              always created unverified — earning a tier is a separate,
              audited step on its own page.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={requestCreate} className="grid gap-4">
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="issuer-slug">Slug</Label>
                <Input
                  id="issuer-slug"
                  value={form.slug}
                  onChange={(e) => set({ slug: e.target.value })}
                  placeholder="acme-metals"
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, digits and hyphens. Assets are created
                  against this slug.
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="issuer-name">Name</Label>
                <Input
                  id="issuer-name"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Acme Metals Ltd"
                  maxLength={160}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="issuer-jurisdiction">Jurisdiction</Label>
                <Input
                  id="issuer-jurisdiction"
                  value={form.jurisdiction}
                  onChange={(e) => set({ jurisdiction: e.target.value })}
                  placeholder="GB"
                  maxLength={2}
                />
                <p className="text-xs text-muted-foreground">
                  A two-letter country code.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="issuer-licence-types">Licence types</Label>
                  <Input
                    id="issuer-licence-types"
                    value={form.licenseTypes}
                    onChange={(e) => set({ licenseTypes: e.target.value })}
                    placeholder="comma-separated"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="issuer-licence-refs">Licence references</Label>
                  <Input
                    id="issuer-licence-refs"
                    value={form.licenseRefs}
                    onChange={(e) => set({ licenseRefs: e.target.value })}
                    placeholder="comma-separated"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="issuer-website">Website</Label>
                <Input
                  id="issuer-website"
                  value={form.website}
                  onChange={(e) => set({ website: e.target.value })}
                  placeholder="https://…"
                  maxLength={300}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="issuer-notes">Notes</Label>
                <Textarea
                  id="issuer-notes"
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  placeholder="Anything a reviewer should know"
                  maxLength={2000}
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
              >
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Registering…" : "Register issuer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next) setPending(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Register {pending?.name} in the registry?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? `A new issuer: ${pending.name} (${pending.slug}), jurisdiction ${pending.jurisdiction}. It will be created unverified, and the registration is written to the audit trail against your name.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCreate} disabled={saving}>
              {saving ? "Registering…" : "Register"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function toMessage(
  result: Exclude<ApiResult<unknown>, { status: "ok" }>,
): string {
  if (result.status === "unauthorised") return "Your session expired. Sign in again."
  return result.message
}
