# CHANGELOG

Reconstructed from `git log`. The repository has no releases yet; every entry
is a commit, and the significant ones carry what the commit message recorded
about *why* — which is the part that otherwise rots.

Entries are in reverse chronological order within each date. Commit hashes are
abbreviated. Read the full message with `git show <hash>`.

**The repository has no remote**, so nothing here has been pushed anywhere.

---

## 2026-10-06

### `ec328ad` — Make financial POSTs idempotent, durably and across instances
- A user presses Buy, the network is slow, the press registers twice. That was
  two purchases. `Idempotency-Key` is now honoured on `POST /swaps/quotes`,
  `POST /redemptions` and `POST /onramp/quote`.
- The record lives in Postgres, not Redis. Redis is flushed and evicted for
  reasons unrelated to money, and an idempotency store that forgets is worse
  than none, because the retry it was supposed to absorb re-executes.
- Concurrent duplicates are serialised by `INSERT ... ON CONFLICT DO NOTHING`
  against a unique index, not by a lock. Two replicas mean two mutexes, and a
  mutex only convinces the process holding it. Proved with six simultaneous
  duplicates across two application instances.
- Three refusals, all of them safe: a different body under the same key is a
  conflict rather than a replay; a claim whose instance died is
  `outcome_unknown` and does not re-execute; a failing handler drops its claim so
  a retry is a real retry.
- The key is never persisted in a recoverable form (`sha256(actorId + key)`), is
  censored in pino, and is never echoed in a refusal.

### `0563b85` — Version the API under /api/v1, with a version registry and honest 404s
- Every route is now `/api/v1/...`; `/health` and `/docs` stay unversioned,
  because an orchestrator's probe must keep working for as long as the process
  does and must not require version negotiation.
- The version lifecycle is data (`src/versioning/api-versions.ts`): `current`,
  `deprecated` or `retired`, with a sunset date. Deprecated versions are still
  served unchanged and announce themselves on every response; retired ones return
  410 naming the successor. Retiring is a human editing `status`, not a date
  comparison.
- `/api/v2/assets` and a missing asset are both 404 and mean opposite things.
  They now carry different codes, and both name the versions that exist.
- The unversioned alias answers until 2026-12-01 so the in-flight admin
  integration is not broken, and announces its own removal on every response.
- Found while doing it: `RateLimitGuard` and `AuditInterceptor` both matched
  `/auth/` as a URL prefix, which silently stopped matching the moment a prefix
  existed. Every login would have moved onto the 120/minute budget — the budget
  credential stuffing is not meant to have — and sign-ins would have entered the
  audit trail the interceptor deliberately excludes.

### `2be6499` — Fix two issues that would have left CI red
- `turbo.json` had no `globalPassThroughEnv`. Turbo's strict env mode strips
  anything undeclared, so the contract suite booted the API with no database and
  reported the wire format as broken when nothing was wrong with it.
- `CONTRACT_TEST_EMAIL` / `CONTRACT_TEST_PASSWORD` were declared only on the
  Seed step, which creates a *different* account from the one the Test step
  authenticates as. CI authenticated as an account it had never created and
  failed in a way that looked like a contract regression.

### `0dd5c98` — Wire quotes and audit, with the endpoints they were missing
- Added `GET /swaps/quotes`: filterable by state and rail, **keyset paginated**
  with a cursor carrying both halves of the sort key. `createdAt` alone is not
  unique, so a bare `createdAt < cursor` predicate silently skips or repeats a
  row at every page boundary — a data-integrity bug in a list used to reconcile
  money. An unreadable cursor is a 400, not a silent restart at page one.
- Audit gained `GET /audit/:id`, an outcome filter and `actorEmail`. `metadata`
  is withheld from the list and returned only on detail.
- Contract suite extended to 27 tests, proven to run, and **mutation-tested**:
  disabling the state filter, and separately ignoring the cursor, each failed
  exactly the tests claiming to cover them.

