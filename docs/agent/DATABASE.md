# DATABASE

PostgreSQL via Prisma 7.10.0, driven by `services/api/prisma/schema.prisma`.
System of record. Redis is a cache and a rate-limit counter and is never a
source of truth.

Verified against the repository at `2be6499`.

---

## 1. The security invariant

`services/api/prisma/schema.prisma` opens with this, and it is the single most
important comment in the repository:

> This schema MUST NOT acquire a column capable of holding a seed phrase,
> private key, signing share, or any other material that could move user funds.
> Correnthian's security model is that the user's keys never reach our
> infrastructure. That property is only as strong as this file.
>
> A `Wallet` here is a *registered public address*. It is a watch-list entry
> that lets us index a portfolio and attribute activity. It is not a custody
> record. If you find yourself wanting to add a key field, you are about to
> convert Correnthian from a non-custodial wallet into a custodian, with the
> licensing, insurance and breach consequences that follow.
>
> Security baseline: OWASP MASVS / MASTG.

Two rules an agent must not break:

1. **No column capable of holding key material.** Not encrypted, not hashed,
   not "temporarily for migration".
2. **`Wallet.address` is a public address.** It is lower-cased for EVM storage
   and is not a secret. `Wallet.guardians` is a `String[]` of **public**
   guardian addresses.

The same rule is restated in `services/api/src/wallets/wallets.service.ts`,
which validates every address on the way in and refuses guardians on a seed
account because it has no contract to hold them.

---

## 2. Models — 19

> The root `TASK.md` said "18 models, 15 enums". The schema has **19 and 19**.
> Counted: `grep -c '^model '` and `grep -c '^enum '`.

### Identity

| Model | Purpose | Notes |
|---|---|---|
| `User` | Server-side account | `passwordDigest` is **nullable** because magic-link accounts have none and that is the target UX. Never holds key material. |
| `Session` | Bearer token | Stores `tokenHash` (SHA-256) only. The raw token is never persisted. `revokedAt` for revocation. |
| `Device` | A listed device | `publicKey` is a **passkey public key**. Revocation is soft so the audit trail survives. |
| `KycProfile` | KYC record | `providerRef` is an opaque pointer. Identity documents and biometric data are never stored — stated in the field comment. **No code path creates a row.** |

### Wallets — public addresses only

| Model | Purpose |
|---|---|
| `Wallet` | Registered address, chain, `kind` (`smart`/`seed`), `deployed`, `guardians`, `isPrimary`. `@@unique([chainId, address])`. |
| `WalletAccount` | Balance for one `(wallet, asset)`. `balanceRaw` is a **string**, never a float. `@@unique([walletId, assetId])`. |

### Registry

| Model | Purpose | Notes |
|---|---|---|
| `Issuer` | The entity behind a token | `verifiedTier` propagates to its assets. Licence types and refs are `String[]`. |
| `Asset` | The registry row | **This is the product.** See §5. |
| `Chain` | Chain configuration | `rpcUrls String[]` — never returned by any API route (ADR-018). |

### Providers and rails

| Model | Purpose |
|---|---|
| `Provider` | Registry entry. `lastHealth Json` holds a probe payload. **No credential field exists.** |
| `SwapQuote` | A quote and its disclosure. `fees Json`, `executionQuality`, `sizeCapUsd` are mandatory. |

### Activity

| Model | Purpose | State |
|---|---|---|
| `Transaction` | Chain activity | **Nothing ever writes to it.** `@@unique([chainId, txHash])`. |
| `PortfolioSnapshot` | Valuation history | Written only by `POST /portfolio/wallets/:walletId/snapshot`. |
| `AssetPrice` | Price points with a mandatory `source` | **Nothing records a price automatically.** |

### Metals, compliance, operations

| Model | Purpose |
|---|---|
| `RedemptionRequest` | Physical redemption, explicit state machine, `serialNumbers` (never written). |
| `JurisdictionRule` | `(country, region)` → permissions. `region` is `''` for country-wide. `@@unique([country, region])`. |
| `AuditLog` | Append-only trail. `actorId` is a plain string, **not a relation**, which is why the API resolves emails in a batched second query. |
| `Notification` | Queued intent. **Never sent.** |
| `FeatureFlag` | `key`, `enabled`, `rollout`, `description`. **Nothing reads or writes it.** |

---

## 3. Enums — 19

`ChainFamily`, `AccountKind`, `UserRole`, `DevicePlatform`, `KycStatus`,
`AssetCategory`, `TokenStandard`, `CustodyModel`, `VerifiedTier`,
`AttestationCadence`, `RailKind`, `ProviderStatus`, `ProviderCategory`,
`QuoteState`, `ExecutionQuality`, `TxState`, `TxDirection`, `RedemptionState`,
`AuditOutcome`.

### Prisma enums are not domain values

