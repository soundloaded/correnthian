# BACKEND_TASKS

The single source of truth for what Correnthian's backend has, has half of, and
has not got. `TASK.md` at the repository root points here.

Verified against the repository at `50cb8a1` (2026-10-07). Plan section numbers
(`plan §N`) refer to `node_modules/plan.txt`, the backend master plan.

**Statuses:** `DONE` · `PARTIAL` · `BACKLOG` · `OPEN` · `READY` ·
`IN_PROGRESS` · `BLOCKED` · `REVIEW` · `TESTING`

Plan §67 defines none of `DONE`'s neighbours `PARTIAL`, `BACKLOG` or `OPEN`.
`PARTIAL` in particular is load-bearing: it is the only value that can say
"exists, is guarded, and still does not work", which is the honest state of
twenty tasks here. Without it, status collapses into `DONE` and this file
starts lying.

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

### Where they stand on 2026-10-07

Re-verified against the code, not against this file. The tracker had every one
of these marked `BACKLOG` while four were already fixed, because the fixes
landed after this section was last written. Each status below was checked at
the location the entry names.

| Status | Defects | Count |
|---|---|---|
| `DONE` | `DEF-001` … `DEF-017`, `DEF-019` | 17 |
| `PARTIAL` | `DEF-009` | 1 |
| `BACKLOG` | `DEF-018` | 1 |

`DEF-018` was found while re-verifying the others, and `DEF-019` while fixing
`DEF-004` / `DEF-005`. Both were recorded rather than assumed, because tracking
work that is not yet done is the point of this file.

**One that was previously recorded as fixed is not.** `DEF-015` reads as fixed
if you look only at the comment above `users.list`, which claims keyset
pagination while the code beneath it paginates on the primary key. It remains
`BACKLOG`.

### DEF-001 — `POST /redemptions` can never succeed
_Fixed in `5a31c4b`. The description below is what was wrong and is
kept for the record; it does not describe the current code._


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
- **Status:** `DONE` — fixed in `5a31c4b`. Re-verified 2026-10-07: the DTO carries no jurisdiction field, the comment is no longer a claim about code that does not exist, and `redemption.controller.spec.ts` exercises the controller against a live database (7 tests).

### DEF-002 — `RedemptionService.transition` writes a column that does not exist
_Fixed in `5a31c4b`. The description below is what was wrong and is
kept for the record; it does not describe the current code._


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
- **Status:** `DONE` — fixed in `5a31c4b`. Re-verified 2026-10-07: `reviewedBy` is a column on the model (`schema.prisma:305`), a migration adds it, and the controller spec asserts the row rather than the response. `scripts/check-prisma-writes.mjs` was added as the permanent answer to the whole class — see `DEF-018` for its current state.

### DEF-003 — `services/api/prisma/schema.prisma` has drifted from the database
_Fixed in `7ad3d69`. The description below is what was wrong and is
kept for the record; it does not describe the current code._


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
- **Status:** `DONE` — fixed in `7ad3d69`. Re-verified 2026-10-07: `prisma migrate diff --from-schema … --to-config-datasource` reports *No difference detected*, and `prisma migrate status` reports 7 migrations applied. The uniqueness hole cannot be reintroduced by `migrate dev`.

### DEF-004 — Rate limiting ignores its own configuration

- **Location:** `services/api/src/common/guards/rate-limit.guard.ts`
- **Was:** `RATE_LIMIT_WINDOW_SECONDS` and `RATE_LIMIT_MAX_REQUESTS` are
  validated by `packages/config` and documented in `.env.example`, but the guard
  hardcoded `WINDOW_SECONDS = 60` and `{ auth: 10, api: 120 }`. Setting them
  changed nothing.
- **Fixed in `8c48624`.** The guard reads all three through `ConfigService`, and
  `rateLimit.authMaxRequests` was added to the config schema as
  `RATE_LIMIT_AUTH_MAX_REQUESTS`.
- **The addition matters:** there was never a knob for the sign-in ceiling at
  all. `RATE_LIMIT_MAX_REQUESTS` only ever described the general budget, so an
  operator raising it for a bulk import also widened the budget credential
  stuffing runs against, with nothing in the environment to say so. The two are
  now deliberately separate settings, and `.env.example` says why.