### `3b02c8e` — Give quotes and audit a row-level view in the admin
- Both pages read only counters, so the reason an operator opens them was not
  available at all.
- Asset symbols and the provider name are resolved **server-side**: a console
  that joins three tables to render one table cannot tell "this quote has no
  provider" from "we forgot to look one up".
- Fixed three things needed to make it provable: fixtures seeded rather than
  assumed, the Redis rate-limit bucket reset before the first request, and
  `turbo.json` passing `DATABASE_URL`/`REDIS_URL` through.

### `9bcce29` — Wire dashboard, assets and issuers pages
- The disclosure string is rendered verbatim, in a full-bleed band, never
  rebuilt client-side.
- `synthetic — not metal` and `never attested` are real badges, not grey text.
- The dashboard's needs-attention section names the checks it could not read
  rather than rendering an all-clear after a partial failure.
- The assets page requests 200 rather than the API default of 50, and says so
  when the list is full, instead of silently truncating a registry.

### `400961e` — Wire users, devices, chains and providers pages
- Devices now requests `includeRevoked=true`. Without it the API hides revoked
  rows entirely, so a revoked device could never be shown as revoked — only as
  an absence indistinguishable from never having had one.
- Degraded providers take the destructive tone, not secondary: a degraded rail
  is still offered to users.
- A smart account not yet deployed says "not yet" with a tooltip. It must never
  read as live.
- Verified rather than assumed: the shadcn `Select` renders a hidden native
  select, so a no-JS GET form submission works.

### `419fca5` — Fix the three blockers the page agents surfaced
- `apps/admin/package.json` never declared `@correnthian/contracts`, so every
  contract-derived type resolved to an error type and collapsed to `any`. That
  is why six pages reported implicit-`any` on `.map()` callbacks that looked
  entirely ordinary.
- `api-state.tsx` imported `./retry-skeleton` and `./retry`, neither of which
  exists after a rename.
- `confirm-action.tsx` imported `@/components/ui/alert-dialog`, dropped in the
  re-scaffold. Restored via the sanctioned CLI.
- `API_URL` was undocumented and defaulted to the admin's own port.

### `c672703` — Rebuild dashboard, assets and issuers on the shadcn shell
- Root cause was not the page code: the missing `@correnthian/contracts`
  dependency. Declaring it made all six page-level errors disappear at once.
- Not verified in a browser: the dev server could not start (port conflict) and
  every endpoint is deny-by-default.

### `a0f7643` — Rebuild users, devices, chains and providers on shadcn
- Five pages had type errors because the API's response shapes had moved under
  the contract-driven typing and the pages were still written against the old
  shapes.
- `alert-dialog.tsx` restored via the CLI rather than added as a new dependency.

### `961c1a5` — Restore the real admin behind the sidebar-08 shell
- Reinstated the API-wired admin inside the new shadcn scaffold. Components
  grouped by role rather than the block's flat names.
- Navigation deliberately flat; `sidebar-08`'s collapsible sub-groups dropped.
- All demo content gone: the Acme Inc brand, the shadcn user, the missing
  `/avatars/shadcn.jpg`, the `#` links, and every mock row from both blocks.

### `f58de62` — Re-scaffold admin via the documented shadcn flow
- **Correction to an earlier claim:** the docs' `init -t next --monorepo` flow
  is wrong for an existing monorepo. It scaffolds a *second* monorepo, creating
  its own `apps/web`, `packages/ui`, `packages/eslint-config` and a nested
  `.git`. `create-next-app` followed by `shadcn init` is the correct path.
- Base is `radix`, not a default: `dashboard-01` ships Radix primitives.
- Three defects in the shipped block fixed: missing `TooltipProvider` (which
  broke `next build` outright), the circular `--font-sans` self-reference, and
  two `react-hooks/set-state-in-effect` errors.

### `b139afc` — Archive the first admin implementation
- Moved `apps/admin` to `archive/admin-legacy` so it could be re-scaffolded the
  way the docs specify. 61 source files and the full stub audit preserved.

