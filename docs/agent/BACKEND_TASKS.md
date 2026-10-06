# BACKEND_TASKS

The single source of truth for what Correnthian's backend has, has half of, and
has not got. `TASK.md` at the repository root points here.

Verified against the repository at `2be6499` (2026-10-06). Plan section numbers
(`plan §N`) refer to `node_modules/plan.txt`, the backend master plan.

**Statuses:** `BACKLOG` · `READY` · `IN_PROGRESS` · `BLOCKED` · `REVIEW` ·
`TESTING` · `DONE`

---

## How to read this file

The plan's `BE-001 … BE-070` list is **not** reproduced here. Nine of its named
tasks were built under different names, and a copy of the original list would
tell an agent to build things that already exist. Section 1 maps the plan's IDs
onto reality. Sections 2 onward use new `BE-1xx` IDs anchored to the plan's
section numbering so any requirement can be traced back.

**`DONE` means the code exists and a test covers it.** Where it exists without
a test, or the test cannot fail, the status is `PARTIAL` and the gap is named.

---

## 1. The plan's named tasks, mapped

| Plan ID | Plan title | Reality | Where |
|---|---|---|---|
| `BE-001` | NestJS application | **DONE** as `services/api` | NestJS 12, ESM, 22 domain modules |
| `BE-002` | Environment configuration | **DONE** as `packages/config` | Zod schema, 6 tests, fails at boot |
| `BE-003` | PostgreSQL schema foundation | **DONE** | 19 models, 19 enums, 2 migrations |
| `BE-004` | Redis infrastructure | **PARTIAL** | Client + health + rate-limit counters. **No queue, no worker, no BullMQ.** |
| `SEC-001` | Threat model | **PARTIAL** | Boundary enforced in CI. No formal threat model document; see `docs/architecture/key-boundary.md` |
| `AUTH-001` | Authentication foundation | **DONE** as `auth` module | Argon2id + SHA-256 session digests, 7 tests |
| `USER-001` | User/device model | **DONE** as `users` + `devices` | Keyset-ish pagination, role mutation, soft revoke |
| `WALLET-001` | Wallet metadata architecture | **DONE** as `wallets` module | Public addresses only, address validation, guardians |
| `CHAIN-001` | Blockchain abstraction | **DONE** as `packages/blockchain` | `BlockchainAdapter`, `EvmAdapter`, `RpcPool`, 25 tests |
| `BLOCKCHAIN-001` | Blockchain engine | **PARTIAL** as `blockchain` module | Adapter resolves + health + wallet balance sync. No event indexing, no `Transaction` rows written. |
| `ASSET-001` | Asset registry | **DONE** as `assets` module + `packages/assets` | Derived identity, disclosure on every response, 7 + 5 tests |

**The plan's "immediate backend queue" is complete.** All ten exist.

---

## 2. Defects found while auditing (fix these first)

Found by reading the code, not by a failing test. Several of these are silent —
TypeScript, and the contract suite, both pass over them.

### DEF-001 — `POST /redemptions` can never succeed

- **Location:** `services/api/src/metals/redemption.controller.ts`
- **Description:** the controller passes `country: null, region: null` with the
  comment "resolved from the account record, never from the client". Nothing
  resolves them. `JurisdictionService.evaluate(null, …)` denies immediately, so
  every request returns 451 before reaching the service.
- **Dependencies:** none.
- **Expected output:** resolve country and region from the authenticated
  `User` row, or accept them from the client under an explicit trust rule. Add a
  test that a permitted jurisdiction produces a redemption.
- **Acceptance criteria:** a `POST /redemptions` for a redeemable asset in a
  permitted jurisdiction creates a row in state `requested`; the same request in
  an unmatched jurisdiction returns 451.
- **Security:** jurisdiction must never come from an untrusted client field
  without an explicit decision. If it does, that decision is an ADR.
- **Tests:** service-level test for the resolution, plus a controller test for
  the 451 path.
- **Status:** `BACKLOG`

### DEF-002 — `RedemptionService.transition` writes a column that does not exist

- **Location:** `services/api/src/metals/redemption.service.ts`,
  `services/api/prisma/schema.prisma`
- **Description:** on transition to `approved` the update includes
  `reviewedBy: actor.id`. `RedemptionRequest` has no `reviewedBy` column — it
  exists on `KycProfile`. Prisma will reject the unknown argument at runtime,
  and the exception filter maps `PrismaClientValidationError` to a 500, not a
  validation error.
- **Why nothing caught it:** verified by probe — `tsc --noEmit` accepts a
  wholly fictional field inside `prisma.<model>.update({ data })`. Prisma's
  generated input types are `Prisma.XOR<...>` unions, which defeat TypeScript's
  excess-property check. **This is not specific to `reviewedBy`: any typo in any
  Prisma write is invisible to the compiler.**
- **Expected output:** either add the column, or drop it and record the actor in
  the audit entry (which already carries `actorId`).
- **Acceptance criteria:** the approved transition round-trips against Postgres.
- **Security:** who approved a physical redemption must be recorded. The audit
  entry alone may be sufficient.
- **Tests:** a live-database test, not a mock. This is precisely the class of
  bug `contracts.spec.ts` exists to catch, and that suite does not cover this
  route.
- **Status:** `BACKLOG`

### DEF-003 — `services/api/prisma/schema.prisma` has drifted from the database