- **Acceptance criteria:** each limit changes at runtime through config.
  Verified against a running API with
  `RATE_LIMIT_MAX_REQUESTS=7 RATE_LIMIT_AUTH_MAX_REQUESTS=3
  RATE_LIMIT_WINDOW_SECONDS=45`: the headers answered `7`, `3` and `45`
  respectively, where the old code answered `120`, `10` and `60`.
- **Tests:** 5 unit tests in `rate-limit.guard.spec.ts`, 4 config tests, and
  3 live assertions in `rate-limit.live.spec.ts`. All fail against the
  pre-fix guard.
- **Status:** `DONE`


### DEF-005 — The rate limiter can only bucket by IP

- **Location:** `services/api/src/common/guards/rate-limit.guard.ts`
- **Was:** the guard's comment claimed "the authenticated identity is the bucket
  where we have one", but `RateLimitGuard` is registered *before* `SessionGuard`
  and Nest runs global guards in registration order, so `req.user` was always
  `undefined` when the key was computed. One office behind one NAT address
  shared a budget; one client rotating addresses got a fresh one per request.
- **Why reordering does not fix it** — and this is the part that makes the
  defect interesting rather than clerical. `SessionGuard` returns early on
  `@Public()` routes, and `POST /auth/login` must be public, because you cannot
  require a session in order to obtain one. Reordering would therefore fix
  exactly the routes that do not need fixing and leave credential stuffing —
  the route that most needs a per-identity budget — bucketed by IP precisely
  because it has no session to be identified by.
- **Fixed in `8c48624`.** The guard reads the `Bearer` header itself:
  - token present → `correnthian:rate:<bucket>:session:<sha256(token)>`, which
    is byte-for-byte `Session.tokenHash`
  - token absent → `correnthian:rate:<bucket>:ip:<address>`

  No lookup and no I/O: `hashSessionToken` is arithmetic, so the limiter stays
  independent of the database it exists to protect. Resolving the user instead
  would have made Redis failure and Postgres failure one failure mode.
- **Stated consequence, not hidden:** the unit is the session, not the account,
  so one account holding N sessions holds N budgets. Session creation goes
  through authenticated flows, so this is bounded and is not amplification an
  unauthenticated client can reach for.
- **Acceptance criteria:** one identity holds one budget across addresses, and
  two identities hold separate budgets behind one address. Both verified against
  a running API with `TRUST_PROXY=true` and differing `X-Forwarded-For`:
  one token went `6 → 5` across two addresses (shared), two tokens from one
  address went `6` and `6` (separate). The Redis key was then matched against
  Postgres: `Session.tokenHash` matched in 1 of 143 sessions.
- **Tests:** 6 unit tests and 4 live assertions. All fail against the pre-fix
  guard, which produced no `session:` key at all.
- **Status:** `DONE`


### DEF-006 — Readiness probe never returns 503

- **Location:** `services/api/src/health/health.controller.ts`
- **Was:** the docstring said "Fails with 503 when a required dependency is
  down so traffic is diverted, not dropped." The handler returned
  `{ status: 'degraded', … }` with HTTP 200, so an orchestrator reading only the
  status code kept routing traffic to a process that could not serve it.
- **Fixed in `7be8a6c`.** The status is set through `@Res({ passthrough: true })`
  rather than by throwing, because `AllExceptionsFilter` rewrites any exception
  into the shared envelope — throwing would have returned 503 with
  `dependencies` replaced by `detail`, and every consumer reads `dependencies`
  to know *which* dependency is down. Diverting traffic must not cost the
  operator the reason.
- **Decision made:** 503 was the right answer, so the docstring stayed and the
  code was corrected. Both dependencies are required — with Redis down the rate
  limiter fails closed and refuses everything, so the process genuinely cannot
  serve.
- **Liveness deliberately unchanged,** now asserted: a dependency outage must
  pull the process from rotation, not make an orchestrator restart a healthy
  process.
- **Verified live against the running API**, not only in tests: both up → 200;
  Redis stopped → 503 with `redis: down` while `/health/live` stayed 200 in the
  same window; Redis restored → 200. 9 controller tests cover the failure
  paths with stubbed dependencies, because forcing a real outage to observe one
  503 would be testing the environment rather than the handler.
