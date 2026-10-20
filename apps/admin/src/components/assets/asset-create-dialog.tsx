"use client"

import * as React from "react"

import { PlusIcon } from "lucide-react"

import { api } from "@/lib/api"
import type { ApiResult, Contract } from "@correnthian/api-client"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@correnthian/ui/components/select"
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

import {
  ASSET_ATTESTATION_CADENCE_OPTIONS,
  ASSET_CATEGORY_OPTIONS,
  ASSET_CUSTODY_MODEL_OPTIONS,
  ASSET_RAIL_OPTIONS,
  ASSET_TIER_OPTIONS,
  ASSET_TOKEN_STANDARD_OPTIONS,
  buildAssetCreateBody,
} from "./asset-create-body"
import type { AssetCreateBody, AssetCreateForm } from "./asset-create-body"

type ChainRow = Contract<"GET /api/v1/chains">[number]
type IssuerRow = Contract<"GET /api/v1/issuers">[number]

const EMPTY_FORM: AssetCreateForm = {
  chainId: "",
  contractAddress: "",
  tokenStandard: "erc20",
  symbol: "",
  name: "",
  decimals: "18",
  category: "metal",
  issuerId: "",
  custodyModel: "allocated",
  custodian: "",
  vaultLocations: "",
  proofOfReserveUrl: "",
  attestationCadence: "none",
  ouncesPerToken: "",
  gramsPerToken: "",
  rails: [],
  swapSupported: false,
  redeemSupported: false,
  verifiedTier: "unverified",
  accentColor: "",
  iconUrl: "",
}