- **Location:** `services/api/prisma/schema.prisma:369` and `:637`
- **Description:** the migration
  `20261005150000_non_nullable_compound_uniques` made
  `Asset.contractAddress` and `JurisdictionRule.region` `NOT NULL DEFAULT ''`.
  The schema file still declares both as nullable. The application code matches
  the database; the schema file does not.
- **Consequence:** `prisma migrate dev` will now generate a migration reverting
  both to nullable — reintroducing the NULL-distinct uniqueness hole that the
  hand-written migration existed to close.
- **Expected output:** update `services/api/prisma/schema.prisma` to `String @default("")` for both,
  and regenerate the Prisma client.
- **Acceptance criteria:** `prisma migrate diff` between schema and migrations
  is empty.
- **Tests:** run `prisma migrate status` against a fresh database and confirm no
  pending migration is generated.
- **Status:** `BACKLOG`

### DEF-004 — Rate limiting ignores its own configuration

- **Location:** `services/api/src/common/guards/rate-limit.guard.ts`
- **Description:** `RATE_LIMIT_WINDOW_SECONDS` and `RATE_LIMIT_MAX_REQUESTS`
  are validated by `packages/config` and documented in `.env.example`, but the
  guard hardcodes `WINDOW_SECONDS = 60` and `{ auth: 10, api: 120 }`. Setting
  them changes nothing.
- **Expected output:** read the limits from `ConfigService`.
- **Status:** `BACKLOG`

### DEF-005 — The rate limiter can only bucket by IP

- **Location:** `services/api/src/common/guards/rate-limit.guard.ts`,
  `services/api/src/common/core.module.ts`
- **Description:** the guard's comment claims "the authenticated identity is the
  bucket where we have one", but `RateLimitGuard` is registered *before*
  `SessionGuard` and Nest runs global guards in registration order, so
  `req.user` is always `undefined` when the key is computed. Verified by reading
  the registration array; **not verified at runtime**, because it needs a live
  request with two identities behind one NAT.
- **Consequence:** the stated property (one office behind one NAT does not share
  a budget; one client rotating IPs does not get a fresh one) does not hold.
- **Expected output:** reorder the guards, or resolve the session before
  rate-limiting, and add a test.
- **Status:** `BACKLOG`

### DEF-006 — Readiness probe never returns 503

- **Location:** `services/api/src/health/health.controller.ts`
- **Description:** the docstring says "Fails with 503 when a required dependency
  is down so traffic is diverted, not dropped." The handler returns
  `{ status: 'degraded', … }` with HTTP 200. An orchestrator reading only the
  status code will keep routing traffic to a process that cannot serve it.
- **Expected output:** throw or set 503, or correct the docstring and document
  the intent.
- **Status:** `BACKLOG`

### DEF-007 — Missing wallets return 500, not 404

- **Location:** `services/api/src/portfolio/portfolio.service.ts`
- **Description:** `forWallet` throws a bare `new Error('Wallet not found')`,
  which `AllExceptionsFilter` classifies as `internal` → 500.
- **Security note:** this is not a leak (the message is generic), but it
  conflates "you asked for something you cannot have" with "we are broken".
- **Expected output:** `AppError.notFound(...)`.
- **Status:** `BACKLOG`

### DEF-008 — Portfolio balances are converted with a float

- **Location:** `services/api/src/portfolio/portfolio.service.ts`
- **Description:** the code comment says "Base units to a human number, via
  string arithmetic — never a float multiply on an 18-decimal balance", and the
  line below it is `Number(a.balanceRaw) / 10 ** a.asset.decimals`. A float
  divide on an 18-decimal balance is precisely what the comment forbids.
  `packages/blockchain` gets this right with viem's `formatUnits`.
- **Expected output:** exact decimal division, or correct the comment and accept
  the loss with an explicit tolerance.
- **Status:** `BACKLOG`

### DEF-009 — `claimBatch` does not claim

- **Location:** `services/api/src/notifications/notifications.service.ts`
- **Description:** the docstring describes "`updateMany` with a status guard…
  the loser matches zero rows". The implementation is a plain `findMany` with no
  update and no guard. Two workers receive the same rows.
- **Status:** `BACKLOG`

### DEF-010 — Committed build output inside `packages/*/src`

- **Location:** `packages/types/src/`, `packages/design-tokens/src/`
- **Description:** `.js`, `.d.ts`, `.js.map` and `.d.ts.map` files are checked in
  next to the `.ts` sources (`git ls-files` confirms 20 such files). They are
  stale output from a `tsc` that once emitted into `src`. `.gitignore` ignores
  `dist/`, not `src/`. Nothing imports them, and they will drift silently.
- **Expected output:** `git rm` them and add `src/**/*.js`, `src/**/*.d.ts` to
  `.gitignore`.
- **Status:** `BACKLOG`

### DEF-011 — Stale EIP-55 doc comment

- **Location:** `packages/blockchain/src/address.ts`, above `validateEvmAddress`
- **Description:** the comment says mixed-case addresses are "refused, because
  it is asserting a checksum we have no way to confirm", and references an
  `EIP55_SUPPORTED` marker that does not exist in the file. Verification *is*
  implemented below it via viem's `keccak256`. A duplicated comment block also
  sits above `keccak256Hex`.
- **Risk:** an agent reading the comment will believe mixed-case addresses are
  rejected, and may "restore" behaviour that is now a bug.
- **Status:** `BACKLOG`

### DEF-012 — Hand-written admin response types