- **Status:** `DONE`


### DEF-007 — Missing wallets return 500, not 404 · `DONE` (`8b4d408`)

- **Was:** `portfolio.service.ts` `forWallet` threw a bare
  `new Error('Wallet not found')`. `AllExceptionsFilter` classifies a plain
  error as internal, so a missing wallet was a **500** — conflating "you asked
  for something you cannot have" with "we are broken". Not a leak (the message
  is generic), but the wrong signal.
- **Fixed:** `AppError.notFound('Wallet not found')`, scoped by
  `{ id, userId }` so another user's wallet is the same missing wallet — one
  message, one status, no existence oracle.
- **Status:** `DONE`

---

### DEF-008 — Portfolio balances are converted with a float · `DONE` (`8b4d408`)

- **Was:** `Number(a.balanceRaw) / 10 ** a.asset.decimals`, three lines below a
  comment reading "Base units to a human number, via string arithmetic — never a
  float multiply on an 18-decimal balance." `Number()` on an integer above
  `2^53` drops digits, and an 18-decimal token reaches that at 0.9 of a token.
- **Fixed:** valuation runs through `notionalUsd(balanceRaw, decimals, priceUsd)`
  and sums with `sumUsd` — the same bigint arithmetic the fees engine uses.
  `054fdb9` gave fees exact money; the portfolio was floating the same numbers,
  and two notions of a dollar cannot coexist into `BE-1602`.
- **The float enters at exactly one place**, `priceAt`, because
  `PricingService.latestMap` already returns `Number(row.priceUsd)` off a
  `Decimal`. That conversion is named rather than implied; a price that cannot
  be represented becomes `unpriced` — this module's existing vocabulary for
  "cannot value this" — instead of throwing the portfolio away on one bad row.
- **Severity, stated honestly:** a search for an input where the old path
  disagrees with the exact one **found none between $1 and $100,000** — both
  produce the same 8 decimal places. Divergence appears above `$10^15` and in
  sub-cent holdings. This was a real correctness bug and a live lie in a
  comment, **not** a wrong number anyone was shown.
- **Wire change:** `valueUsd`, `totalUsd`, `pricedValueUsd` and `combinedUsd`
  are now decimal `string`. `GET /portfolio` has no contract, no consumer and
  no test, so nothing was reading the old numbers.
- **Status:** `DONE`


### DEF-009 — `claimBatch` does not claim · `PARTIAL`

- **Location:** `services/api/src/notifications/notifications.service.ts`
- **Was:** the docstring described "`updateMany` with a status guard… the loser
  matches zero rows". The implementation was a plain `findMany` with no update
  and no guard, so two workers received the same rows — a comment and a code
  describing two different programs.
- **Done:** the docstring now describes what the code actually does, and says
  why. The lie is gone; nothing in the repository now promises a guarantee the
  code does not make.
- **Still open, and deliberately so.** Making it claim needs a column:
  `Notification` has only `sentAt`, `failedAt` and `error`, so there is nothing
  to write a claim into. The obvious `claimedAt` fix is a **lease with no
  expiry** — a worker that dies mid-batch leaves those rows claimed forever, and
  a notification that is never sent is a harder failure than one sent twice,
  because the second is visible and the first is silent. A real claim needs a
  timeout, a requeue path, and a decision about idempotent delivery.
- **Those are design questions belonging to ADR-020's transport decision**, not
  to a method nothing calls: no scheduler job invokes it and no transport is
  wired. Building a leasing mechanism for dead code would be speculative design
  presented as a fix.
- **Status:** `PARTIAL` — the comment is honest; the claim mechanism is not
  built, and is gated on the transport decision.


### DEF-010 — Committed build output inside `packages/*/src`

- **Location:** `packages/types/src/`, `packages/design-tokens/src/`
- **Description:** `.js`, `.d.ts`, `.js.map` and `.d.ts.map` files are checked in
  next to the `.ts` sources (`git ls-files` confirms 20 such files). They are
  stale output from a `tsc` that once emitted into `src`. `.gitignore` ignores
  `dist/`, not `src/`. Nothing imports them, and they will drift silently.
- **Expected output:** `git rm` them and add `src/**/*.js`, `src/**/*.d.ts` to
  `.gitignore`.
