# DECISIONS

Architecture decision records. Every one was mined from the git history or the
design spec, and each names the code that carries it — because a decision with
no trace in the repository is a decision an agent will undo.

Format: **Decision / Reason / Consequences.** Status is one of `Locked`,
`Reversed`, `Open`.

The product-level decision record lives in
[`../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md` §2](../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md).
This file records the decisions that the *code* actually embodies, including
several the spec did not anticipate.

---

## ADR-001 — Correnthian is self-custodial; no keys server-side

**Status:** Locked.

**Decision.** No Correnthian-operated service accepts, stores, logs, transforms,
escrows or transmits private key material or seed phrases. Ever. There is no
exception for features, recovery flows, support tooling, analytics or debugging.

**Reason.** A server compromise must not yield funds. The practical formulation
that makes this checkable: *a Correnthian server must be incapable of moving a
user's funds.* It is also a product asset — a competitor cannot retrofit it.

**Consequences.**
- `packages/wallet-core` declares only `@correnthian/types` as a dependency.
- `scripts/check-key-boundary.mjs` walks the transitive closure and fails on
  transport, chain SDK, UI framework or server framework. CI job `key-boundary`.
- `services/api/prisma/schema.prisma` opens with the invariant: the schema must
  never gain a column capable of holding key material. Security baseline
  OWASP MASVS / MASTG.
- `Wallet` is a watch-list entry: a public address, a chain, an account kind,
  and public guardian addresses. `WalletsService` refuses guardians on a seed
  account because it has no contract to hold them.
- **Consequence that is easy to miss:** because no implementation of
  `KeyContainer` exists, this property is currently upheld by *absence*. The
  moment someone writes the first device-side key container, the boundary has
  real code on one side of it.

---

## ADR-002 — Thin aggregator posture

**Status:** Locked.

**Decision.** Correnthian holds no user assets, takes no principal risk, and
earns explicit itemised fees. Provider fee, network fee and Correnthian fee are
separate lines shown before the user signs.

**Reason.** Keeps the platform on the software-provider side of the
money-transmitter line, avoiding capital requirements. Fee transparency is both
an ethics and a commercial decision: hiding a spread in the gold price would
poison the trust model the product is built on.

**Consequences.**
- `SwapQuote.fees` is a JSON column, itemised, with `kind` in
  `{ provider, network, correnthian }` (`packages/types/src/rails.ts`).
- `PricingService.quote` keeps `referencePriceUsd` and `executablePriceUsd`
  distinct and returns `spreadUsd`. With no provider contracted,
  `executablePriceUsd` is `null` and the response carries a sentence saying why.
  The reference price is never passed off as obtainable.
- Physical redemption may make Correnthian a precious-metals dealer, separately
  licensed in many US states. Counsel is required before design freeze, not
  before launch.

---

## ADR-003 — The provider-rail reversal: DEX-first was wrong

**Status:** Reversed (2026-10-05).

**Decision.** The licensed metals provider is the **primary** rail and a launch
dependency. The DEX aggregator is the secondary rail and carries an explicit
size cap. `RAIL_PREFERENCE = ['provider', 'dex', 'cex', 'otc']`.

**Reason.** The earlier draft chose DEX-first with an LP partner in parallel.
That is correct for a crypto-native beachhead and wrong for this one. A person
paying by debit card has no USDT, no gas and no tolerance for slippage. Routing
them through a Uniswap USDT→PAXG trade is the wrong mechanism for the wrong user.
Deep gold liquidity is custodial; on-chain it is thin.

**Consequences.**
- `selectRail()` in `packages/swaps/src/index.ts` ranks by `RAIL_PREFERENCE`
  rather than returning the first supporting rail. Six tests cover
  provider-over-dex, dex-over-cex, fallback, no-match, and non-mutation.
  Before the fix, selection was registration-order dependent — a defect found by
  the documentation pass and fixed in commit `7a34340`.
- `SwapRail` is resolved by capability. App code never names a concrete rail,
  which is what let the reversal happen without touching a screen.
- `sizeCapUsd` and `executionQuality` are mandatory on a quote. A thin-market
  quote that does not disclose its own limit is how a user gets filled materially
  worse than the price shown, so honest failure is representable in the type.
