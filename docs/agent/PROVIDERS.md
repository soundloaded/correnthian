# PROVIDERS

**Nothing is contracted. Nothing is integrated. Nothing can execute.**

This is the most important fact about Correnthian's backend, and it is
deliberate. Every module that would need a provider refuses rather than
fabricating, because a plausible-looking rate is a lie a user could act on.

Verified against the repository at `2be6499`.

---

## 1. Why nothing is contracted yet

The metals issuer / LP partnership has a multi-month lead time and is the
project's critical path. Design spec §3:

> The licensed metals provider is the primary rail and a launch dependency. The
> partner contract has a multi-month lead time and is the project's critical
> path. Nothing else in this project may be late; that may.

It has not been started.

---

## 2. The registry

`services/api/src/providers/providers.service.ts`, over the `Provider` model.

| Column | Purpose |
|---|---|
| `slug` | `@unique`. The identifier everything else references. |
| `name` | Display. |
| `category` | `ProviderCategory` |
| `status` | `active` / `degraded` / `disabled`. Default **`disabled`**. |
| `capabilities` | `String[]`, e.g. `["buy","sell","quote"]` |
| `lastHealth` | `Json?` — a health probe payload, **never credentials** |
| `lastCheckedAt` | `DateTime?` |
| `notes` | Free text |
| `_count` | Quotes and redemptions |

### `ProviderCategory`

`metals` · `onramp` · `offramp` · `rpc` · `pricing` · `kyc` · `sanctions` ·
`indexer`

**Six of these eight have no code behind them.** Only `metals`, `onramp` and
`offramp` are queried, and only by `OnRampService`.

### Routes

| Route | Method | Min role |
|---|---|---|
| `GET /providers` | list, filterable by `category` | any session |
| `GET /providers/health` | counts by status plus per-provider summary | any session |
| `GET /providers/:slug` | detail | any session |
| `PATCH /providers/:slug/status` | `{ active, degraded, disabled }` | **admin** |

`setStatus` and `recordHealth` both stamp `lastCheckedAt`. Both write audit
entries through the global interceptor.

### What is seeded

`services/api/prisma/seed.ts`:

```ts
{ slug: 'placeholder-metals', name: 'Metals provider (not selected)', category: 'metals', capabilities: [] }
{ slug: 'placeholder-onramp',  name: 'Fiat on-ramp (not selected)',   category: 'onramp',  capabilities: [] }
```

Both `status: 'disabled'`, both noted "Placeholder. Replace once a provider is
contracted."

**A provider becomes active only when a human has completed due diligence and
signed a contract.** The seed's own comment says so.

---

## 3. Credentials — the rule, and where it lives

`ProvidersService` carries this comment on `setStatus`:

> Only `lastHealth` — a health probe payload — is stored. Provider API
> credentials live in the infrastructure secret store and are never written
> here. This table must never become a place secrets land.

It is enforced structurally: **the `Provider` model has no credential field at
all.** There is nothing to write one into. Adding one would require a schema
change and should be treated as a boundary break.

`.env.example` names the variables a future integration would read:

```
METALS_PROVIDER_API_KEY, METALS_PROVIDER_API_URL, METALS_PROVIDER_SANDBOX
ONRAMP_PROVIDER_API_KEY, ONRAMP_PROVIDER_SANDBOX
PRICE_FEED_API_KEY, METAL_SPOT_FEED_API_KEY
RPC_ETHEREUM_MAINNET / _SEPOLIA / RPC_BASE_MAINNET / _SEPOLIA
BUNDLER_RPC_URL, PAYMASTER_RPC_URL
```

**None of them is read by any code.** They are placeholders for an integration
that does not exist. `@correnthian/config` has no schema field for any of them —
deliberately, since the config package exists partly to refuse key material.

The `sandbox` flag is the right shape: staging must never reach a production
provider by configuration accident.

---

## 4. Health

`services/api/src/providers/providers.service.ts`.

### What exists

- `recordHealth(slug, health)` — stores an arbitrary JSON probe payload and
  stamps `lastCheckedAt`.
- `healthSummary()` — counts by status, plus a per-provider list of
  `{ slug, name, category, status, lastCheckedAt }`.
- `GET /providers/health` exposes it.

### What does not exist

**A prober.** Nothing calls `recordHealth`. No scheduled job, no webhook, no
on-demand probe. Every provider's `lastCheckedAt` is `null` in a fresh database.

The admin renders "never checked" as a **destructive** badge rather than
grey — precisely because a provider whose health nobody has established is a
state an operator must act on.

`ProviderStatus` has `active` / `degraded` / `disabled`, but `degraded` is only
ever set by a human via `PATCH /providers/:slug/status`. Nothing detects
degradation.

**`BE-1002` is `PARTIAL` for this reason.**

### Chain health is a separate mechanism

`BlockchainService.health()` probes per-chain reachability through
`EvmAdapter.isHealthy()`, which asks each RPC endpoint for a block number and
counts the answers. A chain with no endpoints is reported `healthy: false`,
rather than a status being invented for a chain that was never configured.

---

## 5. Where providers are *not* used