// Registration is compliance-only server-side. The gate here is display-only
// — RolesGuard decides — but an operator below compliance is told why
// instead of being shown a button that will only bounce. Errors render
// inline, never as a toast: a registry change that silently disappears is
// indistinguishable from one that never happened.
export function AssetCreateDialog({ onCreated }: { onCreated: () => void }) {
  const sessionRole = getSession()?.role ?? "user"
  const canCreate = rankAtLeast(sessionRole, "compliance")

  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<AssetCreateForm>(EMPTY_FORM)
  const [chains, setChains] = React.useState<ChainRow[]>([])
  const [issuers, setIssuers] = React.useState<IssuerRow[]>([])
  const [pending, setPending] = React.useState<AssetCreateBody | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  // The chain and issuer lists are fetched when the dialog opens, not on
  // page load: the registry page should not pay for two extra requests
  // because a button exists.
  React.useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void (async () => {
      const [chainResult, issuerResult] = await Promise.all([
        api.request("GET /api/v1/chains"),
        api.request("GET /api/v1/issuers"),
      ])
      if (controller.signal.aborted) return
      if (chainResult.status === "ok") setChains(chainResult.data)
      if (issuerResult.status === "ok") setIssuers(issuerResult.data)
    })()
    return () => controller.abort()
  }, [open])

  if (!canCreate) {
    return (
      <p className="max-w-sm text-sm text-muted-foreground">
        Registering an asset needs the compliance role. Your session is{" "}
        {sessionRole}, so this registry is read-only for you.
      </p>
    )
  }

  const set = (patch: Partial<AssetCreateForm>) =>
    setForm((current) => ({ ...current, ...patch }))

  const close = () => {
    setOpen(false)
    setError(null)
    setPending(null)
    setForm(EMPTY_FORM)
  }

  const requestCreate = (event: React.FormEvent) => {
    event.preventDefault()
    const built = buildAssetCreateBody(form)
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
    const result = await api.request("POST /api/v1/assets", {
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
        Register asset
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Register an asset</DialogTitle>
            <DialogDescription>
              The asset id is derived by the API from chain, contract address
              and issuer — it is never accepted from here. A new asset is
              created unverified unless you say otherwise below.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={requestCreate} className="grid gap-4">
            <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1">
              <div className="grid gap-1.5">
                <Label htmlFor="asset-chain">Chain</Label>
                <Select
                  value={form.chainId || null}
                  onValueChange={(value) => {
                    if (!value) return
                    const chain = chains.find((row) => row.id === value)
                    set({ chainId: value, decimals: String(chain?.decimals ?? 18) })
                  }}
                >
                  <SelectTrigger id="asset-chain" className="w-full">
                    <SelectValue placeholder="Choose a configured chain" />
                  </SelectTrigger>
                  <SelectContent>
                    {chains.map((chain) => (
                      <SelectItem key={chain.id} value={chain.id}>
                        {chain.name} ({chain.id})
                        {chain.isTestnet ? " · testnet" : ""}
                        {chain.enabled ? "" : " · disabled"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="asset-issuer">Issuer</Label>
                <Select
                  value={form.issuerId || null}
                  onValueChange={(value) => {
                    if (value) set({ issuerId: value })
                  }}
                >
                  <SelectTrigger id="asset-issuer" className="w-full">
                    <SelectValue placeholder="Choose the issuer that backs this token" />
                  </SelectTrigger>
                  <SelectContent>
                    {issuers.map((issuer) => (
                      <SelectItem key={issuer.slug} value={issuer.slug}>
                        {issuer.name} ({issuer.slug})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issuers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No issuers are registered yet — the API refuses an asset
                    whose issuer does not exist.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-symbol">Symbol</Label>
                  <Input
                    id="asset-symbol"
                    value={form.symbol}
                    onChange={(e) => set({ symbol: e.target.value })}
                    placeholder="XAU"
                    maxLength={16}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-name">Name</Label>
                  <Input
                    id="asset-name"
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="Tokenised gold"
                    maxLength={120}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-decimals">Decimals</Label>
                  <Input
                    id="asset-decimals"
                    value={form.decimals}
                    onChange={(e) => set({ decimals: e.target.value })}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-category">Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) => {
                      if (value) set({ category: value })
                    }}
                  >
                    <SelectTrigger id="asset-category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-token-standard">Token standard</Label>
                  <Select
                    value={form.tokenStandard}
                    onValueChange={(value) => {
                      if (value) set({ tokenStandard: value })
                    }}
                  >
                    <SelectTrigger id="asset-token-standard" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_TOKEN_STANDARD_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-custody">Custody model</Label>
                  <Select
                    value={form.custodyModel}
                    onValueChange={(value) => {
                      if (value) set({ custodyModel: value })
                    }}
                  >
                    <SelectTrigger id="asset-custody" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_CUSTODY_MODEL_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Allocated, unallocated and synthetic are three different
                    promises; the disclosure text says which one this is.
                  </p>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="asset-contract">Contract address</Label>
                <Input
                  id="asset-contract"
                  value={form.contractAddress}
                  onChange={(e) => set({ contractAddress: e.target.value })}
                  placeholder="leave empty for a native asset"
                  maxLength={128}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-custodian">Custodian</Label>
                  <Input
                    id="asset-custodian"
                    value={form.custodian}
                    onChange={(e) => set({ custodian: e.target.value })}
                    placeholder="who holds the metal"
                    maxLength={160}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-vaults">Vault locations</Label>
                  <Input
                    id="asset-vaults"
                    value={form.vaultLocations}
                    onChange={(e) => set({ vaultLocations: e.target.value })}
                    placeholder="comma-separated"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-por">Proof of reserves</Label>
                  <Input
                    id="asset-por"
                    value={form.proofOfReserveUrl}
                    onChange={(e) => set({ proofOfReserveUrl: e.target.value })}
                    placeholder="https://…"
                    maxLength={500}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-cadence">Attestation cadence</Label>
                  <Select
                    value={form.attestationCadence}
                    onValueChange={(value) => {
                      if (value) set({ attestationCadence: value })
                    }}
                  >
                    <SelectTrigger id="asset-cadence" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_ATTESTATION_CADENCE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-ounces">Ounces per token</Label>
                  <Input
                    id="asset-ounces"
                    value={form.ouncesPerToken}
                    onChange={(e) => set({ ouncesPerToken: e.target.value })}
                    inputMode="decimal"
                    placeholder="troy ounces"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-grams">Grams per token</Label>
                  <Input
                    id="asset-grams"
                    value={form.gramsPerToken}
                    onChange={(e) => set({ gramsPerToken: e.target.value })}
                    inputMode="decimal"
                    placeholder="grams"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Rails</Label>
                <div className="flex flex-wrap gap-4">
                  {ASSET_RAIL_OPTIONS.map((rail) => (
                    <label key={rail} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.rails.includes(rail)}
                        onChange={(e) =>
                          set({
                            rails: e.target.checked
                              ? [...form.rails, rail]
                              : form.rails.filter((entry) => entry !== rail),
                          })
                        }
                        className="size-4 accent-current"
                      />
                      {rail}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                {(
                  [
                    ["swapSupported", "Swap supported"],
                    ["redeemSupported", "Redeem supported"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) => set({ [key]: e.target.checked })}
                      className="size-4 accent-current"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-tier">Verification tier</Label>
                  <Select
                    value={form.verifiedTier}
                    onValueChange={(value) => {
                      if (value) set({ verifiedTier: value })
                    }}
                  >
                    <SelectTrigger id="asset-tier" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_TIER_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The issuer&apos;s tier is the usual source. Setting a tier
                    here records it as given.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="asset-accent">Accent colour</Label>
                  <Input
                    id="asset-accent"
                    value={form.accentColor}
                    onChange={(e) => set({ accentColor: e.target.value })}
                    placeholder="#c9a227"
                    maxLength={32}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="asset-icon">Icon URL</Label>
                <Input
                  id="asset-icon"
                  value={form.iconUrl}
                  onChange={(e) => set({ iconUrl: e.target.value })}
                  placeholder="https://…"
                  maxLength={500}
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
                {saving ? "Registering…" : "Register asset"}
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
              Register {pending?.symbol} in the registry?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? `A new token: ${pending.name} (${pending.symbol}) on chain ${pending.chainId}, backed by issuer ${pending.issuerId}, custody model ${pending.custodyModel}, category ${pending.category}. The API derives the asset id from chain, contract address and issuer, so the same three cannot be registered twice.`
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