- `SwapsService.createQuote` currently hardcodes `railKind: 'provider'`,
  `railId: 'unassigned'`, `executionQuality: 'none'`, `toAmountRaw: '0'`. This
  is deliberate: no provider is contracted, and a fabricated executable price
  would be a lie a user could act on.
- The partner contract has a multi-month lead time and is the project's critical
  path. Nothing else in this project may be late; that may.

---

## ADR-004 — Asset identity is (chain, contract, issuer)

**Status:** Locked.

**Decision.** A symbol is never an identity. An asset is the triple
`(chain, contract, issuer)`. USDT on Ethereum, BNB, Polygon, Tron and Solana are
five distinct assets.

**Reason.** Deriving identity in exactly one place prevents the same class of bug
twice: "we added USDT" and now balances are wrong on one of five networks.

**Consequences.**
- `deriveAssetId()` in `packages/assets/src/index.ts` is the only place identity
  is produced. `AssetsService.create` derives rather than accepting one from the
  caller.
- `Asset.assetId` is `@unique` and derived. `@@unique([chainId, contractAddress, issuerId])`
  is the database backstop.
- Domain type: `AssetRef` in `packages/types/src/asset.ts`. Asset identity
  arrives at the API as a ref, never as a symbol.
- **Live consequence:** `contractAddress` is `NOT NULL` with `''` as the
  "native asset" sentinel (see ADR-009). `services/api/src/assets/assets.mapper.ts` maps `''` back to
  `null` for the domain type, and `services/api/src/blockchain/indexing.service.ts` looks up the native asset
  by `contractAddress: ''`.

---

## ADR-005 — EIP-55 verification uses viem's keccak-256

**Status:** Locked (2026-10-06, closed a gap that had been open since foundation).

**Decision.** EVM address validation verifies mixed-case addresses against
EIP-55 using `keccak256` from viem. Node's `crypto` is not used, because it
exposes NIST `sha3-256` — a *different* algorithm with a different digest, and
substituting it would silently accept mistyped addresses.

**Reason.** A mistyped address is a permanent, irreversible loss of funds. EIP-55
catches the majority of transpositions: a mixed-case address with one character
swapped fails the checksum and is rejected rather than silently sent to a
valid-looking address nobody controls.

**Consequences.**
- `packages/blockchain/src/address.ts`. Two canonical EIP-55 vectors and a
  transposition case are asserted in `__tests__/address.test.ts`.
- All-lowercase and all-uppercase addresses are accepted without a checksum.
  All-lowercase cannot carry a checksum error. **All-uppercase is not a valid
  EIP-55 checksum**, so this is a deliberate looseness, not an oversight.
- **Known stale comment.** The block above `validateEvmAddress` still says
  "Until a real keccak implementation is added… any mixed-case address is
  refused", and references an `EIP55_SUPPORTED` marker that does not exist in
  the file. That comment describes the pre-fix behaviour. The tests are the
  authority; the comment should be deleted. Tracked as `DEF-011`.
- Bitcoin and Solana validation is **format-only**. Solana does not decode the
  base58 payload to confirm a 32-byte ed25519 key length. Recorded as a known
  limit, not as done.

---

## ADR-006 — `packages/*` build to `dist/`, not source-only

**Status:** Locked (2026-10-06, reversed the foundation decision).

**Decision.** Every `packages/*` compiles with `tsc -p tsconfig.package.json` and
exposes `dist/index.js` + `dist/index.d.ts` through `exports`.

**Reason.** A package whose `main` points at `src/index.ts` works under a bundler
(Vite, Next) but not when Node loads the `.ts` directly. `services/api` is a
tsc-emitting Node service, so it hits this.

**Consequences.**
- The failure is **deferred and confusing**: single-file packages load fine via
  type stripping, so the problem only appears once a package gains a second file
  with a relative `.js` specifier. That is exactly what happened when
  `packages/blockchain` gained `address.ts` and `rpc.ts`.
- `turbo.json` gives `typecheck`, `test` and `lint` a `dependsOn: ["^build"]`.
  CI has an explicit `Build shared packages` step before `Typecheck`.
- **`README.md` and `docs/engineering/standards.md` still say "source-only, no
  build step".** They are wrong. Do not follow them.