### `c56874e` — Add `BlockchainAdapter`, an EVM implementation, RPC failover and indexing
- The wallet can read a real chain. Everything above the adapter stays chain
  agnostic, so Bitcoin and Solana mean implementing one interface.
- Signing deliberately absent: Correnthian's servers hold no key, so a signed
  payload would be a lie about the architecture.
- `RpcPool` fails over per request and quarantines a failing endpoint for 30 s;
  if everything is quarantined it still tries them all, because a
  single-endpoint chain must not go permanently offline after one blip. Ten
  tests.
- **Verified against live Sepolia:** block 11,852,696 read, a real balance
  fetched, and `POST /blockchain/wallets/:id/sync` indexed
  61.060896814128264732 ETH. The portfolio correctly reported it as *unpriced*
  rather than valuing it at zero.
- **Closes the EIP-55 gap.** Checksum verification now uses viem's real
  keccak-256. The old test asserted the pre-fix behaviour — that mixed-case was
  refused — and was updated to assert verification instead.

### `db8970b` — Wire the contract test into CI so it cannot silently skip
- The suite skipped whenever `DATABASE_URL` was absent. In CI that is the
  dangerous direction: a green build that quietly omitted the check would assert
  that drift is impossible while proving nothing.
- CI gained real Postgres 17 and Redis 7 service containers. Mocks would not do
  — the test boots the actual API and asserts its actual responses.
- Verified both directions: `CI=true` with no database → 13 failures, exit 1;
  no `CI` with no database → 15 tests skipped, local fast tests still pass.

### `2806012` — Add wire-format contracts so client types cannot drift from the API
- Three incidents, one shape: the admin hand-wrote its response types, nothing
  compared them to what the API returned, and each mismatch surfaced as a broken
  page rather than a failed build.
- It caught three real problems on first run:
  - `RolesGuard` resolved `Reflector` implicitly — works under `tsc`, fails
    under esbuild. The exact rule written into `CLAUDE.md` and then violated.
  - `GET /users/:id` omitted the `_count` the list endpoint returns, so a field
    vanished moving from table to detail view.
  - The first version of the asset contract put `category` at the top level when
    the domain type nests it under `display`.
- Verification: 79 API tests including 14 contract tests, 18 workspaces
  typechecking and building.

### `4bc4e90` — Wire admin mutations, and fix the two bugs that made one unreachable
- Server actions for user role and status, asset enable and attestation, issuer
  verification, risk flags and licences, provider status, chain enable.
- **The admin could never disable an asset.** `enabled` was never on the domain
  `Asset` type, so the API never returned it, so `enabled ? <Disable> : <Enable>`
  always took the Enable branch.
- **An issuer could never be verified.** Licence evidence was settable only at
  creation, so an issuer created before its licences were known could never
  satisfy the verification gate. Added `PATCH /issuers/:slug/licences`.
- Writing that endpoint surfaced a subtler bug: an explicit empty array was
  treated as "field omitted", so clearing evidence was a silent no-op and the
  downgrade safety net could never fire.

### `a6e0dbe` — Add device, issuer, chain and provider admin pages
- `GET /devices` is self-scoped, so the admin had nothing global to show. Added
  `GET /devices/all` and `GET /devices/stats` behind `support`.
- Fixed a shape mismatch caught by rendering rather than by types: `/assets`
  returns `{ asset, disclosure }`, so issuer and backing live one level deeper
  than the page assumed. **The admin's TypeScript declared the flattened shape,
  so it typechecked clean while 500ing in the browser.**

---

## 2026-10-05

### `ce5a4a9` — Fix portfolio valuation: surrogate and domain asset ids were mixed
- `AssetPrice.assetId` is a foreign key to the surrogate `Asset.id`;
  `Asset.assetId` is the domain identifier. `latestMap` filtered on the
  surrogate and the portfolio passed it the domain id, so the query never
  matched.
- **The failure mode is why this is worth a note: it is silent.** No error, an
  empty map, and a portfolio that looks plausible at zero rather than obviously
  broken. The pricing test passed because the mock accepted any id.