Prisma uses snake_case; `packages/types` uses kebab-case, and the domain adds a
`metal` token standard with no database equivalent.
`services/api/src/assets/assets.mapper.ts` maps in one place and is typed
against the Prisma enum, so an unrecognised trust tier becomes a type error
rather than silently "verified" upstream. Five tests cover the mapping.

### `UserRole` hierarchy

`user` < `support` < `compliance` < `admin` < `owner`, enforced by
`RolesGuard`. A role not in the map ranks `-1`; a requirement not in the map
ranks `Infinity`, so an unknown requirement is unsatisfiable. Fail-closed by
construction.

---

## 4. Migrations

Two. The second is hand-written and is the reason this section exists.

### `20261005142627_init`

Generated. 583 lines — 19 enums, 19 tables, indexes, unique constraints,
foreign keys with `onDelete: Cascade` on user-owned relations.

### `20261005150000_non_nullable_compound_uniques`

**Hand-written.** Its own comment explains why:

> Two latent integrity problems, both invisible to `prisma migrate dev`:
>
> 1. Prisma cannot target a nullable column in a compound unique selector, so
>    `upsert`/`findUnique` on (country, region) and
>    (chainId, contractAddress, issuerId) were both unusable at runtime.
>
> 2. Postgres treats NULLs as distinct in a unique index, so two native assets
>    for the same chain and issuer would both insertable. That is a uniqueness
>    hole in the registry — the one table where a duplicate means a user sees
>    the wrong backing.
>
> Empty string is the sentinel for "does not apply": country-wide rule,
> native asset.

It backfills `NULL` to `''`, sets the default, then sets `NOT NULL` on
`JurisdictionRule.region` and `Asset.contractAddress`.

### Why hand-written, and why it matters operationally

`prisma migrate dev` reported no drift, so a generated migration would have
been a no-op — and a fresh database created from migrations alone would have
been **structurally different from local**. Any environment provisioned fresh
would have carried the uniqueness hole.

**Never run `migrate dev` against a shared or production database.** Use
`pnpm migrate:deploy` (`prisma migrate deploy`). Recorded in
[`../operations/production-database.md`](../operations/production-database.md).

### DEF-003 — the schema file has drifted · `DONE` (`7ad3d69`)

> **Closed 2026-10-07.** `schema.prisma` now declares both as
> `String @default("")`, and `prisma migrate diff` between the schema and the
> datasource reports *No difference detected*. `prisma migrate status` reports
> 7 migrations applied. The description below is what was wrong, kept for the
> record — the two line numbers no longer point at nullable columns.

`services/api/prisma/schema.prisma` declared both columns nullable:

- `services/api/prisma/schema.prisma:369` — `contractAddress String?`
- `services/api/prisma/schema.prisma:637` — `region String?`

The **code** matches the database (`services/api/src/assets/assets.mapper.ts` does
`row.contractAddress || null`; `services/api/src/blockchain/indexing.service.ts` selects native assets by
`contractAddress: ''`; `JurisdictionService` looks up `region: ''`). The
**schema file** does not. `prisma migrate dev` will now generate a migration
reverting both to nullable, reintroducing the hole.

The fix landed in `7ad3d69`. **`migrate dev` against a shared or production
database remains forbidden regardless** — that rule stands on its own and is
repeated above.

---

## 5. `Asset` — the table that is the product

```
Asset.assetId   @unique   "${chainId}:${contract|native}:${issuerId}", derived
                @@unique([chainId, contractAddress, issuerId])
```

Identity is the triple, never a symbol. USDT on Ethereum, BNB, Polygon, Tron
and Solana are five assets. See ADR-004.

### Backing — why these columns exist

| Column | Type | Why |
|---|---|---|
| `custodyModel` | `CustodyModel` | `allocated` / `unallocated` / `synthetic`. The first honest question about a metal token. |
| `custodian` | `String?` | Who holds it. |
| `vaultLocations` | `String[]` | Where. |
| `proofOfReserveUrl` | `String?` | The claim, linkable. |
| `attestationCadence` | `AttestationCadence` | `monthly`/`quarterly`/`annual`/`none`. |
| `lastAttestedAt` | `DateTime?` | When it was last checked. `null` means never — and the admin renders that as a **badge**, not grey text. |
| `gramsPerToken` | `Decimal(18,6)?` | Exact decimal, not float. |
| `ouncesPerToken` | `Decimal(18,8)?` | Troy ounces. |

These are not metadata. Without them the UI cannot produce the sentence that is
Correnthian's entire differentiation. `describeBacking()` in `packages/assets`
turns them into that sentence, and it can never present a synthetic token as
metal — covered by tests.

### Numeric discipline

- Balances: `String` base units. `WalletAccount.balanceRaw`.
- Money: `Decimal(36, 8)` for USD notional and values, `Decimal(36, 18)` for
  per-unit prices and gas, `Decimal(36, 2)` for size caps.