- **Committed build artifacts.** `packages/types/src/` and
  `packages/design-tokens/src/` contain checked-in `.js`, `.d.ts`, `.js.map` and
  `.d.ts.map` files alongside the `.ts` sources. They are stale output from a
  `tsc` that once wrote into `src`. `.gitignore` ignores `dist/`, not `src/`.
  Nothing depends on them, and they will drift silently. Tracked as `DEF-010`.

---

## ADR-007 — Explicit `@Inject()` because esbuild omits decorator metadata

**Status:** Locked (2026-10-05, day one).

**Decision.** Every Nest injection site uses `@Inject(Service)`. Constructor
parameter types alone are never relied on.

**Reason.** Nest's CLI uses `tsc`, which emits decorator metadata. Vitest uses
esbuild, which does not. Explicit injection behaves identically under both.

**Consequences.**
- **This bug shipped broken inside Nest's own scaffold.** The foundation commit
  had to fix it.
- It is not theoretical: commit `2806012` found `RolesGuard` resolving
  `Reflector` implicitly. It worked under tsc and would have failed under
  esbuild — including under `tsx` and including in the contract test suite.
- `noUncheckedIndexedAccess` is set on `services/api/tsconfig.json`. It caught an
  unsafe array access within minutes of being raised. The bar was worth raising
  precisely because it had been silently lower.

---

## ADR-008 — Rate limiting fails closed

**Status:** Locked.

**Decision.** `RateLimitGuard` uses Redis `INCR`/`EXPIRE` with a fixed 60-second
window. On any Redis error the request is rejected with 429, never allowed
through.

**Reason.** Two reasons, both load-bearing:
1. Redis rather than an in-process counter, because a horizontally scaled API
   with per-instance counters is not rate limited at all — each instance allows
   the full budget, so N instances allow N times the limit.
2. Failing **closed** because an API that stops limiting when its cache is
   unavailable has invited exactly the traffic the limit exists to shed. Silently
   failing open is the more dangerous default of the two.