### `5362c72` — Add issuers, wallets, pricing, portfolio and rate limiting
- Issuers unblocked asset registration, which previously had no API path.
  `issuer_verified` is refused without a custodian, proof of reserves and
  recorded licences, and the tier propagates to every asset from that issuer.
- Wallets is the product's first vertical slice: public addresses only, validated
  on the way in, guardians refused on seed accounts.
- Pricing keeps reference and executable distinct; with no provider contracted,
  executable stays `null` and says why.
- Rate limiting is Redis-backed and fails closed. Verified live: 10×401 then
  429, correct headers, and 429 with Redis stopped.
- **Fixed a build defect the new packages exposed.** `packages/*` were
  source-only, which works under Vite and Next but not for `services/api`, a
  tsc-emitting Node service. The failure was deferred and misleading, because
  single-file packages load fine via type stripping. All packages now build to
  `dist`.

### `240e663` — Return a self-describing object from the on-ramp availability check
- It returned a bare string, which Nest serialises as `text/html` with no
  content type an API client can rely on, and `null` when available.
- Caught by inspecting the **body** rather than trusting the status code: the
  route was returning 200 the whole time.

### `c51e0a4` — Add metals, notifications and on-ramp modules
- Every module refuses rather than fabricating, because the metals partner is
  not contracted.
- Redemption checks live in the service rather than being trusted. State
  transitions are an explicit allowlist; nothing auto-approves.
- Live verification confirmed the new routes are auth-guarded, redemption
  refuses a non-redeemable token, and the audit interceptor logs the failed
  redemption as a **failure** rather than a success.
- Also fixed: `/onramp/availability` was not `@Public()` — the same miss as the
  compliance eligibility route earlier.

### `3484f27` — Document Neon provisioning and the local dev stack
- Two migration hazards specific to going live: never run `migrate dev` against
  production, and verify the hand-written non-nullable corrections actually
  landed, because `migrate dev` reported no drift.
- Neon provisioning is blocked on the account owner.

### `b4aee28` — Run the API against a real database and fix what that exposed
- Docker Compose stack on host ports 5433/6380 (5432 is held by another
  project).
- **Four real bugs that typecheck and mocked tests could not have caught:**
  - Prisma cannot target a nullable column in a compound unique selector, and
    Postgres treats NULLs as distinct — so duplicate native assets for one chain
    and issuer were both insertable. A uniqueness hole in the registry.
  - `AssetsService` wrote the issuer *slug* into the column referencing
    `Issuer.id`, violating the foreign key.
  - `ChainsService` selected a field that does not exist; every `/chains` call
    500d.
  - `/compliance/eligibility` was not `@Public()`.
- Config also had to be loaded at bootstrap — `node dist/main.js` reads no
  `.env`.
- Audit became structural: an interceptor records every mutating request by
  construction. The admin stated that changes are audited and it was not true.

### `4e90a49` — Rewire the admin to real API data
- Every mock replaced with live data. Deleted: `data.json` (68 rows),
  `data-table.tsx`, `chart-area-interactive.tsx` (91 frozen rows),
  `section-cards.tsx`, `nav-documents`, `nav-secondary`. The chart was removed
  rather than rewired, because no equivalent metric series existed and
  synthesising one would reproduce the original defect in a new file.
- Bearer tokens are held in an httpOnly cookie. `localStorage` was rejected.
- Failure states are the substantive part: `apiFetch` distinguishes five
  outcomes and every page routes through `ApiState`.
- **Not verified:** no Postgres or Docker, so nothing was exercised against live
  data. The failure states are typed and rendered but had never been seen.

### `63f7279` — Add chains, providers, audit, swaps and jurisdiction modules
- Jurisdiction is deny-by-default; an unmatched location is not allowed by
  omission. Seven tests.
- Quotes record disclosure, not fiction: `executionQuality: 'none'` and a zero
  output amount rather than a fabricated executable price.