- **Location:** `apps/admin/src/lib/types.ts`, `apps/admin/src/app/(dashboard)/dashboard/page.tsx`
- **Description:** `lib/types.ts` declares `AuditRow` and `QuoteStats` by hand
  with the comment "Not yet in the contract registry". Both **are** in the
  registry. `dashboard/page.tsx` still imports the hand-written `AuditRow`;
  `QuoteStats` in `lib/types.ts` is dead, shadowed by the quotes page's own
  inferred declaration.
- **Risk:** exactly the drift class `ADR-010` exists to prevent.
- **Status:** `BACKLOG`

### DEF-013 — Nest's scaffold e2e test would fail

- **Location:** `services/api/test/app.e2e-spec.ts`
- **Description:** asserts `GET /` returns `"Hello World!"`. There is no root
  route. `pnpm test` does not run it (`**/*.spec.ts` does not match
  `app.e2e-spec.ts`); `pnpm test:e2e` does, and would fail.
- **Status:** `BACKLOG`

### DEF-014 — Two documents state the opposite of the code

- `README.md` and `docs/engineering/standards.md` both say `packages/*` are
  "source-only, no build step". They build to `dist/`. See ADR-006.
- `docs/engineering/api.md` says "Nothing exists yet — there is no auth module,
  no users module, no session handling" and lists every domain module as
  "None of these are built". All of them are built.
- **Status:** `BACKLOG`

### DEF-015 — Pagination that is not keyset on two admin lists

- **Location:** `services/api/src/users/users.service.ts`,
  `services/api/src/devices/devices.service.ts`
- **Description:** both order by a timestamp (`createdAt`, `lastSeenAt`) but
  paginate with Prisma `cursor: { id }` + `skip: 1` on the primary key. A row
  inserted between two page requests reappears on the later page. `SwapsService`
  solves the identical problem properly with an encoded `(createdAt, id)`
  keyset and an unreadable cursor as a 400.
- **Not a security defect.** A correctness and operator-trust one: this is the
  list an operator reconciles money against.
- **Status:** `BACKLOG`

### DEF-016 — The admin console has no role gate on sign-in

- **Location:** `apps/admin/src/app/login/actions.ts`,
  `apps/admin/src/app/(dashboard)/layout.tsx`
- **Description:** `loginAction` stores whatever role the API returns;
  `DashboardLayout` redirects only when there is no session. An account with
  role `user` reaches the console shell. It sees no data — every page routes
  through `ApiState`, and the API enforces independently — but the console does
  not state the restriction.
- **Also note:** `getSession()` reads an **unsigned base64 cookie** for display.
  That is acceptable because authorisation is re-checked server-side on every
  call, but the UI role gates (`roleAtLeast`) are therefore cosmetic. They are
  not a security control and must not be described as one.
- **Status:** `BACKLOG`

### DEF-017 — Unused dependency injection

- **Location:** `services/api/src/swaps/swaps.service.ts`
- **Description:** `ProvidersService` is injected and never used. Not harmful;
  it is a hint that rail binding was intended here and never written.
- **Status:** `BACKLOG`

---

## 3. Foundation (plan §2–§7)

### BE-004 — Redis infrastructure · `PARTIAL`
- **What exists:** `services/api/src/redis/redis.service.ts` with ping-based
  health, connect/disconnect lifecycle, and a `raw` accessor that throws if not
  ready. Local dev via `infrastructure/docker/compose.yml` (Redis 7, appendonly,
  `allkeys-lru`, 256 MB).
- **What does not exist:** any queue. `BE-004`'s plan scope covers queues and
  event architecture; there is no BullMQ, no worker, no job runner.
- **Dependencies:** none.
- **Acceptance criteria for `DONE`:** a queue abstraction with at least one
  consumer, and a documented statement of what is a source of truth versus a
  cache. The current rule — Redis is a cache and a rate-limit counter, never a
  source of truth — lives only in prose in `docs/engineering/api.md`.
- **Tests:** health check covered; queue behaviour not applicable yet.
- **Status:** `PARTIAL`

### SEC-001 — Threat model · `PARTIAL`
- **What exists:** `scripts/check-key-boundary.mjs` enforced by CI job
  `key-boundary`; `credential-scan` job greps `*.env*` for
  `PRIVATE_KEY|MNEMONIC|SEED_PHRASE=`; the invariant header in `services/api/prisma/schema.prisma`;
  `docs/architecture/key-boundary.md`.
- **What does not exist:** a threat model covering anything other than the key
  boundary. There is no analysis of account takeover, session theft, admin
  compromise, provider credential leakage, or supply chain.
- **Expected output:** a threat model document with assets, adversaries,
  abuse cases, and mitigations — scoped to the API and admin, since the client
  layer does not exist.
- **Acceptance criteria:** every mitigation either exists in code with a test,
  or is listed as an accepted gap with an owner.
- **Status:** `PARTIAL`

---

## 4. API architecture (plan §8)

### BE-101 — Global route prefix · `BACKLOG`
- **Description:** every route is at the root (`/assets`, `/health`, `/auth`).
  No prefix. Recorded as an open question in `docs/engineering/api.md`.
- **Why it matters:** changing it later breaks the admin. Decide before the
  surface grows to a public client.
- **Expected output:** a decision (ADR), then a prefix applied to every route
  and to `apps/admin`'s `API_URL` paths.
- **Acceptance criteria:** `contracts.spec.ts` updated for the new paths.
- **Dependencies:** none. **Blocks:** the first external client.
- **Status:** `BACKLOG`