This is the honest inventory. In every case below, the code refuses.

### `OnRampService` — `services/api/src/onramp/onramp.service.ts`

`activeProvider(category, country, region)` finds providers with
`status: 'active'` in the category, ordered by name, and skips any blocked in
the user's jurisdiction.

`unavailability(kind, country, region)` returns `{ available, reason }` — a
**self-describing object**, not a bare string or `null`, because neither of
those says what it means and the empty body was unparseable as JSON.

`quote(kind, params)` validates the amount, resolves the provider, checks the
asset exists and is enabled — and then:

```ts
// Unreachable until a provider is contracted. Kept explicit so the
// failure is a refusal, not a plausible-looking rate.
throw AppError.providerUnavailable(`Provider ${provider.slug} has no rate for this pair yet.`);
```

Six tests, including one asserting it refuses rather than inventing a rate.

**Off-ramp:** `unavailability` supports `sell`, and `GET /onramp/availability`
accepts `direction=sell`. But `OnRampController.quote` hardcodes `'buy'`, so an
off-ramp **quote** is unreachable.

### `SwapsService` — `services/api/src/swaps/swaps.service.ts`

`createQuote` hardcodes `railKind: 'provider'`, `railId: 'unassigned'`,
`executionQuality: 'none'`, `toAmountRaw: '0'`, `minReceivedRaw: '0'`, and a
single fee line of `{ label: 'Correnthian fee', amountUsd: 0 }`.

`executable` is computed as `executionQuality !== 'none' && toAmountRaw > 0` —
so it is `false` for **every quote the system can currently produce**. The
honest-failure design is intact; there is simply nothing behind it.

There is no `SwapRail` implementation. `selectRail` and `RAIL_PREFERENCE` in
`packages/swaps` are exercised only by tests. `SwapsService` injects
`ProvidersService` and never uses it (`DEF-017`) — a hint that rail binding was
intended here.

### `PricingService` — `services/api/src/pricing/pricing.service.ts`

`quote()` returns `referencePriceUsd` and `executablePriceUsd: null` with:

> No executable price: no metals provider is contracted. The reference price is
> not obtainable.

`POST /pricing/record` (`support`) accepts `{ assetId, priceUsd, source }`. **No
code calls it.** A fresh database has an empty `AssetPrice` table, which is why
every portfolio holding reads as unpriced.

### `RedemptionService` — `services/api/src/metals/redemption.service.ts`

Refuses when the provider is unknown or `disabled`. In the seeded local
environment **every** redemption is refused twice over: the providers are
`disabled`, and the development jurisdiction rule sets `canRedeem: false`.

### `JurisdictionService`

`JurisdictionRule.blockedProviders` is a `String[]` of provider slugs.
`isProviderBlocked()` is implemented and tested. No rule in any environment
currently blocks anything.

---

## 6. `packages/integrations`

**Empty.** `packages/integrations/src/index.ts` is `export {}`.

The design intent was that per-provider adapters live here, receive credentials
through an injected interface rather than through the environment, and that
`services/api` reaches them only through `providers`. None of that structure
exists yet. It should be built when there is a real contract to build it
against — an adapter written against an imagined API is an adapter that gets
rewritten.

---

## 7. Adding the first real provider

The order matters, and none of it is a code-only decision.

1. **Contract and due diligence first.** Kinesis / PAXG / XAUT specifics were
   researched under degraded conditions and are **unverified** — do not write
   them into code or documentation as fact.
2. **Replace the placeholder row** with a real provider, `status: 'active'`,
   with `capabilities` filled in. Delete the placeholder.
3. **Build the adapter in `packages/integrations`.** Credentials injected, not
   read from `process.env` inside the adapter.
4. **Implement the `SwapRail` for the primary rail** — `provider` kind, with
   honest `sizeCapUsd` and `executionQuality`. `RAIL_PREFERENCE` already puts it
   above `dex`.
5. **Add the executable price** so `PricingService.quote` stops returning null.
6. **Register the response contract** in `CONTRACT_REGISTRY`. No mutating route
   currently has one — see [`API_CONTRACTS.md`](API_CONTRACTS.md).
7. **Add health probing**, so `degraded` is detected rather than set by hand.
8. **Only then** enable buy, sell, quote and redeem in the registry, and remove
   the refusals.

Steps 2 through 8 are mechanical. Step 1 is the project.

---

## 8. Security requirements for any provider work

- **A provider must never hold a Correnthian-held user key.** Delivery target is
  an address the user controls — for smart accounts, a CREATE2-derived address
  that may not be deployed yet. That last question is unresolved and is a live
  integration question for the unsigned partner.
- **Credentials never enter the database.** The model has no field for them and
  should not gain one.
- **No credential in any log, audit entry or API response.** `Provider` is
  rendered in the admin as status and health only.
- **A disabled provider must never fill.** `RedemptionService` enforces this.
  `OnRampService` filters on `status: 'active'`. `SwapsService` does not check
  provider status at all, because it does not resolve a provider.
- **Sandbox in non-production, always.** The `*_SANDBOX` flags in
  `.env.example` exist for this; nothing reads them yet.