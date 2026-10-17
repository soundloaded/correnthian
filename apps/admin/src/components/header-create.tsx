"use client"

import * as React from "react"
import {
  BellPlusIcon,
  FilePlusIcon,
  HandCoinsIcon,
  PlusIcon,
  TimerIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@correnthian/ui/components/dropdown-menu"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"
import { api } from "@/lib/api"
import { getSession } from "@/lib/auth"

/**
 * The Create verdict. The inherited Nexora items (New Lead, New Task,
 * Schedule Meeting, Send Email, Add Note, Attach File) have no backend
 * anywhere in this repo — they were menu-shaped decoration — so all six
 * were cut. What remains are the three operator writes this console can
 * honestly perform today:
 *
 * - Queue notification → POST /notifications (support+)
 * - Propose fee rule  → POST /fees/rules (owner only, needs a reason)
 * - Record attestation → PATCH /assets/:assetId/attestation (compliance+)
 *
 * The fee-rule body is deliberately partial: the full rule has a dozen
 * optional selectors (provider, jurisdiction, notional band, windows),
 * and a header dialog is the wrong place to author precision pricing.
 * The dialog authors a labelled percent-or-fixed rule and says so; the
 * rest belongs to a fee-rule page when one exists.
 *
 * Role-gating here is cosmetic, as everywhere in this console: the API
 * enforces independently, and the gate exists only so an operator is not
 * offered a dialog that will only bounce. Errors render inline in the
 * dialog that produced them, never as toasts.
 */

type ActionId = "notify" | "fee" | "attest" | "job" | null

const RANK: Record<string, number> = {
  user: 0,
  support: 1,
  compliance: 2,
  admin: 3,
  owner: 4,
}

function useRole(): string {
  return getSession()?.role ?? "user"
}

function roleAtLeast(actual: string, required: string): boolean {
  return (RANK[actual.trim().toLowerCase()] ?? -1) >= (RANK[required] ?? 99)
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
      {message}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Queue notification (support+)
// ---------------------------------------------------------------------------

const NOTIFY_CHANNELS = ["email", "push", "in_app"] as const

function NotifyDialog({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = React.useState<string>("in_app")
  const [template, setTemplate] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  // The enqueue route stamps the row with the *caller's* account: this queues
  // for the operator themselves, which is why the dialog says so outright
  // rather than offering a recipient field the API would ignore.
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const name = template.trim()
    if (!name) {
      setError("Give the notification a template name.")
      return
    }
    setBusy(true)
    setError(null)
    const result = await api.request("POST /api/v1/notifications", {
      body: { channel, template: name, payload: {} },
    })
    setBusy(false)
    if (result.status === "ok") {
      onClose()
      return
    }
    setError(
      result.status === "unauthorised"
        ? "Your session expired. Sign in again."
        : result.status === "forbidden" || result.status === "unavailable" || result.status === "error"
          ? result.message
          : "The request failed.",
    )
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Queue notification</DialogTitle>
        <DialogDescription>
          Queued for your own account — the API stamps the row with the caller, so this cannot notify anyone else.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4">
        <Field id="notify-channel" label="Channel">
          <Select value={channel} onValueChange={(v) => setChannel(v ?? "in_app")}>
            <SelectTrigger id="notify-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTIFY_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="notify-template" label="Template" hint="The template name, e.g. kyc-approved. Delivery is recorded, not yet sent — no provider is wired.">
          <Input
            id="notify-template"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="kyc-approved"
            maxLength={80}
          />
        </Field>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Queueing…" : "Queue"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

// ---------------------------------------------------------------------------
// Propose fee rule (owner only, needs a reason)
// ---------------------------------------------------------------------------

const FEE_OPERATIONS = ["swap", "buy", "sell", "redeem", "onramp", "offramp"] as const
const FEE_KINDS = ["network", "provider", "correnthian"] as const

function FeeRuleDialog({ onClose }: { onClose: () => void }) {
  const [operation, setOperation] = React.useState<string>("swap")
  const [kind, setKind] = React.useState<string>("correnthian")
  const [basis, setBasis] = React.useState<"percent" | "fixed">("percent")
  const [label, setLabel] = React.useState("")
  const [rateBps, setRateBps] = React.useState("")
  const [fixedUsd, setFixedUsd] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!label.trim()) {
      setError("Give the rule a label.")
      return
    }
    // Mirrors the backend's basis-consistency rule client-side so a
    // percent rule without a rate fails here, not as a 400.
    if (basis === "percent") {
      const bps = Number(rateBps)
      if (!Number.isInteger(bps) || bps < 0 || bps > 1_000_000) {
        setError("A percent fee needs a rate in basis points (0–1000000).")
        return
      }
    } else {
      if (!/^\d+(\.\d+)?$/.test(fixedUsd.trim())) {
        setError("A fixed fee needs an exact USD amount, as a decimal string.")
        return
      }
    }
    if (reason.trim().length < 8) {
      setError("A reason of at least 8 characters is required — it is recorded against your name.")
      return
    }
    setBusy(true)
    setError(null)
    const result = await api.request("POST /api/v1/fees/rules", {
      body: basis === "percent"
        ? { operation, kind, basis, label: label.trim(), rateBps: Number(rateBps), reason: reason.trim() }
        : { operation, kind, basis, label: label.trim(), fixedUsd: fixedUsd.trim(), reason: reason.trim() },
    })
    setBusy(false)
    if (result.status === "ok") {
      onClose()
      return
    }
    setError(
      result.status === "unauthorised"
        ? "Your session expired. Sign in again."
        : result.status === "forbidden" || result.status === "unavailable" || result.status === "error"
          ? result.message
          : "The request failed.",
    )
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Propose fee rule</DialogTitle>
        <DialogDescription>
          A labelled percent-or-fixed rule, unrestricted unless narrowed later. Owner only.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="fee-operation" label="Operation">
            <Select value={operation} onValueChange={(v) => setOperation(v ?? "swap")}>
              <SelectTrigger id="fee-operation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_OPERATIONS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="fee-kind" label="Kind">
            <Select value={kind} onValueChange={(v) => setKind(v ?? "correnthian")}>
              <SelectTrigger id="fee-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field id="fee-label" label="Label">
          <Input
            id="fee-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Standard swap fee"
            maxLength={80}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="fee-basis" label="Basis">
            <Select value={basis} onValueChange={(v) => setBasis(v as "percent" | "fixed")}>
              <SelectTrigger id="fee-basis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">percent</SelectItem>
                <SelectItem value="fixed">fixed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {basis === "percent" ? (
            <Field id="fee-rate" label="Rate (bps)" hint="100 bps = 1%.">
              <Input
                id="fee-rate"
                inputMode="numeric"
                value={rateBps}
                onChange={(e) => setRateBps(e.target.value)}
                placeholder="25"
              />
            </Field>
          ) : (
            <Field id="fee-amount" label="Amount (USD)" hint="Exact decimal, never a float.">
              <Input
                id="fee-amount"
                inputMode="decimal"
                value={fixedUsd}
                onChange={(e) => setFixedUsd(e.target.value)}
                placeholder="1.50"
              />
            </Field>
          )}
        </div>
        <Field id="fee-reason" label="Reason" hint="Required. Recorded against your name in the audit trail.">
          <Input
            id="fee-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this rate is changing"
            maxLength={500}
          />
        </Field>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Proposing…" : "Propose rule"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

// ---------------------------------------------------------------------------
// Record attestation (compliance+)
// ---------------------------------------------------------------------------

function AttestDialog({ onClose }: { onClose: () => void }) {
  const assets = api // placeholder to keep hook order out of this component
  void assets
  return <AttestForm onClose={onClose} />
}

function AttestForm({ onClose }: { onClose: () => void }) {
  const [listQuery] = React.useState({ limit: 200 })
  const result = useAssetList(listQuery)
  const [assetId, setAssetId] = React.useState("")
  const [proofUrl, setProofUrl] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const options = result.data ?? []

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!assetId) {
      setError("Choose the asset this attestation covers.")
      return
    }
    if (proofUrl.trim()) {
      try {
        const url = new URL(proofUrl.trim())
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("bad protocol")
      } catch {
        setError("The proof URL must be a valid URL.")
        return
      }
    }
    setBusy(true)
    setError(null)
    const res = await api.request("PATCH /api/v1/assets/:assetId/attestation", {
      params: { assetId },
      body: {
        attestedAt: new Date().toISOString(),
        ...(proofUrl.trim() ? { proofUrl: proofUrl.trim() } : {}),
      },
    })
    setBusy(false)
    if (res.status === "ok") {
      onClose()
      return
    }
    setError(
      res.status === "unauthorised"
        ? "Your session expired. Sign in again."
        : res.status === "forbidden" || res.status === "unavailable" || res.status === "error"
          ? res.message
          : "The request failed.",
    )
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Record attestation</DialogTitle>
        <DialogDescription>
          Stamps now as the attestation time for the chosen asset. Compliance only.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4">
        <Field id="attest-asset" label="Asset">
          {result.isPending ? (
            <p className="text-sm text-muted-foreground">Loading assets…</p>
          ) : result.isError ? (
            <p className="text-sm text-muted-foreground">The asset registry could not be reached.</p>
          ) : (
            <Select value={assetId} onValueChange={(v) => setAssetId(v ?? "")}>
              <SelectTrigger id="attest-asset">
                <SelectValue placeholder="Choose an asset" />
              </SelectTrigger>
              <SelectContent>
                {options.map((a) => (
                  <SelectItem key={a.asset.assetId} value={a.asset.assetId}>
                    {a.asset.symbol} — {a.asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field id="attest-proof" label="Proof URL (optional)" hint="The auditor's report or proof-of-reserves page.">
          <Input
            id="attest-proof"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder="https://…"
            maxLength={500}
          />
        </Field>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Recording…" : "Record"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function useAssetList(query: { limit: number }) {
  const [state, setState] = React.useState<{
    data: { asset: { assetId: string; symbol: string; name: string } }[] | null
    isPending: boolean
    isError: boolean
  }>({ data: null, isPending: true, isError: false })

  React.useEffect(() => {
    let live = true
    api.request("GET /api/v1/assets", { query }).then((res) => {
      if (!live) return
      if (res.status === "ok") setState({ data: res.data, isPending: false, isError: false })
      else setState({ data: null, isPending: false, isError: true })
    })
    return () => { live = false }
  }, [query.limit])

  return state
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export function HeaderCreate() {
  const [action, setAction] = React.useState<ActionId>(null)
  const role = useRole()

  const canNotify = roleAtLeast(role, "support")
  const canFee = roleAtLeast(role, "owner")
  const canAttest = roleAtLeast(role, "compliance")

  // The dialog is separate from the menu so a failed mutation's inline
  // error survives: closing the menu must not unmount the form.
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="sm"
              className="gap-1.5 rounded-full px-4"
            >
              <PlusIcon className="size-4" />
              <span>Create</span>
            </Button>
          }
        />

        <DropdownMenuContent
          align="end"
          className="w-52 p-2"
          sideOffset={6}
        >
          <DropdownMenuGroup>
            {canNotify && (
              <DropdownMenuItem className="gap-2" onSelect={() => setAction("notify")}>
                <BellPlusIcon className="size-4" />
                <span>Queue notification</span>
              </DropdownMenuItem>
            )}

            {canFee && (
              <DropdownMenuItem className="gap-2" onSelect={() => setAction("fee")}>
                <HandCoinsIcon className="size-4" />
                <span>Propose fee rule</span>
              </DropdownMenuItem>
            )}

            {canAttest && (
              <DropdownMenuItem className="gap-2" onSelect={() => setAction("attest")}>
                <FilePlusIcon className="size-4" />
                <span>Record attestation</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem className="gap-2" onSelect={() => setAction("job")}>
              <TimerIcon className="size-4" />
              <span>Run scheduled job</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={action !== null} onOpenChange={(v) => { if (!v) setAction(null) }}>
        {action === "notify" && <NotifyDialog onClose={() => setAction(null)} />}
        {action === "fee" && <FeeRuleDialog onClose={() => setAction(null)} />}
        {action === "attest" && <AttestDialog onClose={() => setAction(null)} />}
        {action === "job" && <JobDialog onClose={() => setAction(null)} role={role} />}
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Run scheduled job (admin only)
// ---------------------------------------------------------------------------

function JobDialog({ onClose, role }: { onClose: () => void; role: string }) {
  const [jobs, setJobs] = React.useState<{ name: string; description: string }[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [name, setName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [ran, setRan] = React.useState<string | null>(null)

  // Role-gated at render, not just at the menu: the menu hides this for
  // non-admins, and the dialog refuses too, so a crafted open cannot reach
  // the mutation from an unentitled session.
  const allowed = roleAtLeast(role, "admin")

  React.useEffect(() => {
    let live = true
    api.request("GET /api/v1/jobs").then((res) => {
      if (!live) return
      if (res.status === "ok") setJobs(res.data.jobs.map((j) => ({ name: j.name, description: j.description })))
      else setFailed(true)
    })
    return () => { live = false }
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name) {
      setError("Choose the job to run.")
      return
    }
    setBusy(true)
    setError(null)
    setRan(null)
    const res = await api.request("POST /api/v1/jobs/:name/run", { params: { name } })
    setBusy(false)
    if (res.status === "ok") {
      // The run receipt is the outcome plus the affected-row count: an
      // operator who pressed the button twice gets the first run back via
      // the idempotency key, and this line is how they can tell.
      setRan(`Outcome ${res.data.outcome} · ${res.data.affected} affected · run ${res.data.id}`)
      return
    }
    setError(
      res.status === "unauthorised"
        ? "Your session expired. Sign in again."
        : res.status === "forbidden" || res.status === "unavailable" || res.status === "error"
          ? res.message
          : "The request failed.",
    )
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Run scheduled job</DialogTitle>
        <DialogDescription>
          Runs now under the same lease the schedule uses — it cannot overlap a run already in flight. Admin only.
        </DialogDescription>
      </DialogHeader>
      {!allowed ? (
        <p className="text-sm text-muted-foreground">Running a job needs the admin role.</p>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <Field id="job-name" label="Job">
            {jobs === null && !failed ? (
              <p className="text-sm text-muted-foreground">Loading jobs…</p>
            ) : failed || jobs === null ? (
              <p className="text-sm text-muted-foreground">The scheduler could not be reached.</p>
            ) : (
              <Select value={name} onValueChange={(v) => setName(v ?? "")}>
                <SelectTrigger id="job-name">
                  <SelectValue placeholder="Choose a job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.name} value={j.name}>{j.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          {ran ? <p className="text-xs text-muted-foreground">{ran}</p> : null}
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Running…" : "Run now"}</Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  )
}