### BE-102 — OpenAPI documentation · `PARTIAL`
- **What exists:** `@nestjs/swagger` is mounted at `/docs`
  (`services/api/src/main.ts`), with a `DocumentBuilder`, bearer auth
  declaration and a title. Controllers carry `@ApiTags` and `@ApiOperation`.
- **What does not exist:** every route is validated by a Zod schema rather than
  a decorated DTO class, so **the generated document describes no request
  schemas and no response schemas**. It is a list of paths with summaries.
- **Also:** `/docs` is mounted unconditionally, in production as well as
  development. The CSP is disabled outside production to let it render.
- **Expected output:** derive the OpenAPI document from `CONTRACT_REGISTRY` and
  the Zod query/body schemas; decide whether `/docs` is exposed in production.
- **Acceptance criteria:** the document's response schemas are generated from
  the same schemas the contract suite enforces.
- **Dependencies:** `BE-110`. **Status:** `PARTIAL`

### BE-103 — Health and readiness · `PARTIAL` (see DEF-006)
- **What exists:** `GET /health/live` (process only, no dependencies) and
  `GET /health/ready` (Postgres and Redis with latency). Both `@Public()` and
  `@SkipRateLimit()`.
- **Gap:** readiness returns 200 when degraded. See DEF-006.
- **Status:** `PARTIAL`

### BE-104 — Graceful shutdown · `DONE`
- `enableShutdownHooks()`; `RedisService.onModuleDestroy` quits the client.
- **Gap worth noting:** `PrismaService` has no disconnect on destroy. Verify
  before relying on it in production.
- **Status:** `DONE`

### BE-105 — Observability · `PARTIAL`
- **What exists:** `nestjs-pino` structured logging with transport-layer
  redaction of `authorization`, `cookie`, `password`. Confirmed against a real
  500 trace.
- **What does not exist:** metrics, traces, error reporting. `SENTRY_DSN` and
  `OTEL_EXPORTER_OTLP_ENDPOINT` are in `.env.example` and read by nothing.
- **Status:** `PARTIAL`

---

## 5. Identity and access (plan §9–§12)

### AUTH-001 — Authentication · `DONE`
- **Where:** `services/api/src/auth/`.
- **Inputs:** email + password. Argon2id, parameters from `@correnthian/config`.
- **Output:** `{ user, token, expiresAt }`. The raw token is returned once and
  never persisted; only its SHA-256 digest is stored.
- **Acceptance criteria:** unknown, expired and revoked sessions are
  indistinguishable; registration does not confirm whether an address exists;
  login runs a dummy argon2 verification on the miss path so timing is
  comparable.
- **Security:** token never persisted; `userAgent` truncated to 512 chars;
  `LOGIN` and `REGISTER` are `@Public()` and rate limited to 10/min.
- **Tests:** 7 in `services/api/src/auth/auth.service.spec.ts`.
- **Status:** `DONE`

### BE-203 — Magic-link / passwordless auth · `BLOCKED`
- **Why blocked:** needs an email transport, and `notifications` has none by
  design (ADR-020).
- **Why it matters:** `User.passwordDigest` is nullable *specifically* for this.
  The beachhead user should never have to choose a password. This is the target
  UX in the design spec, not an optimisation.
- **Dependencies:** `BE-1201`.
- **Expected output:** issue-link flow with single-use, expiring, hashed tokens;
  argon2 digest left null for magic-link accounts.
- **Security requirements:** the link must not be a bearer token that survives
  forwarding; rate limit per address and per IP; never reveal whether an address
  exists.
- **Tests:** token single-use, expiry, and enumeration resistance.
- **Status:** `BLOCKED`

### BE-201 — Devices · `DONE`
- **Where:** `services/api/src/devices/`. `GET /devices` self-scoped;
  `GET /devices/all` and `GET /devices/stats` behind `support`;
  `POST /devices` register; `DELETE /devices/:id` soft revoke (204).
- **Security:** `Device.publicKey` is a passkey **public** key. Revocation is
  soft so the audit trail survives.
- **Gap:** `touch()` exists and is called by nothing.
- **Tests:** none at the service level. Covered indirectly by the contract
  suite.
- **Status:** `DONE`

### WALLET-001 — Wallet metadata · `DONE`
- **Where:** `services/api/src/wallets/`. Addresses validated on the way in via
  `validateAddress`; guardians refused on seed accounts; `@@unique([chainId,
  address])`; registration conflict does not confirm the address is already
  registered.
- **Security:** public addresses only. No field can express a key.
- **Tests:** 8 in `wallets.service.spec.ts`.
- **Status:** `DONE`

### BE-202 — Session-key model · `BACKLOG`
- **Blocked on** smart accounts, which do not exist.
- **Security requirement:** a server that can mint a session key unilaterally, or
  grant it a scope the user never authorised, is custodial. This is listed as
  boundary break #5 in `docs/architecture/key-boundary.md`.
- **Status:** `BACKLOG`

### BE-203b — Seed-account recovery · `BLOCKED` (decision required)
- Guardians live in a smart-account contract. Bitcoin and Solana have no
  equivalent, so seed accounts have **no recovery path at all** today.
- Four options are laid out in `docs/architecture/key-boundary.md`. None is
  chosen. The cheapest answer (option 4 — defer BTC/SOL indefinitely) is the one
  most consistent with what the spec already removed from scope.
- **Status:** `BLOCKED`

---

## 6. Blockchain (plan §13–§16)