- **Status:** `DONE` (`9403bab`) — 20 artifacts removed; `packages/*/src/**/*.{js,d.ts}` and their maps are now gitignored while `.ts` stays visible, and no source references the deleted paths.

### DEF-011 — Stale EIP-55 doc comment

- **Location:** `packages/blockchain/src/address.ts`, above `validateEvmAddress`
- **Description:** the comment says mixed-case addresses are "refused, because
  it is asserting a checksum we have no way to confirm", and references an
  `EIP55_SUPPORTED` marker that does not exist in the file. Verification *is*
  implemented below it via viem's `keccak256`. A duplicated comment block also
  sits above `keccak256Hex`.
- **Risk:** an agent reading the comment will believe mixed-case addresses are
  rejected, and may "restore" behaviour that is now a bug.
- **Status:** `DONE` (`00b095a`) — the comment now states the rule EIP-55 actually has and that it is exercised against the canonical vectors; the orphaned one-liner was rehomed onto `toChecksum`. `EIP55_SUPPORTED` and the TODO no longer appear anywhere in source.

### DEF-012 — Hand-written admin response types

- **Location:** `apps/admin/src/lib/types.ts`, `apps/admin/src/app/(dashboard)/dashboard/page.tsx`
- **Description:** `lib/types.ts` declares `AuditRow` and `QuoteStats` by hand
  with the comment "Not yet in the contract registry". Both **are** in the
  registry. `dashboard/page.tsx` still imports the hand-written `AuditRow`;
  `QuoteStats` in `lib/types.ts` is dead, shadowed by the quotes page's own
  inferred declaration.
- **Risk:** exactly the drift class `ADR-010` exists to prevent.
- **Status:** `DONE` (`00b095a`) — `AuditRow` is inferred from the registry; the hand-written version was missing `actorEmail`, `reason` and `requestId`. `QuoteStats` deleted rather than aliased: `quotes/page.tsx` already declares its own from the contract.

### DEF-013 — Nest's scaffold e2e test would fail

- **Location:** `services/api/test/app.e2e-spec.ts`
- **Description:** asserts `GET /` returns `"Hello World!"`. There is no root
  route. `pnpm test` does not run it (`**/*.spec.ts` does not match
  `app.e2e-spec.ts`); `pnpm test:e2e` does, and would fail.
- **Status:** `DONE` (`31ed198`, `c21be31`) — the scaffold assertion is replaced by a 5-test smoke suite (boots, liveness, readiness shape under either status, deny-by-default, no root route), `pnpm test:e2e` passes, **and CI runs it** — the step was missing, which is why a test that had never passed was invisible.

### DEF-014 — Two documents state the opposite of the code

- **Was:** `README.md` (two places) and `docs/engineering/standards.md` said
  `packages/*` are "source-only, no build step" when every one of them runs
  `tsc -p tsconfig.package.json` to `dist/`; `docs/engineering/api.md` said
  "Nothing exists yet — there is no auth module, no users module, no session
  handling" and listed every domain module as unbuilt; `docs/engineering/admin.md`
  said `apps/admin/` does not exist.
- **Fixed in `7699d97`.** Each section was corrected where a reader lands on it,
  not with a banner above it — that was the shared failure mode. All four had a
  "superseded" note at the top while the operative section underneath still
  taught the old thing, and nobody reads the banner for §1.
- **`api.md` now carries a status table driven by the same field as this
  file**, so the two cannot drift apart, plus an honest closing line: the layer
  that moves money is what is not built.
- **DoD met:** no `source-only` in `README.md`, `standards.md` or
  `docs/README.md`; `api.md` contains no empty-API claim; `admin.md` no longer
  says the console is missing. Every remaining occurrence of the phrase is
  inside an ADR, a changelog entry or a defect record — that is, describing the
  past.
- **Status:** `DONE`


### DEF-015 — Pagination that is not keyset on two admin lists · `DONE` (`9c2b480`, `f2cf8d2`)

- **Was:** `users.list` and `devices.listAll` ordered by a timestamp
  (`createdAt`, `lastSeenAt`) but paginated with `cursor: { id }` plus `skip: 1`
  — half the sort key. Two rows sharing a timestamp are ordered by nothing, so
  the page boundary between them can move: a duplicate or a gap on the list an
  operator reconciles money against.
