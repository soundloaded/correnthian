# ARCHITECTURE

How Correnthian is put together, verified against the repository at `2be6499`.

For *why* it is this way, see [`DECISIONS.md`](DECISIONS.md). For *what*
Correnthian is, see [`MASTER_CONTEXT.md`](MASTER_CONTEXT.md).

---

## 1. The shape

```
                         USER DEVICE (never Correnthian's)
                         ┌───────────────────────────────────┐
                         │  private key / seed              │
                         │  wallet-core: derive, sign       │
                         └──────────────┬────────────────────┘
                                        │ signed tx
                                        ▼
┌──────────────────┐        ┌───────────────────────┐
│  apps/web        │        │  networks (EVM)       │
│  apps/mobile     │───────►│  Ethereum, Base       │
│  (create-next-app│  signed│                       │
│   / Expo default)│  tx    │  via packages/        │
└──────────────────┘        │  blockchain EvmAdapter│
                            └───────────▲───────────┘
                                        │ public reads only
┌──────────────────────────────────────┴──────────────────────────────┐
│                         services/api  (NestJS)                      │
│                                                                      │
│  controllers ──guards──► services ──► Prisma ──► PostgreSQL          │
│                  │                    └──► Redis (rate limits only)  │
│                  └──► AuditInterceptor ──► audit.log                 │
│                                                                      │
│  packages/contracts  ── Zod schemas, both directions                 │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ HTTP + bearer token (httpOnly cookie)
                                   ▼
                        ┌──────────────────────────┐
                        │  apps/admin              │
                        │  Next.js 16 + shadcn     │
                        │  9 routes, server-rendered│
                        └──────────────────────────┘
```

## 2. The key boundary diagram

This is the one diagram in the repository that matters.