### CHAIN-001 — Blockchain abstraction · `DONE`
- `BlockchainAdapter` in `packages/blockchain/src/adapter.ts`. Reads plus
  unsigned-transaction assembly. **Signing is deliberately absent** — a signed
  payload here would be a lie about the architecture.
- `EvmAdapter` on viem. Decimal strings end to end.
- `RpcPool`: 30-second quarantine, weight preference, per-request failover, and
  it still tries quarantined endpoints when nothing else is available so a
  single-endpoint chain cannot go permanently offline.
- **Tests:** 25 across `rpc.test.ts` and `address.test.ts`.
- **Status:** `DONE`

### BE-301 — Chain registry and adapter resolution · `DONE`
- `services/api/src/blockchain/blockchain.service.ts` resolves a chain to an
  adapter, caches it, and names a missing RPC configuration as "a deployment
  gap, not a client error".
- `services/api/src/chains/` exposes configuration and enablement. **RPC URLs
  are never selected into any response.**
- **Status:** `DONE`

### BE-302 — Indexer · `PARTIAL`
- **What exists:** `POST /blockchain/wallets/:walletId/sync` reads the native
  balance and every enabled token on the wallet's chain into `WalletAccount`,
  with per-contract error isolation and an audit entry. Verified live against
  Sepolia (61.060896814128264732 ETH indexed).
- **What does not exist:** the plan's `BACKEND-05 Indexer` — addresses to
  blockchain **events** to transactions. **No `Transaction` row is ever written.**
  The model exists; nothing populates it. No confirmation tracking, no dropped
  transaction handling, no backfill.
- **Dependencies:** none for balance sync; contract provider for events.
- **Expected output:** an event poller writing `Transaction` with `txHash`,
  `direction`, `state`, `blockNumber`, `confirmations`.
- **Security:** reads public chain state only. No key is involved and none could
  be.
- **Acceptance criteria:** a wallet with on-chain activity shows transactions
  after a sync, with correct direction and confirmation count.
- **Tests:** fixture-based, against Sepolia or a local node, not mocks.
- **Status:** `PARTIAL`

### BE-303 — Bitcoin adapter · `BACKLOG`
- `AddressFamily` includes `bitcoin` and `validateBitcoinAddress` accepts bech32
  and base58 formats. There is no adapter.
- **Status:** `BACKLOG`

### BE-304 — Solana adapter · `BACKLOG`
- Same. `validateSolanaAddress` is format-only and does not decode to confirm a
  32-byte key.
- **Status:** `BACKLOG`

---

## 7. Asset registry (plan §17–§18)

### ASSET-001 — Asset registry · `DONE`
- **Where:** `services/api/src/assets/` and `packages/assets/`.
- Identity derived from `(chain, contract, issuer)` via `deriveAssetId`.
  `describeBacking()` on every response. `toDomainAsset` maps Prisma snake_case
  enums to domain kebab-case and fails loudly on an unknown tier.
- `GET /assets` (default limit 50, max 200), `GET /assets/stats`,
  `GET /assets/:assetId`, `POST /assets` (compliance), `PATCH /assets/:id/enabled`
  (admin), `PATCH /assets/:id/attestation` (compliance).
- **Security:** a synthetic or unallocated token can never be described as
  metal. Pinned by `packages/assets/src/__tests__/registry.test.ts` and asserted
  against the running API.
- **Tests:** 7 + 5, plus contract-suite coverage.
- **Status:** `DONE`

### BE-401 — Issuer registry and verification · `PARTIAL`
- **What exists:** `services/api/src/issuers/`. Create always starts
  `unverified`. Promotion to `issuer_verified` is refused without custodian,
  proof of reserves and recorded licences. The tier propagates to every asset
  from that issuer. Removing evidence downgrades the tier everywhere.
  `PATCH /:slug/licences` exists so evidence can be recorded after creation.
- **What does not exist:** the **verification workflow**. Nothing checks that
  the evidence is real. A `compliance` operator with the right fields filled in
  can assert `issuer_verified` about an issuer that was never checked.
- **This is a process gap recorded as a blocker in the root `TASK.md`, and it is
  the one place the registry can lie to a customer.**
- **Dependencies:** counsel-reviewed criteria.
- **Security requirement:** evidence changes are audit events. They are.
- **Tests:** 12 in `issuers.service.spec.ts`, including four pinning
  omitted-versus-empty-array semantics.
- **Status:** `PARTIAL`

---

## 8. Portfolio and pricing (plan §19–§20)

### BE-501 — Portfolio engine · `PARTIAL` (see DEF-007, DEF-008)
- **What exists:** `GET /portfolio`, `/wallets/:walletId`,
  `/wallets/:walletId/history`, `POST /wallets/:walletId/snapshot`. Unpriced
  holdings are marked unpriced and excluded; the total is explicitly a floor with
  `unpricedCount` alongside.
- **What does not exist:** allocation by category or by asset, history charting,
  and any scheduled snapshot. `capture` is only invoked by its own endpoint.
- **Status:** `PARTIAL`

### BE-502 — Price engine · `PARTIAL`
- **What exists:** `GET /pricing/assets/:assetId` (reference vs executable),
  `.../history`, `POST /pricing/record` (support). Source mandatory. Stale
  threshold 300 s. See ADR-014.
- **What does not exist:** a feed adapter, a scheduler, and the executable price
  itself. `executablePriceUsd` is always `null` with a sentence saying why.
  **No price is ever recorded by any code** — the local database has an empty
  `AssetPrice` table unless a human POSTs to it, which is why the portfolio reads
  everything as unpriced.