- **Why it survived two re-verifications:** the comment above `users.list`
  already said "Keyset pagination on a stable sort". Reading it recorded the
  defect as fixed.
- **Fixed:** both sort on `[timestamp desc, id desc]`, filter with
  `timestamp < cursor OR (timestamp = cursor AND id < cursor.id)`, and return an
  opaque `{ t, i }` cursor. One implementation in `common/keyset.ts`, shared
  with `swaps.service.ts` and `transactions.service.ts`, which each carried a
  byte-identical copy of it.
- **Two failures the types could not see**, both caught by tests: the filter
  was first spread at the top level of `findMany` rather than inside `where`
  (Prisma ignored it; every page returned the same rows — spreading an `object`
  contributes no known properties to check), and it had to nest under `AND`
  because `users.list` ORs across email and displayName when searching, where a
  bare `{ OR }` spread would have silently dropped the search filter.
- **Wire:** `nextCursor` remains `nullable string` in the contract and the admin
  already treats it as opaque. Not a breaking change.
- **Tests:** 28 across the cursor module and both services. **11 fail against
  the pre-fix code** (6 of 9 users, 5 of 5 devices).
- **Status:** `DONE`


### DEF-016 — The admin console has no role gate on sign-in

- **Location:** `apps/admin/src/app/login/actions.ts`,
  `apps/admin/src/app/(dashboard)/layout.tsx`,
  `apps/admin/src/app/unauthorized/page.tsx`, `apps/admin/src/lib/roles.ts`
- **Was:** `loginAction` stored whatever role the API returned and
  `DashboardLayout` redirected only when there was no session, so an account
  with role `user` was signed in and handed the whole operations shell —
  navigation, branding, and a dozen panels each returning empty because the
  API refuses the same account on every call.
- **Built in `50cb8a1`:**
  - `lib/roles.ts` owns the rank table and `canAccessConsole`. It fails closed:
    an unrecognised role is denied, so a role the API grows before this file
    learns about it cannot walk in.
  - Sign-in refuses a role below `support` **before** `setSession`, so no
    session is written and there is nothing for the shell to gate.
  - The layout gates again — a session outlives a role change.
  - `/unauthorized` states the restriction. Its two redirects are what keep it
    from bouncing against `/login`, which already sends any session to
    `/dashboard`.
  - The rank table moved out of `lib/api-server`, which is `server-only` and
    therefore threw on import anywhere a test could reach it. The API already
    carries a duplicate of this hierarchy and it drifted once (`5a31c4b`).
- **Acceptance criteria:** a `user` account is refused at sign-in with no
  session cookie written; a session whose role is `user` reaches
  `/unauthorized`, never the shell; `support` and above still reach the shell.
  All three verified against the running app at 1440x900, not only in tests.
- **Security:** **this gate is a UX control, not a security control.**
  `getSession()` reads an unsigned base64 cookie, so the role it reports is
  display state a determined client could edit. That is acceptable only because
  the API re-checks authorisation on every call. The gate decides which shell
  to render; it never decides whether data is served. This is written into
  `lib/roles.ts` so the next reader does not promote it.
- **Tests:** 21 tests in `apps/admin`, which had no test runner before this:
  the rank matrix, the sign-in gate, the shell gate. The four that exercise the
  gates were confirmed to fail with the gates removed.
- **Status:** `DONE` — fixed in `50cb8a1`.


### DEF-017 — Unused dependency injection

- **Location:** `services/api/src/swaps/swaps.service.ts`
- **Description:** `ProvidersService` is injected and never used. Not harmful;
  it is a hint that rail binding was intended here and never written.
- **Status:** `DONE` (`00b095a`) — injection and import removed, with a note that the rail binding it implied is `BE-702`. `check-explicit-di` still passes (125 files).

### DEF-018 — `check-prisma-writes.mjs` fails and is not in CI

- **Location:** `scripts/check-prisma-writes.mjs`, `.github/workflows/ci.yml`
- **Description:** the guard built in `5a31c4b` to catch DEF-002's class of
  bug exits `1` on the current tree, flagging `Provider.where` and
  `Provider.data` at `provider-health.service.ts:142`. Those are not fields —
  they are the arguments to `update`, and the checker cannot follow the spread
  that builds `data`. `lastHealth` and `lastCheckedAt` are both declared on
  `Provider`.