- RPC URLs are never returned by the API; provider health stores a probe payload
  only.
- Audit metadata is redacted **on write**, not on read.

### `7a34340` — Make the key boundary enforceable, and fix rail selection
- **Three defects found by the documentation pass, all real code problems:**
  - `selectRail()` returned the first rail that supported the pair, so the
    single most important execution decision in v1 depended on registration
    order. Now an explicit `RAIL_PREFERENCE` with six tests.
  - The key boundary was enforced only by convention. Added
    `scripts/check-key-boundary.mjs`, which walks the transitive workspace graph.
    Verified against an injected violation rather than assumed. The existing CI
    job guards credentials in env files — a different property — and was renamed
    `credential-scan` because its name invited the conflation.
  - `services/api/tsconfig.json` did not set `noUncheckedIndexedAccess` while
    root and `packages/*` did. Raising it immediately caught an unsafe array
    access in a test written minutes earlier.

### `5d9d038` / `6e24ceb` — Documentation sets
- Ten documents across product, architecture, engineering, compliance and
  operations, written from the design spec rather than paraphrasing it.
- Recorded as open rather than guessed: the metals issuer, whether physical
  redemption is in v1, how the Correnthian fee is denominated, whether seed
  accounts recover at all, and when design freeze actually is.
- Three findings worth acting on: `SeedAccount` has no path to the specified
  recovery model; the boundary was "enforced structurally" only by convention;
  and `verifiedTier` had no verification workflow behind it.

### `34686b6` / `3fcbedc` — First admin app
- Next.js 16 + Tailwind v4 + shadcn `dashboard-01`.
- Block defects fixed on arrival: missing `TooltipProvider`, unmounted
  `<Toaster />`, the `.dark` palette shipped but never applied, two lint errors.
- `STUB-AUDIT.md` recorded every mock with its file and value, because the block
  ships zero `TODO` markers.

### `40da1f1` — Build the API data layer, identity and asset registry
- Prisma 7.10.0 with a schema carrying the security invariant at the top.
- Prisma 7 moved the connection string into `services/api/prisma.config.ts` and requires an
  explicit driver adapter.
- `@correnthian/config` validates once at boot and fails fast, naming the
  environment variable rather than the internal path.
- Argon2id; sessions store only a SHA-256 digest. Seven tests.
- Session and role guards registered globally: a route is authenticated unless
  explicitly `@Public()`.
- Asset identity derived from `(chain, contract, issuer)`, never accepted from
  the caller.
- **Known gap at the time:** migrations and integration tests could not run — no
  Postgres or Docker in that environment. The first real migration was unproven.

### `ef50022` / `d96c9a5` — Coordination surface
- `CLAUDE.md`, `TASK.md`, the documentation structure, and the rule that
  worktrees are never committed.
- Configured `worktree.baseRef=head`, since the repository has no remote and
  would otherwise branch worktrees from a non-existent `origin/main`.

### `893a10c` — Initial commit: Correnthian monorepo foundation
- pnpm + Turborepo: three apps, one NestJS service, twelve shared packages.
- Decisions encoded: thin-aggregator posture; the DEX→provider rail reversal;
  asset identity as `(chain, contract, issuer)`; `sizeCap` and
  `executionQuality` so honest failure is representable in the type; ERC-4337
  smart accounts with passkeys and social recovery for EVM, seed phrase for
  BTC/SOL only; keys never reach the backend.
- **Two upstream defects fixed on arrival:** Nest's scaffolded test was broken
  because vitest uses esbuild, which does not emit decorator metadata — switched
  to explicit `@Inject()`. Nest 12 shipped vitest 4 against a hoisted vite 5.
- Verification: 16/16 typecheck tasks, 4/4 builds, 18 tests.

---

## What has never changed

- **No release has been tagged.** There are no version numbers beyond the
  `0.1.0` in the manifests.
- **Nothing has been deployed.** `infrastructure/` contains a local
  docker-compose file and nothing else.
- **The repository has no remote.**
- **A wallet has never held real funds.**