- **Dependencies:** `PRICE_FEED_API_KEY` / `METAL_SPOT_FEED_API_KEY` in
  `.env.example`, read by nothing.
- **Status:** `PARTIAL`

---

## 9. Transactions (plan §21–§22)

### BE-601 — Transaction engine · `BACKLOG`
- **What exists:** the `Transaction` model, with `@@unique([chainId, txHash])`,
  state, direction, confirmations, block number and time. Nothing writes to it.
- **Expected output:** lifecycle from observed event to `confirmed`/`failed`/
  `dropped`, with confirmation counting and reorg handling.
- **Dependencies:** `BE-302`.
- **Security:** read-only over public chain state. Must never introduce a
  signing path.
- **Tests:** fixture-based against a node.
- **Status:** `BACKLOG`

### BE-602 — Send/receive backend · `BACKLOG`
- **Description:** assemble an unsigned transaction for the client to sign.
  `EvmAdapter.buildTransaction` and `BlockchainAdapter` already support this.
  No endpoint exposes it.
- **Security:** the server assembles, the device signs. A signed payload produced
  server-side would break ADR-001.
- **Status:** `BACKLOG`

---

## 10. Swaps (plan §23–§24)

### BE-701 — Swap engine · `PARTIAL`
- **What exists:** `POST /swaps/quotes` records a quote with disclosure and
  executes nothing; `GET /swaps/quotes` (support) with state/railKind filters and
  keyset pagination on `(createdAt, id)`; `GET /swaps/quotes/:id`;
  `GET /swaps/quotes/stats`; `GET /swaps/quotes/mine`.
- **What does not exist:** rail binding. `createQuote` hardcodes
  `railKind: 'provider'`, `railId: 'unassigned'`, `executionQuality: 'none'`,
  `toAmountRaw: '0'`. There is no `SwapRail` implementation, so `selectRail`
  and `RAIL_PREFERENCE` are exercised only by tests.
- **Why the hardcoding is right:** honest failure beats a fabricated executable
  price. `executable` is computed as `executionQuality !== 'none' && toAmountRaw > 0`,
  which is `false` for every quote the system can currently produce.
- **Dependencies:** a contracted metals provider (`BE-802`).
- **Tests:** the quotes list is covered by 5 dedicated contract-suite tests plus
  keyset pagination, filter and cursor-validation cases, mutation-tested.
- **Status:** `PARTIAL`

### BE-702 — Swap provider adapters · `BACKLOG`
- `packages/integrations/src/index.ts` is `export {}`. No adapter exists for any
  provider.
- **Status:** `BACKLOG`

---

## 11. Precious metals (plan §25–§29)

### BE-801 — Metals engine · `PARTIAL`
- **What exists:** `RedemptionRequest` with an explicit state machine,
  `RedemptionService.request` with asset/provider/jurisdiction gates, an
  allowlisted `transition`, and `stats`.
- **What does not exist:** instruments, serialisation, serial numbers as a first
  class concept (`serialNumbers String[]` exists on the model and is never
  written).
- **Gap:** `PATCH /redemptions/:id/transition` to `approved` fails at runtime —
  DEF-002.
- **Tests:** 10 in `redemption.service.spec.ts`.
- **Status:** `PARTIAL`

### BE-802 — Metals provider adapter · `BACKLOG` (critical path)
- No adapter. The seed registers `placeholder-metals` as `disabled` with no
  capabilities.
- **Critical path.** Multi-month lead time. Nothing in this repository can
  substitute for it.
- **Expected output:** the primary rail that delivers tokens directly to a
  user's smart-account address, quoted with itemised fees.
- **Security:** must never require a Correnthian-held key. Delivery target is an
  address the user controls.
- **Status:** `BLOCKED` — on an external contract, not on engineering.

### BE-803 — Gold buy flow · `BACKLOG`
- **Expected output:** fiat → metal, gold-denominated, fee itemised before
  signing, gas sponsored, jurisdiction-gated.
- **Status:** `BLOCKED` on `BE-802`.

### BE-804 — Gold sell flow · `BACKLOG`
- **Status:** `BLOCKED` on `BE-802`.

### BE-805 — Redemption mechanics · `PARTIAL` (see DEF-001)
- Mechanics and fees depend on partner terms. The state machine exists; the
  request path is dead.
- **Status:** `PARTIAL` and `BLOCKED` on `BE-802`.

### BE-806 — What "serialisation" means · `OPEN`
- Recorded as open question 6 in `docs/engineering/api.md`. It implies minted
  serial numbers on physical holdings, which depends entirely on whether the
  partner has that data. It may be an empty module.
- **Status:** `OPEN`

---

## 12. On-ramp and off-ramp (plan §30–§31)

### BE-901 — On-ramp · `PARTIAL`
- **What exists:** `GET /onramp/availability?direction=buy|sell` (`@Public()`,
  self-describing `{ available, reason }`), `POST /onramp/quote`.
- **What does not exist:** a provider. `quote()` validates, resolves, and then
  throws `providerUnavailable` unconditionally — deliberately, so the failure is
  a refusal rather than a plausible rate.
- **Off-ramp:** availability supports `sell`; `quote` hardcodes `'buy'`, so an
  off-ramp quote is unreachable.
- **Tests:** 6 in `onramp.service.spec.ts`.
- **Status:** `PARTIAL`