- **The consequence is not the red exit.** `ci.yml` runs `check-key-boundary`
  and `check-explicit-di` and not this one, so a guard that currently fails is
  excluded from CI, which means it protects nothing. A check nobody wires up is
  a comment.
- **Why it is not a trivial fix either:** the commit message says the checker
  "reports honestly where it cannot follow a spread expression rather than
  passing silently, because a check claiming coverage it lacks is worse than
  none." That behaviour is deliberate. The work is to resolve the spread, or
  to mark the site explicitly inconclusive — and then to decide whether the
  script belongs in CI, which is a call about how noisy CI is allowed to be.
- **Dependencies:** none.
- **Expected output:** the script exits `0` on a clean tree while still
  failing on a genuine unknown field, and CI runs it.
- **Acceptance criteria:** a deliberate unknown field is caught; the spread at
  `provider-health.service.ts:142` is either resolved or explicitly marked;
  `ci.yml` executes the script.
- **Tests:** the guard against a fixture with a real typo.
- **Status:** `BACKLOG`

### DEF-019 — A test suite adopted fixtures another suite deletes

- **Location:** `services/api/src/common/idempotency/idempotency.spec.ts`
- **Was:** `prisma.asset.findMany({ where: { enabled: true }, take: 2 })` with
  no issuer filter, so it quoted whatever the table happened to hold.
  `redemption.controller.spec.ts` creates a fixture asset with symbol `RSPG`
  while its fixtures exist, which sorts before `tGOLD` — so the idempotency
  suite quoted *redemption's own asset*, and redemption's teardown then hit
  `Foreign key constraint violated on SwapQuote_fromAssetId_fkey`.
- **Why it was recorded here and not before:** it is an intermittent failure
  with no visible connection to idempotency, which is why it read as a Prisma or
  FK problem. It surfaced only when this work added a fifth concurrently booted
  application and shifted the timing: **0 of 11** baseline runs failed, **4 of
  21** did once the suite was added, and **0 of 8** after the fix.
- **Fixed in `8c48624`** by scoping the query to the `dev-fixtures` issuer —
  the same fix `contracts.spec.ts` already carried for this exact reason.
- **The rule:** suites sharing one database may adopt fixtures only from rows
  they own, or they delete each other's.
- **Status:** `DONE`

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

### BE-101 — API versioning · `DONE` (commit `0563b85`)
- **What exists:** `/api/v1` on every route, applied with
  `app.setGlobalPrefix` from `services/api/src/versioning/apply-versioning.ts`.
  `/health` and `/docs` are excluded: a probe is configured in a cluster
  manifest by someone who does not read changelogs, and a versioned probe means
  rotating a version requires reconfiguring the cluster or leaving a probe
  pointed at an address that gets removed.
- **The lifecycle is data, not prose.** `src/versioning/api-versions.ts` holds
  the registry: each version is `current`, `deprecated` or `retired` with a
  sunset date once it leaves `current`. Deprecated versions are still served
  **unchanged** and announce themselves on every response (`Deprecation`,
  `Sunset`, `Link; rel="successor-version"`, `Warning`). Retired versions get
  `410 Gone` naming the successor. Retirement is a human editing `status`, not a
  date comparison — "it is past the sunset date so every client must have
  migrated" is an assumption no system can make on its own.
- **404s are distinguishable.** `/api/v2/assets` returns
  `unsupported_api_version`; a missing asset returns `not_found`. Both name the
  versions that do exist. `GET /api/v1/meta/versions` is the same registry for a
  client that has not made a mistake yet.
- **The unversioned alias answers until 2026-12-01** and announces its own
  removal. It is a shim for the admin integration in flight, not a second API;
  deleting `LEGACY_UNVERSIONED_ALIAS.enabled` turns it off.
- **Tests:** 34 contract tests (including 7 for versioning), 8 unit tests of the
  lifecycle in `src/versioning/api-version.spec.ts`.
- **Two latent bugs found while doing it:** `RateLimitGuard` and
  `AuditInterceptor` both tested `originalUrl.startsWith('/auth/')`, which
  stopped matching the moment a prefix existed — every login would have moved
  onto the 120/minute budget, and sign-ins would have entered the audit trail
  the interceptor excludes. Both now match `auth` as a path segment.