**Consequences.**
- Limits: `/auth/*` at 10/min, everything else at 120/min.
- `@SkipRateLimit()` opts a route out. `HealthController` is the only user.
- Response headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`,
  and `Retry-After` on rejection.
- Verified live before commit `5362c72`: 10×401 then 429, correct headers, and
  429 with Redis stopped.
- **Limits are data, not constants** (`8c48624`). `RATE_LIMIT_WINDOW_SECONDS`,
  `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_AUTH_MAX_REQUESTS` are read through
  `ConfigService`. `authMaxRequests` was added because the sign-in ceiling never
  had a knob — `RATE_LIMIT_MAX_REQUESTS` only ever described the general budget,
  so widening it for a bulk import widened credential stuffing's budget with
  nothing in `.env` to say so.
- **The bucket is the session, not the address** (`8c48624`).
  `session:<sha256(bearer)>` — byte-for-byte `Session.tokenHash` — falling back
  to `ip:<address>`. Deliberately *not* resolved through `SessionGuard` even
  though reordering looks like the fix: that guard returns early on `@Public()`
  routes and `POST /auth/login` has to be public, so reordering would leave the
  one route that most needs a per-identity budget bucketed by IP. It is also
  arithmetic rather than a lookup, keeping Redis failure and Postgres failure
  separate — a limiter that queries Postgres to decide admission has made the
  database a dependency of the thing protecting it.
- **Unit, not account.** One account with N sessions holds N budgets; session
  creation is authenticated, so this is bounded. Recorded here rather than
  treated as fine print, because "per user" is the natural misreading.

---

## ADR-009 — Two hand-written migrations, and why they are not in the schema

**Status:** Locked. **But see the drift warning below.**

**Decision.** `20261005150000_non_nullable_compound_uniques` was written by hand
and applied directly, rather than generated by `prisma migrate dev`.

**Reason.** Two latent integrity problems that `prisma migrate dev` reported no
drift for:

1. Prisma cannot target a nullable column in a compound unique selector, so
   `upsert`/`findUnique` on `(country, region)` and
   `(chainId, contractAddress, issuerId)` were both unusable at runtime.
2. Postgres treats NULLs as distinct in a unique index, so two native assets for
   the same chain and issuer were both insertable. That is a uniqueness hole in
   the registry — the one table where a duplicate means a user sees the wrong
   backing.

`''` is the sentinel for "does not apply": country-wide rule, native asset.

**Consequences.**
- `JurisdictionService.evaluate` looks up `country_region: { country, region: '' }`
  for the country-wide fallback. This is why an unmatched country denies.
- `services/api/src/assets/assets.mapper.ts` maps `row.contractAddress || null`. `services/api/src/blockchain/indexing.service.ts`
  selects native assets by `contractAddress: ''`.
- Running `migrate dev` against production would have left a fresh Neon database
  structurally different from local. Recorded in
  [`../operations/production-database.md`](../operations/production-database.md).
- **Drift warning — real, unresolved.** `services/api/prisma/schema.prisma` still declares
  `Asset.contractAddress String?` (line 369) and
  `JurisdictionRule.region String?` (line 637). The database has both as
  `NOT NULL DEFAULT ''`. The *code* matches the database; the *schema file* does
  not. `prisma migrate dev` would now generate a migration reverting both columns
  to nullable, which would reintroduce the uniqueness hole. Tracked as `DEF-003`, fixed in `7ad3d69`.

---

## ADR-010 — `@correnthian/contracts` so client types cannot drift from the API

**Status:** Locked (2026-10-06).

**Decision.** A Zod schema per response envelope lives in
`packages/contracts/src/schemas.ts`. The API validates its responses against it;
clients infer types with `Contract<'GET /x'>`. Neither side hand-writes a shape.

**Reason.** Three incidents in this repository had the identical shape: the admin
declared its own TypeScript interfaces, nothing compared them to what the API
actually returned, and every mismatch surfaced as a runtime bug in a browser
rather than a build failure.
- Portfolio valuation reading zero (`ce5a4a9`).
- The assets page 500ing on `issuerName` — the response is `{ asset, disclosure }`
  and the admin assumed a flat shape (`a6e0dbe`).
- The disable button rendering with an inverted label because `enabled` was
  never returned, so the destructive branch was unreachable (`4bc4e90`).

**Consequences.**
- `CONTRACT_REGISTRY` has 16 entries. `services/api/src/contracts.spec.ts` boots
  the real API against a real database, calls each endpoint, and parses the
  response. 27 tests.
- The suite **refuses to skip in CI**. A green build that quietly omitted the
  check would assert that drift is impossible while proving nothing, which is
  worse than having no check because the guarantee would be believed.
- The suite seeds its own fixtures. `GET /swaps/quotes` on an empty table returns
  `{ items: [], nextCursor: null }`, which parses perfectly — a schema assertion
  alone would pass against a route that always returns nothing.
- The suite resets the Redis rate-limit bucket before its first request, because
  every request shares one seeded identity's 120/min window.
- **Coverage is partial.** Sixteen of 71 route handlers are registered. See
  [`API_CONTRACTS.md`](API_CONTRACTS.md) for exactly what is and is not covered.
- **One drift still present:** `apps/admin/src/lib/types.ts` still hand-declares
  `AuditRow` and `QuoteStats` with a comment claiming they are "not yet in the
  contract registry". Both are in the registry. `dashboard/page.tsx` still
  imports the hand-written `AuditRow`. Tracked as `DEF-012`.

---

## ADR-011 — Jurisdiction is deny-by-default

**Status:** Locked.

**Decision.** A location with no matching active `JurisdictionRule` is
**denied**, not permitted by omission.

**Reason.** For a regulated financial product, unknown jurisdiction means stop
and ask. The inversion is the whole point of the module; getting it the other way
round would make the system permissive by omission, which is the failure mode
that matters here.

**Consequences.**
- `JurisdictionService.evaluate` denies a missing or non-two-character country
  immediately, and denies an unmatched or inactive rule.
- Region rules take precedence over country-wide rules.
- `assertEligible` **throws** rather than returning `false`. A blocked
  jurisdiction is a 451 carrying the reason, not a silent no-op a caller may
  ignore.
- Redemption is gated more strictly than a crypto swap, because selling physical
  metal is licensed activity in many US states.
- The development seed creates one `US` rule that permits buy/sell/metals and
  refuses redemption, marked `DEVELOPMENT ONLY`. It must be replaced with
  counsel-reviewed rules before any deployment.

---

## ADR-012 — Audit is an interceptor, not a call per method

**Status:** Locked (2026-10-06).

**Decision.** `AuditInterceptor` records every mutating HTTP request by
construction, rather than a hand-written `audit.record()` inside each service.

**Reason.** A per-service call gets forgotten the first time someone adds an
endpoint, and a silently unaudited admin mutation is exactly the failure an audit
trail exists to catch. The admin console states that changes are audited, so it
needs to be true by construction rather than by discipline.

**Consequences.**
- Registered globally in `core.module.ts`, after the guards — so `request.user`
  is already resolved.
- `/auth/*` is skipped because `AuthService` records sign-in attempts itself,
  where it knows whether the attempt succeeded. Recording them here would log a
  failure for every successful sign-in, which trains operators to ignore the
  trail.
- `AuditService.record` redacts metadata **on write**, not on read. An audit log
  is the one place a stray secret survives, because it is written deliberately.
- Audit write failures are swallowed deliberately: losing an audit line is bad;
  refusing a user's withdrawal because logging failed is worse.
- The list projection is explicit and withholds `metadata`; metadata is read one
  entry at a time through `GET /audit/:id`.

---

## ADR-013 — The admin was archived and re-scaffolded rather than patched

**Status:** Locked.

**Decision.** The first working admin was moved to `archive/admin-legacy/` and
the app was re-created with `create-next-app` followed by
`shadcn init --preset nova --base radix` and `shadcn add dashboard-01`. The
API-wired pages were then restored inside the new scaffold.

**Reason.** The original was `shadcn init`-ed into a `create-next-app` project
rather than built the way the docs specify for an existing monorepo.

**Consequences.**
- The documented `shadcn init -t next --monorepo` flow is **wrong for an
  existing monorepo** — it scaffolds a second monorepo, creating its own
  `apps/web`, `packages/ui`, `packages/eslint-config` and a nested `.git`.
  Correcting this required a commit of its own (`f58de62`).
- `archive/` is outside the pnpm workspace globs, so it is never built or
  typechecked. `git mv archive/admin-legacy apps/admin` restores it exactly.
- `components.json` records `"style": "radix-nova"`. Base is `radix`, not a
  default: `dashboard-01` ships Radix primitives, so `base-ui` or `aria` would
  surface as broken primitives mid-integration.
- **`TASK.md` links to `apps/admin/STUB-AUDIT.md`, which no longer exists** — it
  moved to `archive/admin-legacy/STUB-AUDIT.md`. The link is broken.
- Three defects the block ships on arrival, fixed here and worth knowing: it
  never mounts `TooltipProvider` (so `next build` fails prerendering), never
  mounts `<Toaster />` (so every `toast.promise()` is a silent no-op), and ships
  two `react-hooks/set-state-in-effect` lint errors.

---

## ADR-014 — Reference price and executable price are separate fields

**Status:** Locked.

**Decision.** A price is only usable with a source. Reference and executable are
distinct, the spread between them is never hidden, and stale is reported rather
than smoothed over.

**Reason.** A gold spot quote is a reference — what metal is notionally worth.
It is **not** what a user receives. The executable price is the reference plus
spread plus fees. Showing a user a spot price as though it were obtainable is the
single most damaging thing a metals product can do, because the gap is invisible
until settlement.

**Consequences.**
- `PricingService.record` refuses a price with no source: an unattributed number
  is a constant.
- `MAX_AGE_SECONDS = 300`. Beyond that a price is not shown as current.
- `latestMap` excludes stale prices from valuation rather than valuing on them.
- With no provider contracted, `executablePriceUsd` is `null` and the response
  carries the sentence explaining why.
- `PortfolioService` treats an unpriced holding as unpriced — neither zero nor
  last-known. The total is explicitly a floor, and `unpricedCount` is reported
  alongside it.

---

## ADR-015 — Redemptions refuse rather than fabricate

**Status:** Locked.

**Decision.** `RedemptionService.request` refuses unless the asset is genuinely
`redeemSupported` and enabled, the provider exists and is not disabled, and the
jurisdiction permits redemption. State advances only through an explicit
allowlist.

**Reason.** Redemption is Correnthian's most operationally exposed feature and the
one most likely to be quietly wrong. A skipped transition usually means two
operators disagree about what happened, so it is rejected rather than smoothed
over. Nothing auto-approves.

**Consequences.**
- `ALLOWED` transition map in `redemption.service.ts`: `requested` cannot jump to
  `delivered`; `delivered` and `rejected` and `cancelled` are terminal. Ten
  tests.
- The seed's development jurisdiction rule sets `canRedeem: false`, so even a
  correct request is refused in the default local environment.
- **The request path was dead in code.** `RedemptionController.request` passed
  `country: null, region: null` with the comment "resolved from the account
  record, never from the client" — but nothing resolved them.
  `evaluate(null, …)` denied unconditionally, so `POST /redemptions` always
  returned 451 despite being fully unit tested at the service layer.
  **Closed in `5a31c4b`:** the DTO carries no jurisdiction field at all, the
  service reads `country`/`region` off the account record as the comment
  always claimed, and `redemption.controller.spec.ts` exercises the controller
  against a live database. The trust rule above is therefore unchanged — a
  client still cannot claim a jurisdiction — it is simply enforced now.

---

## ADR-016 — Modifiers choose the shadcn preset; do not hand-write Radix imports

**Status:** Locked.

**Decision.** Add shadcn components through the CLI, with base `radix` and
style `radix-nova`. Do not add `@radix-ui/react-*` by hand — the unified
`radix-ui` package is the dependency.

**Reason.** Two things went wrong here and cost real time. `shadcn init` wrote
`--font-sans: var(--font-sans)` into `@theme inline` — a circular self-reference
that Tailwind v4 resolves at parse time to nothing, so every `font-sans` utility
became a silent no-op. It also wrote `--font-mono: var(--font-geist-mono)`, which
resolves at *runtime* and so never resolves at all. Both are fixed in
`apps/admin/src/app/globals.css` with literal family names.

**Consequences.**
- If a shadcn component ever disappears, restore it with the CLI. `alert-dialog`
  was lost in the re-scaffold and had to be put back with
  `npx shadcn@latest add alert-dialog -y` rather than by writing an import that
  pointed at a file which was not there.
- Radix `Select` is a client component and cannot participate in a no-JS GET
  form. The admin uses `Button`-as-link chips for filters that must work without
  JavaScript, and this was verified rather than assumed.
- Recharts cannot render in a server component, so the audit chart is split into
  `apps/admin/src/components/charts/audit-activity-chart.tsx`. shadcn's own block splits it the
  same way.

---

## ADR-017 — `apps/admin` types are inferred from contracts, with one exception

**Status:** Locked, with a known exception.

**Decision.** Admin response types come from `Contract<'GET /x'>` inferred off
`@correnthian/contracts`. Pages do not declare response types of their own.

**Reason.** See ADR-010. Three incidents, all silent at build time.

**Consequences.**
- `apps/admin/src/lib/types.ts` is the inference surface for shared types.
- Pages that need a page-local type declare it beside the page, still inferred —
  `quotes/page.tsx` and `audit/page.tsx` both do this.
- **Exception, still present:** `dashboard/page.tsx` imports a hand-written
  `AuditRow` from `lib/types.ts` even though `Contract<'GET /audit'>` exists.
  `QuoteStats` in `lib/types.ts` is dead — the quotes page declares its own.
  Tracked as `DEF-012`.

---

## ADR-018 — The API holds no provider credentials

**Status:** Locked.

**Decision.** Provider API keys live in the deployment secret store. The
`Provider` table stores a health-probe payload only. Chain RPC URLs are stored in
`Chain.rpcUrls` and are never returned by any API route.

**Reason.** Publishing RPC URLs invites a third party onto our metered quota; the
client resolves chains from its own configuration. Provider credentials must never
become a place a secret lands.

**Consequences.**
- `ChainsService` selects an explicit field list that omits `rpcUrls`. So does
  `BlockchainService.health`.
- `ProvidersService.setStatus` / `recordHealth` accept only a status or a probe
  payload. The admin providers table shows status and health and has no
  credentials column.
- `.env.example` names `METALS_PROVIDER_API_KEY`, `ONRAMP_PROVIDER_API_KEY`,
  `RPC_*` and a sandbox flag. **None of them is read by any code.** The seed
  registers providers as `disabled` with no capabilities, and there is no adapter
  that would use a key.

---

## ADR-019 — Deployments are gated on external partnerships, not on code

**Status:** Open.

**Decision.** No decision recorded. Two dependencies gate everything downstream:
the metals issuer/LP contract, and crypto/fintech counsel.

**Reason.** Both have lead times longer than the software work, and both change
what the software should be built to do.

**Consequences.**
- Counsel is needed **before design freeze**, because entity structure,
  money-transmitter analysis and CFTC-vs-SEC classification change how the buy
  flow is built. Design freeze is currently undated.
- The metals partner's terms decide redemption mechanics and fees.
- `verifiedTier` has a data model, a role gate and evidence requirements, but no
  verification *workflow*. The registry can assert `issuer_verified` about itself
  if a `compliance` operator sets it with the required evidence present and no
  evidence ever being checked. This is recorded as a process gap, not a code gap.

---

## ADR-020 — Notifications record intent and do not send

**Status:** Locked.

**Decision.** `NotificationsService` writes rows and exposes `claimBatch`,
`markSent` and `markFailed`. No transport is wired.

**Reason.** No delivery provider is chosen. Inventing a fake one would be worse
than leaving it unimplemented: a row that claims to have been emailed is a lie a
user could act on.

**Consequences.**
- **The claim is not atomic.** `claimBatch` is a `findMany` with no status guard
  and no update, despite its docstring describing "`updateMany` with a status
  guard… the loser matches zero rows". Two workers will receive the same rows.
  Tracked as `DEF-009`.
- No scheduler exists. Nothing calls `claimBatch`.
- `Notification.sentAt`/`failedAt`/`error` are the only delivery state.

---

## ADR-021 — The owner's product document widens two scopes the spec closed

**Status:** Open. Not adopted, not rejected — called out so it cannot be
implemented by accident.

**Decision.** Three deltas between the product document circulated 2026-10-07
and this repository's recorded scope are held open until a human calls them:

| # | Owner's document says | This repository records |
|---|---|---|
| 1 | Launch with **Ethereum, Bitcoin, BNB Chain, Polygon, Base, Arbitrum, Solana** | EVM slice first; **Bitcoin and Solana deferred by the v1 design spec**. Only an EVM adapter exists (`BE-301`). |
| 2 | Eventually **WalletConnect, DApp connections, DeFi, NFT platforms** | **Removed from scope by the design spec.** `CexRail` is reserved and must stay reserved. |
| 3 | **Seed-phrase import and recovery**, PIN, biometrics, multi-account | `BE-203b` seed-account recovery is `BLOCKED` on a decision: guardians have no BTC/SOL equivalent. |

**Reason.** The document is the owner's; the spec is the repository's. Neither
outranks the other silently, and three separate recorded decisions currently
point the other way. Recording the disagreement is cheaper than discovering it
after an adapter has been built.

**What the document *confirms* — no conflict:**
- Correnthian does **not** hold private keys. Same as ADR-001, unchanged.
- External issuers provide the metal; Correnthian is a thin aggregator taking
  stated fees. Same as the v1 spec.
- **Admin never sees user keys**; public addresses only.
- **A Correnthian account is not custody of a wallet.** Server-side profile
  (preferences, devices, KYC) is a different thing from wallet ownership.
- Fiat on-ramp/off-ramp through third parties, not Correnthian becoming a bank.

**What the document adds that this repository has never tracked:**
gas sponsorship / account abstraction; spending limits and transaction
approvals; connected-device and DApp connection management; security alerts;
admin support tickets; a user-facing feature-by-country surface; platinum and
further metals. Each is now a `BACKLOG` entry in
[`BACKEND_TASKS.md`](BACKEND_TASKS.md) rather than an omission — see `BE-603`,
`BE-204`, `BE-205`, `BE-1506`, `BE-1106`, `BE-402`.

**Consequences.**
- **Nothing in this table may be built until it is called.** An agent that reads
  the product document and starts a Bitcoin adapter is working against three
  recorded decisions.
- Deltas 1 and 2 are *scope* questions for the owner. Delta 3 is partly a
  *safety* question: seed handling on a client that also serves a custodial
  server touches the boundary rule, and ADR-001 has no exception for it.
- The work that is unaffected by all three — asset registry, jurisdiction
  gating, fees, transactions, compliance — can proceed regardless of the call,
  because none of it is chain-specific.
- If delta 1 is called, the EVM slice is still the right first adapter: it is
  the one already verified against a live network, and the `BlockchainAdapter`
  interface is what the other chains would implement.