---

## 13. Providers (plan §32–§33)

### BE-1001 — Provider management · `DONE`
- `services/api/src/providers/`. `GET /providers`, `/providers/health`,
  `/providers/:slug`, `PATCH /providers/:slug/status` (admin).
- **Security:** only a health-probe payload is stored. No credential field
  exists on the model. See ADR-018.
- **Status:** `DONE`

### BE-1002 — Provider health system · `PARTIAL`
- **What exists:** `recordHealth` and `healthSummary` (counts by status).
- **What does not exist:** a prober. Nothing calls `recordHealth` except a
  manual service invocation. Every provider's `lastCheckedAt` is null unless set
  by hand, and the admin renders "never checked" as destructive for exactly that
  reason.
- **Dependencies:** a provider to probe.
- **Status:** `PARTIAL`

---

## 14. Compliance and risk (plan §34–§37)

### BE-1103 — Jurisdiction engine · `DONE`
- `services/api/src/compliance/`. Deny-by-default, region precedence, inactive
  rules treated as absent, `assertEligible` throws 451 rather than returning
  false. `GET /compliance/eligibility` is `@Public()`.
- **Security:** the seed's `US` rule is marked `DEVELOPMENT ONLY` and permits
  buy/sell/metals while refusing redemption. It must be replaced with
  counsel-reviewed rules before any deployment.
- **Tests:** 7.
- **Status:** `DONE`

### BE-1101 — KYC / AML · `BACKLOG`
- **What exists:** the `KycProfile` model, `User.kycStatus`, an admin filter and
  display. `providerRef` stores an opaque pointer; the schema comment says
  explicitly that identity documents and biometric data are never stored.
- **What does not exist:** the flow. No provider, no webhook, no review queue,
  no screening. `KycProfile` rows are never created by any code path.
- **Security requirements:** store a pointer, never documents. Screen at
  onboarding and before every fiat movement. Record the reviewing operator.
- **Status:** `BACKLOG`

### BE-1105 — Sanctions screening · `BACKLOG`
- `ProviderCategory` includes `sanctions`. Nothing uses it.
- **Security requirement:** selling gold to consumers with dollars triggers AML
  and sanctions obligations **regardless of custody posture**. This is
  load-bearing for v1 and is not implemented.
- **Status:** `BACKLOG`

### BE-1102 — Risk engine · `BACKLOG`
- `Asset.riskFlags` and `Issuer.riskFlags` exist as `String[]` and are set
  manually through the admin. There is no scoring, no rules engine, no
  velocity checks, no structuring detection.
- **Status:** `BACKLOG`

### BE-1104 — Fees engine · `PARTIAL`
- **What exists:** the `QuoteFee` shape with `kind` in
  `{ provider, network, correnthian }`, `SwapQuote.fees` as a JSON column, and
  the hardcoded `{ label: 'Correnthian fee', amountUsd: 0, kind: 'correnthian' }`
  written by `createQuote`.
- **What does not exist:** anything that computes a fee. The engine is one hardcoded
  zero.
- **Security:** fees must always be itemised and shown before signing. Never
  earn by mispricing an asset.
- **Status:** `PARTIAL`

---

## 15. Notifications (plan §38)

### BE-1201 — Notifications backend · `PARTIAL`
- **What exists:** enqueue, list, claim, mark sent/failed, stats. Rows are
  written; **nothing sends.**
- **What does not exist:** a transport, a scheduler, and an atomic claim
  (DEF-009).
- **Why it is not more built:** a row that claims to have been emailed is a lie a
  user could act on. This is deliberate. See ADR-020.
- **Dependencies:** `BE-203` needs this for magic links.
- **Status:** `PARTIAL`

---

## 16. Admin operations (plan §43–§56)

### BE-1501 — Admin backend · `DONE` (as modules, not a module)
- There is **no `admin` module.** Each domain module exposes its own operator
  routes behind `@Roles(...)`. This is a deliberate consequence of the
  modular-monolith rule and is worth knowing before anyone adds one.
- **Status:** `DONE`

### BE-1502 — Admin roles · `DONE`
- `RolesGuard` with a rank hierarchy: `user 0 < support 1 < compliance 2 <
  admin 3 < owner 4`. A role satisfies a requirement if it is equal or higher.
- A role not in the map ranks `-1`; a requirement not in the map ranks
  `Infinity`, so an unknown requirement is unsatisfiable. That is fail-closed
  and is deliberate.
- **Status:** `DONE`

### BE-1503 — Admin console · `DONE` (with DEF-016)
- Eleven route files, nine in the sidebar: dashboard, users, users/[id], devices, assets, issuers, chains,
  providers, quotes, audit. All server-rendered against live API data. No mocks
  remain. Loading, empty, error and partial-failure states designed.
- Detail in [`ADMIN_OPS.md`](ADMIN_OPS.md).
- **Status:** `DONE`

### BE-1504 — Admin pages not built · `BACKLOG`
- Transactions, compliance, metals/redemption, risk operations, finance, system
  configuration. The underlying APIs mostly exist for the first three.
- **Dependencies:** `BE-601`, `BE-1102`, `BE-1104`.
- **Status:** `BACKLOG`

### BE-1505 — System configuration · `BACKLOG`
- The `FeatureFlag` model exists (`key`, `enabled`, `rollout`, `description`)
  and **nothing reads or writes it**. No route, no middleware, no admin surface.
- **Status:** `BACKLOG`

---