- **Not done:** `apps/admin`'s `API_URL` still points at the API root. It works
  because of the alias, and moving it to `/api/v1` is a one-line change the admin
  owner should make when the alias is removed.
- **Status:** `DONE`

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

### BE-103 — Health and readiness · `DONE`
- `GET /health/live` (process only, no dependencies) and `GET /health/ready`
  (Postgres and Redis with latency). Both `@Public()` and `@SkipRateLimit()`.
- **Readiness answers 503 when a dependency is down** and 200 when both are up,
  with `dependencies` intact in the body either way; liveness stays 200 during
  an outage so an orchestrator withdraws the process rather than restarting it.
  Closed with `DEF-006` in `7be8a6c`, and verified against the running API with
  Redis stopped.
- **Status:** `DONE`

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


### BE-106 — Idempotency for financial operations · `DONE` (commit `ec328ad`)
- **What exists:** `Idempotency-Key` support on the three routes that move money
  or create a financial commitment — `POST /swaps/quotes`, `POST /redemptions`,
  `POST /onramp/quote` — via `@Idempotent()` on the route rather than a URL list,
  so a new financial endpoint is visibly *not* covered until someone adds it.
- **Storage is Postgres, not Redis.** `IdempotencyRecord`, keyed by
  `sha256(actorId + key)`. Redis is a cache: it is flushed, evicted and
  restarted for reasons unrelated to money, and an idempotency store that forgets
  is worse than none, because the retry it was supposed to absorb re-executes.
  The key itself is never persisted and never logged — only a 12-hex digest, and
  pino censors the header.
- **Concurrent duplicates across instances** are serialised by
  `INSERT ... ON CONFLICT DO NOTHING` against the unique index on `keyHash`, not
  by a lock. A mutex cannot do this: two replicas mean two mutexes, and a mutex
  only convinces the process holding it. Proved by firing six simultaneous
  duplicates at two separate application instances — one row, one claim, six
  identical responses.
- **Refusals, all of them safe:** same key with a different body is 409
  `fingerprint_mismatch` (never a replay — answering a request nobody made is its
  own failure); a claim whose instance died is 409 `outcome_unknown` and does
  **not** re-execute, because whether it committed before it died is unknowable.
  Refusing costs one error message; guessing wrong costs a second purchase.
- **Expiry:** 24 hours, verified by ageing a record past its window.
- **Tests:** 20 in `src/common/idempotency/idempotency.spec.ts`, DB-backed,
  two application instances.
- **Known gap:** expired rows are treated as absent but not deleted. No scheduler
  exists in the repository, so `IdempotencyStore.purgeExpired()` is currently
  called by nothing. It is a storage-growth issue, not a correctness one.
- **Also known:** the header is supported, not required —
  `@Idempotent({ required: true })` is the one-word change once every client
  sends it.
- **Status:** `DONE`

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


### BE-204 — Connected devices and DApp connections · `BACKLOG`

- Surfaces a user-facing view over what `BE-201` already stores: registered
  devices, last seen, revocation (the API and the admin page exist). The
  client-side screen does not.
- **The DApp-connection half is scope-blocked, not technically blocked.**
  WalletConnect and dApp permissions were **removed from scope by the v1 design
  spec** and are re-proposed in the owner's 2026-10-07 product document. See
  [`DECISIONS.md` ADR-021](DECISIONS.md) — do not build the connection layer
  until that is called.
- **Status:** `BACKLOG`

---

### BE-205 — Client security controls: PIN, biometrics, limits, approvals · `BACKLOG`

Raised by the owner's 2026-10-07 product document; never tracked before.

- PIN and biometric lock, seed-phrase backup and verification, per-asset
  spending limits, explicit transaction-approval steps, and security alerts.
- **The alerts half has a server prerequisite:** `BE-1201` records intent but
  sends nothing, and `notifications` has no transport (ADR-020). Alerts cannot
  ship before a delivery provider exists.
- **Key material stays on device.** PIN and biometric state are client-side
  artefacts; no PIN, no derived key and no unlock signal may cross the boundary
  (ADR-001).
- **Status:** `BACKLOG`

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