- `gramsPerToken` / `ouncesPerToken`: `Decimal(18, 6)` / `Decimal(18, 8)`.
- The API converts `Decimal` to `number` only at the wire boundary, in the
  projections, and only where the client needs to format without a decimal
  library.

**One violation:** `PortfolioService.forWallet` does
`Number(a.balanceRaw) / 10 ** a.asset.decimals` — a float divide — directly
under a comment saying it will not. Tracked as `DEF-008`.

---

## 6. Surrogate vs domain ids — the trap that already bit once

Two things are called `assetId`:

| | What | Where |
|---|---|---|
| **Domain** | `${chainId}:${contract\|native}:${issuerId}` | `Asset.assetId`, unique |
| **Surrogate** | cuid, the primary key | `Asset.id`, referenced by every FK |

Foreign keys named `assetId`: `WalletAccount.assetId`, `Transaction.assetId`,
`AssetPrice.assetId`, `RedemptionRequest.assetId`.
Relation-valued on `SwapQuote`: `fromAssetId`, `toAssetId` — these are
`Asset.id`.

Mixing them fails **silently**: the query returns an empty set and every holding
reads as unpriced at zero, which looks plausible rather than broken. It cost a
full day in commit `ce5a4a9`. Both `PricingService.latestMap` and
`PortfolioService.forWallet` now carry a comment naming which they take, and a
test pins the map's key to the id it was given.

---

## 7. Prisma client and connection

- Generator `prisma-client` (the new ESM client), output
  `src/generated/prisma`, **committed**. Regenerate with
  `pnpm --filter @correnthian/api exec prisma generate`.
- Prisma 7 moved the connection string out of `services/api/prisma/schema.prisma` into
  `services/api/prisma.config.ts` and requires an explicit driver adapter.
  `PrismaService` and `services/api/prisma/seed.ts` both construct `new PrismaPg({ connectionString })`.
- `PrismaService` has `isHealthy()` for the readiness probe but **no
  `$disconnect()` on module destroy**. Verify before relying on graceful
  shutdown in production.

### The types do not catch bad field names

Verified by probe: `tsc --noEmit` accepts a wholly fictional field inside
`prisma.<model>.update({ data })`. Prisma's generated input types are
`Prisma.XOR<...>` unions, which defeat TypeScript's excess-property check.

**Any typo in any Prisma write is invisible to the compiler** and surfaces only
at runtime as a `PrismaClientValidationError`, which `AllExceptionsFilter`
maps to a 500. `DEF-002` is a live instance of this.

---

## 8. Local and production

**Local:** `infrastructure/docker/compose.yml`. Postgres 17 and Redis 7, host
ports **5433 and 6380** (5432 is taken by another project's container).
`POSTGRES_INITDB_ARGS: "--locale=C --encoding=UTF8"` — C collation keeps index
behaviour identical across developer machines and CI, and deterministic
ordering matters for the asset registry.

```bash
pnpm db:up        # start
pnpm db:reset     # down -v && up
pnpm migrate      # prisma migrate dev  — local only
pnpm migrate:deploy
pnpm seed
```

**Production:** Neon (Postgres). **Not provisioned.** The repository has no
remote and Neon provisioning is blocked on the account owner.

### The development seed

`services/api/prisma/seed.ts`, deliberately small:

- **Chains:** Ethereum (1), Base (8453), Sepolia (11155111, disabled). Chain
  ids are public facts.
- **Providers:** `placeholder-metals` and `placeholder-onramp`, both
  `disabled`, both with **no capabilities**, both noted "Placeholder. Replace
  once a provider is contracted."
- **Jurisdiction:** one `US` rule marked `DEVELOPMENT ONLY`. Permits
  buy/sell/metals, **refuses redemption**.
- **Admin:** only if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set. Minimum length
  is `ADMIN_PASSWORD_MIN_LENGTH`, default 12, floor 8.

**It does not seed any metals asset.** An unverified row in the registry is
indistinguishable from a verified one once it reaches a user, and that is the
failure this product exists to prevent. Real assets are added through the API,
by a human, from due diligence.

The consequence: **the local database has no assets and no prices.** The
contract suite refuses to run without at least two seeded assets, and the
portfolio reads every holding as unpriced.

---

## 9. Redis

`services/api/src/redis/redis.service.ts`. Ping-based `isHealthy()`, connect on
`onModuleInit`, quit on `onModuleDestroy`. `raw` throws if not ready, so a
caller cannot silently operate on a dead client.

Used for exactly one thing today: rate-limit counters
(`correnthian:rate:<bucket>:<actor>`, 60-second TTL).

**It is a cache and a counter. It must never be the source of truth** for
anything a customer would notice losing. Local compose runs it with
`--appendonly yes`, `maxmemory 256mb`, `allkeys-lru` — cache entries are
disposable, so evict rather than fail writes.

There is **no queue**, no worker and no scheduler. `BE-004` is `PARTIAL`
because of this.