## 17. Audit (plan §55) · `DONE`

### BE-1600 — Audit trail
- Append-only `AuditLog`. `AuditInterceptor` records every mutating request by
  construction (ADR-012). Metadata redacted **on write**. Write failures
  swallowed deliberately.
- `GET /audit` (compliance) with action/outcome filters, cap 200,
  explicit projection that withholds metadata; `GET /audit/actor/:actorId`;
  `GET /audit/:id` returns the metadata.
- Actor emails are resolved server-side in a batched second query —
  `AuditLog.actorId` is a plain string, not a relation.
- **Status:** `DONE`

---

## 18. Analytics, finance, reconciliation (plan §54, §57–§59) · `BACKLOG`

### BE-1601 — Analytics backend · `BACKLOG`
- Nothing. No volume, no revenue, no AUM, no fee totals.
- **Status:** `BACKLOG`

### BE-1602 — Reconciliation engine · `BACKLOG`
- Nothing. This is the one that matters most: it is how a mismatch between what
  the provider says was delivered and what the chain says arrived would be
  caught. It does not exist.
- **Dependencies:** `BE-802`.
- **Status:** `BLOCKED` on `BE-802`.

### BE-1603 — Incident management · `BACKLOG`
- Nothing. `docs/runbooks/` is listed in the docs index and does not exist. The
  key-boundary document records that a boundary breach has no runbook, which is
  the most serious gap in that list.
- **Status:** `BACKLOG`

---

## 19. Hardening (plan §62, §64–§66)

### BE-1701 — Financial operation state machines · `PARTIAL`
- Redemption is the only state machine, and it is allowlisted. Quote lifecycle
  (`QuoteState` has six states; only `quoted` is ever written) and
  `TxState` are not implemented.
- **Acceptance criteria for `DONE`:** every state transition that moves value
  has an explicit allowlist, terminal states are terminal, and nothing
  auto-approves.
- **Status:** `PARTIAL`

### BE-1702 — Testing strategy · `PARTIAL`
- 140 tests across 6 workspaces: 92 in `services/api` (10 files, of which 27 are
  the contract suite), 25 in `packages/blockchain`, 7 in `packages/assets`,
  6 in `packages/swaps`, 6 in `packages/config`, 4 in `packages/security`.
  Without a `DATABASE_URL` the 27 contract tests **skip** rather than fail, so a
  local run reports 113 passed and 27 skipped. That is the documented behaviour;
  in CI the suite fails instead of skipping.
- **Gaps:** no controller or HTTP-level tests outside the contract suite; no
  tests for `assets.service.ts`, `providers`, `chains`, `notifications`,
  `portfolio`, `users`, `devices`, `audit`, or the guards themselves.
  `packages/contracts`, `packages/types`, `packages/ui`, `packages/api-client`,
  `packages/integrations`, `packages/transactions` have **no tests and no
  implementation**.
- **The e2e suite is dead.** See DEF-013.
- **Status:** `PARTIAL`

### BE-1703 — Security testing · `PARTIAL`
- **Exists:** key-boundary guard (both directions verified), credential scan,
  redaction tests, EIP-55 vectors, deny-by-default jurisdiction tests, issuer
  evidence gating, redemption refusal tests.
- **Does not exist:** SAST, dependency audit, secret scanning beyond env files,
  authorisation fuzzing, rate-limit bypass testing, no test that a `user` role
  cannot reach an admin route (it is enforced by `RolesGuard`, untested).
- **Status:** `PARTIAL`

### BE-1704 — CI/CD · `PARTIAL`
- **Exists:** `.github/workflows/ci.yml` with three jobs. `verify` runs against
  real Postgres 17 and Redis 7 service containers, builds packages, migrates,
  seeds, then typechecks, builds and tests. `key-boundary` and `credential-scan`
  are separate.
- **Does not exist:** any deployment pipeline, any staging or production
  environment, any migration-in-production procedure beyond a document.
- **The repository has no remote.** `worktree.baseRef=head` is configured
  because of it.
- **Status:** `PARTIAL`

---

## 20. Blockers and risks

| Item | Impact | Status |
|---|---|---|
| **Metals issuer / LP contract** | **Critical path.** Multi-month lead time. Blocks BE-802, and through it BE-803, BE-804, BE-805, BE-1602. | Not started |
| Legal counsel | Entity structure, money-transmitter analysis, CFTC vs SEC for metals. Required **before design freeze**, not before launch. | Not engaged |
| Design freeze date | Undated. Counsel answers change how the buy flow is built. | Unset |
| `verifiedTier` verification workflow | The registry can assert `issuer_verified` about itself with nothing checking the evidence. | No workflow |
| Provider due diligence | Kinesis / PAXG / XAUT specifics were researched under degraded conditions and are unverified. | Open |
| Seed-account recovery | Guardians have no BTC/SOL equivalent. | Decision required |

---

## 21. Summary counts

54 tracked tasks plus 17 defects.

| Status | Tasks |
|---|---|
| `DONE` | 13 |
| `PARTIAL` | 20 |
| `BACKLOG` | 14 |
| `BLOCKED` | 6 |
| `OPEN` | 1 |
| Defects `DEF-001`…`DEF-017` | 17, all `BACKLOG` |

**13 of 54 tasks are complete.** The plan's §68 dependency chain is most of the
way built at the infrastructure layer and not started at the layer that moves
money. See [`BACKEND_ROADMAP.md`](BACKEND_ROADMAP.md).