### BE-402 — Additional metals (platinum, and beyond) · `BACKLOG`

- The registry is not gold-and-silver-shaped: `category`, `custodyModel` and
  `backing` are already free-form, and `enabledMetals` counts by category
  rather than by an enum of two. Adding a third metal should be **a registry
  row and a disclosure string, not a code change** — verifying that claim is
  most of this task.
- Blocked on the same partner as `BE-802`: there is no platinum issuer to
  point at, and an unsupported metal with a `verifiedTier` is worse than a gap.
- **Status:** `BACKLOG`

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


### BE-603 — Gas sponsorship and account abstraction · `BACKLOG`

Raised by the owner's 2026-10-07 product document; never tracked before.

- The problem is real and worth stating precisely: a user holding 1,000 USDT
  cannot spend it without ETH for gas, and "you need $4 of ETH" is the first
  wall an ordinary buyer hits. The document proposes folding network cost into
  the quote instead.
- **An investigation task, not a build task.** It must settle: relayer versus
  paymaster versus an ERC-4337 smart account; who bears the gas economics;
  whether it applies to metals purchases only or to every transfer; and — the
  part that gates everything — what it does to the key boundary.
- **Constraint:** the account abstraction work listed in
  [`CURRENT_SPRINT.md`](CURRENT_SPRINT.md) "Do not start" exists because no
  account contract is deployed and no implementation exists in
  `packages/wallet-core`. That holds until this task's investigation says
  otherwise. A smart account changes *where* the key lives, which is the one
  property that cannot be compromised.
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

### BE-805 — Redemption mechanics · `PARTIAL`
- The state machine and the request path both work — `DEF-001` closed the dead
  controller in `5a31c4b`. What remains is that mechanics and fees depend on
  partner terms, and there is no partner.
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


### BE-1106 — Feature availability by country · `BACKLOG`

Raised by the owner's 2026-10-07 product document; the *engine* already exists.

- The hard half — `JurisdictionRule` → allow/deny per operation, deny-by-default
  — is `BE-1103` and is `DONE`. What is missing is everything around it:
  an admin surface that reads and writes the rules, and a client-side gate so a
  user in a jurisdiction where metal is unavailable never sees a disabled buy
  button with no explanation.
- **Why it is tracked now rather than later:** the document's point is that
  building the app around one country's assumptions is expensive to undo. The
  data model already refuses to; the *surfaces* do not yet know it exists.
- **Do not confuse with KYC.** Jurisdiction decides what a location may see;
  KYC decides who a person is. `BE-1101` is separate and still `BACKLOG`.
- **Status:** `BACKLOG`

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


### BE-1506 — Support tickets (admin) · `BACKLOG`

Raised by the owner's 2026-10-07 product document; never tracked before.

- No model, no route, no admin page. Audit rows record what the *system* did;
  a ticket records what a *person* asked, and the two are not interchangeable.
- Sits alongside `BE-1505` (system configuration) as the remaining
  "operations surface that exists in every internal console".
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

**61 tracked tasks plus 19 defects.** Recomputed from the `Status` field on
every entry, not from memory — the previous version of this section claimed 56
tasks and "17 defects, all BACKLOG", and both were wrong by the time anyone
read them.

| Status | Tasks | Defects |
|---|---|---|
| `DONE` | 16 | 17 |
| `PARTIAL` | 19 | 0 |
| `PARTIAL` | 0 | 1 |
| `BACKLOG` | 19 | 1 |
| `BLOCKED` | 6 | 0 |
| `OPEN` | 1 | 0 |
| **Total** | **61** | **19** |

**16 of 61 tasks are complete; 17 of 19 defects are done, 1 is half fixed and 1 remains.** The plan's §68 dependency
chain is most of the way built at the infrastructure layer and not started at
the layer that moves money.

Six of the `BACKLOG` entries are new as of 2026-10-07 — `BE-204`, `BE-205`,
`BE-402`, `BE-603`, `BE-1106`, `BE-1506` — raised by the owner's product
document rather than by the plan. Their scope conflicts are recorded in
[`DECISIONS.md` ADR-021](DECISIONS.md); two of them must not be started until
that is called.

See [`BACKEND_ROADMAP.md`](BACKEND_ROADMAP.md) for the order.