```
  ┌─────────────────────────────────────────────────────────────────┐
  │  USER DEVICE                                                    │
  │                                                                 │
  │   private key / seed ──► local signing ──► signed tx           │
  │                                                                 │
  └──────────────────────────────┬──────────────────────────────────┘
                                 ╎
                                 ╎   NEVER crosses this line
                                 ╎
  ┌──────────────────────────────┴──────────────────────────────────┐
  │  CORRENTHIAN INFRASTRUCTURE                                     │
  │                                                                 │
  │   Correnthian Account   profile, devices, prefs, sessions       │
  │   Wallet record         PUBLIC ADDRESS ONLY (watch list)        │
  │   provider adapters     no key material reaches here            │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

Enforcement is structural, not procedural:

- `packages/wallet-core/package.json` declares one dependency:
  `@correnthian/types`. No runtime dependency at all.
- `scripts/check-key-boundary.mjs` walks the **transitive** workspace
  dependency closure from `packages/wallet-core` and fails on any transport
  (`axios`, `undici`, `ws`), chain SDK (`viem`, `ethers`, `bitcoinjs-lib`),
  UI framework (`react`, `next`, `expo`), or server framework.
- CI job `key-boundary` (displayed as **Static guards**) in
  `.github/workflows/ci.yml` runs it alongside `check-explicit-di.mjs` and
  `check-prisma-writes.mjs`. The job id is kept because it is what the
  documentation and any status check refer to; the display name says what it
  now does.

**Two things share the word "account", and conflating them is a security bug:**

| | Correnthian Account | Key Container |
|---|---|---|
| Where | Postgres (`User`, `Session`, `Device`) | `packages/wallet-core`, device-side |
| Holds keys | Never | Yes |
| Types | `CorrenthianAccount` in `packages/types/src/account.ts` | `KeyContainer`, `SmartAccountManager`, `SeedAccountManager` |

**Note on implementation status:** `packages/wallet-core` declares these
interfaces. There is no implementation of `KeyContainer`, `SmartAccountManager`
or `SeedAccountManager` anywhere in the repository — only the type surface and a
`WalletLockedError` class. No key ever touches a server because nothing that
handles keys exists yet, and nothing exists yet that could mishandle them.

## 3. Layer by layer

### `packages/*` — framework-free domain

No `packages/*` may import Nest, Next or React (rule 4 in
[`../engineering/api.md`](../engineering/api.md)). They build to `dist/` via
`tsc -p tsconfig.package.json` — see ADR-006 in [`DECISIONS.md`](DECISIONS.md).

| Package | Contents | Real? |
|---|---|---|
| `types` | asset identity, accounts, rails | Real |
| `wallet-core` | `Signer`, `KeyContainer`, `SmartAccountManager`, `SeedAccountManager` | **Interfaces only, no implementation** |
| `blockchain` | `BlockchainAdapter`, `EvmAdapter`, `RpcPool`, address validation | Real |
| `assets` | `deriveAssetId`, `describeBacking`, `assertKnownChain` | Real |
| `swaps` | `SwapRail`, `selectRail`, `RAIL_PREFERENCE` | Real |
| `security` | `redact`, `redactDeep`, `log` | Real |
| `config` | Zod env schema, `parseConfig`, `loadConfig` | Real |
| `contracts` | `CONTRACT_REGISTRY`, `Contract<Path>` | Real |
| `design-tokens` | colour, space, radius, glass, motion | Real, and **not consumed by the admin** |
| `transactions` | — | **Empty. `export {}`** |
| `integrations` | — | **Empty. `export {}`** |
| `api-client` | — | **Empty. `export {}`** |
| `ui` | — | **Empty. `export {}`** |

### `services/api` — modular monolith

22 of Correnthian's own modules plus `LoggerModule` in
`services/api/src/app.module.ts`. One process, one Postgres, one Redis. Not
microservices, and should not become microservices without a decision recorded
in `DECISIONS.md`.

Cross-cutting concerns are registered **globally** in
`services/api/src/common/core.module.ts`, in this order:

1. `AllExceptionsFilter` — one error envelope, internal detail never forwarded.
2. `RateLimitGuard` — Redis fixed window, fails closed.
3. `SessionGuard` — deny by default; `@Public()` opts out.
4. `RolesGuard` — role hierarchy `user < support < compliance < admin < owner`.
5. `AuditInterceptor` — every mutating request is recorded by construction.

**Guard ordering, and why it stays this way.** `RateLimitGuard` is registered
before `SessionGuard`, so `req.user` is never populated when the rate key is
computed. That was `DEF-005`, and the obvious fix — reorder them — does not
work: `SessionGuard` returns early on `@Public()` routes, and `POST /auth/login`
must be public, because you cannot require a session in order to obtain one.
Reordering would fix routes that never needed it and leave credential stuffing
bucketed by IP.

Instead the limiter reads the `Bearer` header itself and keys on
`sha256(token)`, which is byte-for-byte `Session.tokenHash`, falling back to the
client address when there is no token. No lookup: `hashSessionToken` is
arithmetic, so Redis failure and Postgres failure stay separate failure modes.
Closed in `8c48624`; see [`BACKEND_TASKS.md`](BACKEND_TASKS.md).

Full route inventory: [`API_CONTRACTS.md`](API_CONTRACTS.md).

### `apps/admin` — operations console

Next.js App Router, server-rendered, `shadcn` `radix-nova`. Eleven route
files, nine of them in the sidebar. Every
data-backed surface routes through `ApiState`, which distinguishes `ok`,
`unauthorised`, `forbidden`, `unavailable` and `error` so an outage does not
present as a login screen. Detail in [`ADMIN_OPS.md`](ADMIN_OPS.md).

### `apps/marketing`, `apps/web`, `apps/mobile` — not built

All three are framework defaults. `apps/web/src/app/page.tsx` is the
`create-next-app` welcome page. `apps/mobile/App.tsx` is the Expo default. Do
not assume anything about the client layer.

---

## 4. Data flow: one complete request

`GET /assets`, the path that most of the product's claims depend on:

1. `SessionGuard` resolves the bearer token to a user (`common/guards/session.guard.ts`).
2. `RolesGuard` — no `@Roles` on `GET /assets`, so any authenticated user passes.
3. `RateLimitGuard` — increments `correnthian:rate:api:<ip>` in Redis.
4. `AssetsController.list` validates the query with `zodPipe(listAssetsSchema)`.
5. `AssetsService.list` queries `Asset` joined to `Issuer`.
6. `services/api/src/assets/assets.mapper.ts` `toDomainAsset` maps Prisma enums to domain values —
   snake_case to kebab-case, and `''` (the native-asset sentinel) back to `null`.
7. `describeBacking(asset)` from `packages/assets` produces the disclosure
   sentence. A synthetic token can never be described as metal; there are tests
   pinning this.
8. The response is `{ asset, disclosure }` — an envelope, and the reason three
   past incidents happened. It is now pinned in `CONTRACT_REGISTRY`.

## 5. Surrogate ids vs domain ids — a trap that has already bitten

Two different things are called `assetId`:

| | What | Where |
|---|---|---|
| **Domain** id | `${chainId}:${contract\|native}:${issuerId}`, derived | `Asset.assetId`, unique |
| **Surrogate** id | cuid, the Prisma primary key | `Asset.id`, referenced by FKs |

`AssetPrice.assetId`, `WalletAccount.assetId`, `Transaction.assetId` and
`SwapQuote.fromAssetId`/`toAssetId` are **all foreign keys to the surrogate**.
Mixing them fails silently: the query returns an empty set and every holding
reads as unpriced at zero, which looks plausible rather than broken. This is
documented on both sides in `services/api/src/pricing/pricing.service.ts` and `services/api/src/portfolio/portfolio.service.ts`, and
pinned by a test.

## 6. Request lifecycle and infrastructure

- `import 'dotenv/config'` runs first in `main.ts` — `node dist/main.js` reads
  no `.env` otherwise, and `ConfigService` would validate an empty environment
  and refuse to boot.
- helmet, CORS from `CORS_ORIGINS`, `trust proxy` behind `TRUST_PROXY`.
- Swagger is mounted at `/docs` unconditionally (the CSP is disabled outside
  production to let it render). This is an open item in
  [`BACKEND_TASKS.md`](BACKEND_TASKS.md).
- `enableShutdownHooks()` drains in-flight requests and pooled connections.

## 7. What is deliberately absent

These are absences an agent is likely to assume exist.

| Absent | Evidence |
|---|---|
| Smart account deployment, passkey signing, ERC-4337 | No code. Only types. |
| Gas sponsorship / paymaster | No code. `BUNDLER_RPC_URL`/`PAYMASTER_RPC_URL` exist in `.env.example` and are read by nothing. |
| Guardians / social recovery flow | `Wallet.guardians` is a `String[]` column; no flow uses it. |
| Bitcoin / Solana adapters | `AddressFamily` supports them; `validateBitcoinAddress`/`validateSolanaAddress` exist; there is no adapter. |
| Any provider adapter | `packages/integrations` is `export {}`. |
| Job runner / scheduler / queue worker | None. `NotificationsService.claimBatch` exists but nothing schedules it, and it does not actually claim atomically. |
| Metrics, tracing, Sentry wiring | `SENTRY_DSN` and `OTEL_EXPORTER_OTLP_ENDPOINT` are in `.env.example`; nothing reads them. |
| Production infrastructure | `infrastructure/` contains only `docker/compose.yml` for local dev. |