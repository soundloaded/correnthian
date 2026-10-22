# CHANGELOG

Reconstructed from `git log`. The repository has no releases yet; every entry
is a commit, and the significant ones carry what the commit message recorded
about *why* — which is the part that otherwise rots.

Entries are in reverse chronological order within each date. Commit hashes are
abbreviated. Read the full message with `git show <hash>`.

**The repository has no remote**, so nothing here has been pushed anywhere.

---

## 2026-10-22

### Issuer verification: the badge gets its machine half

`BE-401` goes `PARTIAL` → `DONE`. The promotion to `issuer_verified` now
runs three checks before it writes — licences on record, a fresh
attestation on at least one asset, every cited proof URL answering over
HTTPS — and records the report with the reason behind the tier change. The
same evaluation is readable without enforcing it through
`GET /issuers/:slug/verification-checks`, which the console renders in the
verification card before the operator promotes. Risk flags detach
individually. The judgment half stays human: counsel owns whether the
evidence is *good*.

- The proof-URL fetch sits behind a `VERIFICATION_FETCH` port, and the
  HTTP suites override it rather than reaching the network. Internal
  destinations are refused before any request is made.
- The reason is asserted before the write, and the audit line is
  `verifiedTier.changed` via `recordChange` with before and after — the
  name the destructiveness registry already gave this operation.
- Sixty-three new or extended tests; typecheck, six API suites and the
  admin build green at the commit.

## 2026-10-21

### System settings: a store whose every key is read by code

The console's settings page had two halves: a feature-flag table that
nothing evaluated, and five sections that said so out loud. Neither was a
system. The platform's real knobs were module constants — the intent
lifetime, the sanctions freshness window, the quote's life — and chain
enablement, which reached no client at all.

- **A setting is now a code declaration with a database override.** The
  definition — key, type, bounds, default — lives in
  `services/api/src/settings/registry.ts`; the table holds only overrides, and
  the effective value is `override ?? default`. Every default is the value
  the code was already using, so applying the migration changes no
  behaviour and introduces no new business number.
- **Five settings, each with a reader**: the intent lifetime, the sanctions
  freshness window (read by the gate *and* the nightly job, so the two
  cannot drift apart the way two constants could), the quote lifetime, and
  maintenance mode with its message.
- **Maintenance mode is enforced, not merely stored.** A global guard
  answers `503` with the operator's message while the settings routes, the
  auth routes, the client config, the version metadata and the inbound
  vendor webhook stay open — the last because losing verification events is
  worse than losing a request. It fails open if the setting cannot be read:
  a configuration read that fails must not become a second outage, and a
  refusal nobody can clear is worse than an open platform.
- **`GET /api/v1/config` publishes what a client needs** — the API version,
  the maintenance state and message, and the enabled chains in a projection
  that carries no counts and no RPC endpoints. Without it, a console that
  changes something is worth nothing to the people it changes it for.
- **The console has a page for it**, and it renders the registry generically
  — a setting added in a release appears without the console changing. Above
  the settings it shows the *published* configuration, so an operator sees
  the payload a client sees rather than trusting that a write propagated.
- **Three tests keep it honest.** A key nothing reads fails the build (the
  reader scan). A row for a key the registry does not declare fails the
  build (the orphan test). A stored value that no longer validates falls
  back to the declared default rather than wedging the platform.
- **What was deliberately not built**: rate limits as settings, per-job
  enable toggles, and gradual flag rollout — the last because a public
  route cannot verify a subject, so "10%" would be "whichever you prefer".
  The reasoning is in ADR-023.

## 2026-10-20

### The console was wired but inert — DEF-024, and a page-by-page pass

The request was to make the admin console's pages functional. The first
finding was that most of them were already wired to the API and looked
fine, while the API client was throwing away every query parameter before
the request left the browser. Filters, sorts and pagination cursors were
discarded, so the console answered with the server's defaults: the filters
looked live and did nothing, and "Next page" returned the same rows. That
is what made the console read as a set of static pages.

Found by driving it in a browser and reading the URL the page actually
requested — not by reading the code. The client test named *"fills path
params and query strings"* passed no params and asserted a bare URL, so it
was named for the behaviour and checked none of it.

- **Fixed** (`ce23a50`), mutation-checked, and verified live: filters
  change the result set, and clicking Next advances pages.
- **A full audit** of all 21 console call sites against the API's DTOs
  found zero parameter-name or type mismatches, so no existing call could
  break. It found one new failure class the fix exposed — free-text filter
  inputs with no length cap could exceed the API's caps and 422 a whole
  page — and those inputs are capped now.
- **The devices page** was a scaffold stub reading "Hello". It now lists
  trusted devices across accounts with the filters the endpoint honours,
  keeping revoked rows visible so a revocation stays verifiable.

### Operator surfaces that did not exist

Six, each against a real endpoint and the role it actually requires:
transaction lifecycle transitions and observations (the state list comes
from the server's own `permittedNext`), wallet chain-sync, scheduled-job
runs in Settings, asset and issuer registration, and fee-rule creation.
Each confirms in plain words what it is about to do, and renders its
outcome inline.

What was deliberately **not** offered: building or broadcasting a
transaction (the device signs; both routes require the transaction's own
account), registering a wallet or writing a balance (the account holder's
own writes), and composing a notification (the route stamps the row with
the caller's account and has no recipient field).

### Three more things that looked fine and were not

- **The production build was broken** — `window` read at module scope
  during prerender, so CI's build step was red. The development fallback
  pointed at the console's own port, so `pnpm dev` produced a console
  that called itself and every request 404'd.
- **`lastLoginAt` was never written** (`DEF-025`). The users list and the
  account page both show a "Last login" column, and it read `—` for every
  account. Nothing set the column.
- **Every link-button logged a Base UI warning** — 185 of them on one
  page. The noise hid real errors, and the warning was correct.

### The console, verified

Every page walked in a real browser against the live API: all seventeen
render live data, with no failure states and no console output at all.
The dev database was returned to its pre-session state afterwards.

### The API client dropped every query parameter — DEF-024
- `packages/api-client/src/client.ts` destructured `query` out of the request
  options and then built the URL from path params alone. Every list filter,
  sort, limit and pagination cursor the console sent was discarded before the
  request left the browser, and the server answered with its defaults.
- This is why the console read as a set of static pages: the filters looked
  live and did nothing, and "Next page" returned the same rows. Found by
  driving the console in a browser and reading the URL the page actually
  requested — not by reading the code.
- The client test named *"fills path params and query strings"* passed no
  params and asserted a bare URL. It was named for the behaviour and checked
  none of it, so the suite stayed green while the behaviour was absent — the
  shape of `DEF-018` and `DEF-021`.
- Fixed by passing `query` to `buildUrl`; the test now asserts a substituted
  path param, a search value, a number, a boolean, and that a `null` value
  stays off the wire. It fails against the pre-fix client.
- A full audit of all 21 console call sites found **zero** parameter-name or
  type mismatches against the API's DTOs, and the API's zod schemas strip
  unknown keys rather than rejecting them — so no existing call can break.
  One new failure class did appear and is fixed: free-text filter inputs with
  no `maxLength` could now exceed the API's length caps and 422 the page.

### Devices page built
- `/devices` was a scaffold stub reading "Hello". It now lists trusted devices
  across all accounts with the filters the endpoint honours, paginated by
  cursor, keeping revoked rows visible and dimmed so a revocation stays
  verifiable.

## 2026-10-12 (later)

### Entity registered; API-key vs partnership split recorded
- Owner confirms Correnthian C-Corp registered in Delaware; memo updated
  (formation docs outside repo; structure review still counsel's).
- Vendor split written down so procurement runs on two tracks (below).

### Counsel briefing memo + interview scorecard ready
- Lawyer-ready intake memo (fact/proposal/assumption/question separation,
  11 counsel-only questions, prioritized first-meeting agenda, document
  list) and a one-page scorecard. No facts invented; Delaware C-Corp
  flagged as owner-stated, unverified in repo.

## 2026-10-12 (later)

### Incident runbooks written — BE-1603 DONE
- Six playbooks + index under `docs/runbooks/`, closing the tracker's most
  serious docs gap (the key-breach runbook). Claims verified against code.

## 2026-10-12 (later)

### Alchemy CLI checked in (reads only, wallet stays disconnected)
- Doctor + auth healthy; Sepolia block + mainnet gas verified through the
  CLI; app networks listed (no Base — enable in dashboard).
- Usage baseline 6,660 CU MTD ($0.00) for future burn reporting.
- **Base enabled on the Alchemy app** (dry-run preview, then apply; prior
  403 was propagation delay, not config). Chain 8453 now a failover pair;
  pool health green on all real chains.

### Live chain acceptance, first half (reads + assemble, no signing)
- **Wired:** Alchemy primary + Infura failover on eth mainnet; Sepolia pair
  (enabled in dev); Base single leg. All endpoints answer the same heads.
- **Proven live on Sepolia:** wallet sync clean; intent → assemble returns
  real nonce, gas estimate, fee caps and correct ERC-20 calldata.
- **Held:** relay/broadcast pending funded test key + explicit approval.
- Chain reads leak no URLs (verified in responses).

### Live broadcast acceptance on Sepolia (reads + device-signed send)
- **Session wallet** (Alchemy Agent Wallet, testnet-only, expires 2026-10-19)
  funded with 0.05 Sepolia ETH via Google faucet; balance verified on-chain.
- **Flow proven live:** intent → signed (reported) → observations bound the
  real broadcast hash (`0xf94491…`) → 45s later `pending` at 3/12
  confirmations counted through our pool. BE-302 + BE-601 read paths green
  on a live chain with a real signed send (0.0001 ETH dust + gas).
- **Explicitly not proven:** our relay submitting a device-signed payload
  (the CLI broadcast directly; signature verification stays unit-covered
  until a raw-signing path exists). Fixtures removed.

### XAUT diligence pack + wholesale-minimum design point
- **Diligence pack** at `docs/operations/xaut-diligence-pack.md`: 19
  questions across standing, attestation, redemption, chains, commercial
  and counsel — plus acceptance criteria for the builds it unblocks.
- **Terms on record** (tether.to/fees, verified today): $100k minimum,
  0.1% acquire, max($1000, 0.1%) redeem, $150 verify. Re-verify at signing.
- **Design consequence:** direct redemption is wholesale-only; retail exit
  is sell-back unless aggregation is permitted and counsel clears it.
  Trackers updated (blockers table, BE-1701 note).

## 2026-10-12

### Pre-launch landing page ships — marketing scaffold to page
- **Copy-honest by construction:** every claim traces to MASTER_CONTEXT;
  no dates, fees, prices, or provider names; launch-gated items carry
  gating notes; notify-me stores browser-only and says so.
- **Verification:** typecheck, production build, desktop + 390px renders,
  every control exercised.

## 2026-10-11

### Jurisdiction rules console — BE-1106 admin half
- **Reads + audited writes:** list ordered country/region; patch flags only
  (identity immutable), one audit row per write carrying the reason.
- **Console page** with reason-gated saves and the dev-rules warning,
  browser-verified flip → audit → restore.
- Client gate and rule content stay open (no clients; counsel).

### Follow-up slice: service specs, package specs, two deferred minors
- **`notifications.service` spec** (5 tests, 3 mutants killed) including the
  honest no-claim batch pin for DEF-009.
- **Contracts package specs** (8 tests) with malformed twins per schema.
- **Attestation sweep paginates** deterministically past the batch
  (cursor loop, abort/deadline guards; batch 200).
- **Admin validation errors name the field** (`path — message`, values stay
  server-side), browser-verified on a crafted filter.
- **Verification:** full monorepo suite green (21/21), typechecks clean.

### v1 contract freeze closed — BE-1705 DONE
- **Every route with a response body pinned:** 98 routes, 99 registry keys,
  zero uncovered (re-derived, not asserted). Twelve slices: wallets, devices
  + auth, chains + providers, issuers, pricing + public GETs, portfolio,
  swaps, transaction intent flow + refusals, notifications + users + audit,
  verification + probes + safe run, the eight keys re-derivation caught,
  observations + the flip.
- **Two real defects on the way:** pricing-style FK thinking applied to
  `blockNumber` — observing with a block number 500'd (BigInt cannot cross
  JSON), fixed at the read boundary (`TransactionRow`); chain sync errors
  quoted viem verbatim including endpoint URLs (DEF-023), redacted with the
  transaction engine's rule.
- **Verification:** full monorepo suite green (21/21 tasks), typecheck clean,
  DI guard 139 files, task-counts guard green. Phase 4 still gated on
  counsel's buy-flow answers — frozen API, undecided flows.

## 2026-10-10

### Controller-spec batches A+B: ten HTTP suites, six service specs, one real bug — BE-1702
- **Batch A** (`assets`, `issuers`, `providers`, `pricing` — 23 tests):
  role-tiered writes, unknown-row 404s, shape-pipe 422s.
- **The pricing history test exposed a real bug:** `history()` queried
  `AssetPrice` with the domain assetId while the column holds the surrogate
  FK, so every history read answered empty while `quote` (via `latest`)
  worked. Fixed by resolving the asset first; unknown assets 404 like
  `latest`. RED→GREEN witnessed on the new tests.
- **Batch B HTTP** (`devices`, `chains`, `audit`, `jobs`, `blockchain`,
  `portfolio`, `onramp`, `fees`, `compliance-extra` — 37 tests): device
  404-not-403 on foreign rows, chains/providers health carry no endpoints
  or credentials surface, audit confined to compliance, jobs board shape
  pinned without firing runs, onramp honest 503s with no provider, fee
  three-tier preview/admin/owner+reason, verification re-entry asks the
  vendor exactly once, approval clears the latch while rejection keeps it.
- **Batch B service specs** (24 tests): swaps refusal order + scoping,
  asset identity derivation, chain select keys (no `rpcUrls` by
  construction), provider status stamp, redis boolean health, job-lock
  fail-closed. Scoping and lock mutants killed.
- **Verification:** full API suite 73 files / 817 tests green; typecheck
  exit 0. Gated tasks 1.2–1.4 untouched (user-track triggers outstanding).

### Guardian rotation + attestation sweep — Task 2.5 steps 1–2
- **`PATCH /wallets/:id/guardians`:** guardians were registration-only;
  rotation after a key loss had no path. Owner-scoped, smart-only,
  EVM-validated, contract-pinned. Kind-guard mutant killed.
- **`assets.attestation-freshness` job:** daily read-only report of enabled
  assets past their own cadence. Never-attested branch mutant killed.
- Steps 3–4 (recovery intake, deployment tracking) stay gated on
  BE-203b and ADR-022.

### Autonomous controller-spec run: two IDORs, one shared lesson — BE-1702
- **`test/transactions.spec.ts` (10 tests, two sessions) found DEF-022:**
  `GET /transactions/:id` answered any authenticated account with the row —
  amounts, destinations, wallet addresses, the owner's email. Both guard
  suites passed over it because the route carries no `@Roles`. Fixed with
  the stranger rule (non-operator on a foreign row learns nothing, not
  even existence) in `detail`, `apply` and `observe` — transitions moved
  403→404 on foreign rows while own-row 403s keep their diagnostics.
  Actor required, not optional. 3 mutations, one per entry point, killed.
- **`test/swaps.spec.ts` found the same shape in `findById`** (quote
  amounts, pairs, fees) — fixed identically, null-owner rows failing
  closed to operators-only. Mutation-killed.
- **`test/wallets.spec.ts` (6) and `test/users.spec.ts` (5)** pin correct
  behavior: per-verb 404s, primary singularity, tiering between support
  and admin, self-promotion refused, unknown roles rejected by validation.
- **One shared-suite collision fixed:** two files registered the same
  fixed address on the shared wallet table; fixtures now carry the worker
  pid like the emails already did. DEF-019's failure mode, again.
- **BE-501 allocation + history-series built** (6 unit tests, 5 mutations
  killed): integer-basis-point shares documented as non-summing, latest
  snapshot per UTC day/week bucket, empty buckets absent not zeroed.
  Snapshots stay manual until pricing exists — quota spent on `$0` rows
  otherwise.
- **Verification:** all nine checks green; 729 API tests; lint below
  baseline. Commits per slice, tree clean.

### Autonomous PARTIAL sweep: five entries closed or corrected
- **`BE-1703` — dependencies and secrets now gated.** `check-deps.mjs`
  fails on untriaged high/critical prod advisories (keyed by GHSA id with
  the chain and remoteness argument; the node-forge advisory wears two
  ids and the first version of the gate failed live on the alias).
  `check-secrets.mjs` replaces the env-only grep: PEM blocks anywhere,
  key-material assignments in any file, token shapes outside fixtures —
  first run flagged four doc lines (reworded, not excluded) plus stale
  agent worktrees (skipped as session scratch). Both in CI, both with
  specs that prove they fail (13 tests). SAST/fuzzing/bypass stay open
  as accepted gaps with an owner.
- **`BE-105` — the two unread variables are read.** Sentry errors-only
  plus OTel traces/metrics, each from its own variable, unset meaning
  off, tracing failure never refusing traffic. 5 tests, 4 mutations
  killed. Delivery unproven (no accounts) — stated, not left.
- **`SEC-001` — the threat model exists** (`docs/architecture/threat-model.md`):
  assets, four adversaries, 20+ abuse cases naming code and tests, four
  load-bearing assumptions, eight accepted gaps with an owner. Every
  claim re-verified (append-only audit, no rpcUrls in responses, httpOnly
  cookies, absent reset flow, argon2id floors, frozen lockfile, 32-byte
  sessions). Practice stays open by design.
- **`BE-1701` corrected, not built:** expiry writes `expired` (two writers
  total, verified) — the entry said only `quoted`. The other four states
  await an execution flow that does not exist and must not be invented.
- **`BE-501` snapshots stay manual on purpose:** nightly captures today
  would spend metered RPC quota writing `$0` rows with no price feed.
  Recorded with the job shape for when BE-502 lands, instead of a gap
  that invites building it now.
- **Process notes:** one unexplained single non-reproducible `check-task-counts`
  failure mid-run (0/0/0 before and after across repeated runs — watched,
  not chased); one commit landed the doc without its entry update when a
  python anchor missed, fixed immediately after.
- **Verification:** all nine checks green (typecheck/build/test/lint +
  deps/secrets/explicit-di/key-boundary/task-counts); 698 API tests;
  lint 16 warnings, below the 17 baseline.

### Persona docs pass: assumptions corrected against the real shapes
- Five doc pages (signature best-practices, create/retrieve inquiry,
  create/retrieve report, the event envelopes and watchlist names) replaced
  every significant assumption from the build session:
- **Base URL was wrong:** `withpersona.com/api/v1` → `api.withpersona.com/api/v1`.
  Guessing the host wrong fails every call at once — config default and env
  example corrected, with a test pinning the default.
- **Inquiry creation needs a template** and returns the session token only
  when asked (`meta.auto-create-inquiry-session`), at `meta.session-token`;
  binding uses `meta.auto-create-account-reference-id` (`reference-id` is
  deprecated). `configured` now requires key + secret + template: credentials
  without a template look ready and fail at the first real user.
- **Verdict and list signals are independent halves now.** Persona sends
  inquiry lifecycle events (`inquiry.approved/declined/marked-for-review`)
  with no watchlist content, and watchlist reports (`report/watchlist.*`)
  with no verdict. The old combined decision would have approved on one half
  while asserting the other — an approval doubling as a clean screen. The
  port carries both halves nullable; the service applies each non-null half;
  approvals write no list fact they were not given.
- **Binding falls back, strictly:** reference-id when present and agreeing,
  else reverse lookup by inquiry id (vendor-unique, one live inquiry per
  user). Either side alone is not a binding.
- **Re-screen is a linked watchlist report** (`POST /reports` with the
  inquiry relationship — our PII never crosses), polled bounded (4 × 500ms)
  then fail-closed. Missing `has-match` reads as hit: a shape change in the
  match field must not become clean by omission.
- **Rotation pairs accepted:** the signature header carries two pairs during
  secret rotation; either may verify. Timestamp tolerance stays ours (the
  docs specify none) and is stated as such.
- **Verification:** 680 API tests, all seven repo checks green; second
  mutation round on the new logic (12/12 killed, including approval
  inventing a screen, hit+passed advancing, dismissal clearing, unknown
  names throwing, binding fallback removal, and pending resolving clean).
  One invalid round in the middle — two "survivors" that were no-op comment
  edits by the mutator, redone properly and killed.
- **Still `PARTIAL`:** sandbox credentials do not exist, so the vendor path
  is stub-verified only. Residuals narrowed to two inferences; known
  simplifications (inquiry expiry, post-approval document expiry) recorded
  in the entry rather than built half-understood.

### `BE-1101` / `BE-1105` — KYC and sanctions: built against Persona, behind a port
- **Decisions (user, 2026-10-10):** Persona as vendor · auto-approve on clean
  pass, humans only on flags · sanctions screen cached with 24h TTL · all
  fiat-touching movements gated, crypto-only moves untouched · Approach A
  (server-created inquiry + webhook-driven machine) · §§1–4 approved as
  recommended, §5 (below) built on the same principles without a further round.
- **§5, recorded rather than asked:** the review queue is exactly the profiles
  with `needsReview` set, oldest first, operational fields only (inquiry id
  included — the operator needs it to open the vendor record; documents never
  appear because they were never stored). `decide` requires compliance role
  and a reason of real length, mirrors status to the user row in the same
  transaction, and approve is the one human act that clears a latched hit —
  reject leaves the latch, so a later review starts from frozen.
- **The state machine's three load-bearing properties, all tested:** mirror in
  the same transaction (gate and console cannot disagree), machine output
  parks but never finalises, and a latched hit survives a later passing
  verification — the last one found by a failing test, not by reading: the
  approved branch overwrote the latch until the suite said otherwise. One
  clock for webhook ordering (envelope time compared and stored; the decision
  timestamp rides in audit metadata), so a stale event cannot apply "because
  its decision was newer".
- **The gate is honest about what it cannot see:** `redemption.request` is
  the only wired door because it is the only movement row any code creates —
  onramp has no execution path and no buy flow exists, so those doors live in
  the gate's movement type rather than in pretended routes. The two suites
  that proved the redemption success path had to become verified users; that
  is the product rule changing the fixtures.
- **Fail-closed stack, top to bottom:** fake throws unscripted, unconfigured
  production warns at boot and denies fiat, stale screens re-screen inline,
  vendor-down denies, hits latch, denials are one generic 403 (tipping-off
  asserted per code), and the nightly `compliance.rescreen-stale` skips the
  frozen and isolates per-user failures.
- **The Persona literals are assumptions, marked as such:** every header
  scheme, path, event name and status word carries VERIFY-AGAINST-DOCS, and
  the specs pin the implemented shape so corrections break loudly. Both
  entries stay `PARTIAL` until a docs pass plus a sandbox run — same rule as
  the indexer work, which stayed `PARTIAL` for want of a node.
- **Verification:** TDD throughout (two Iron-Law resets: `decide`/`reviewQueue`
  written before their tests were deleted and re-derived; a bad spec edit
  repaired immediately). 664 API tests, all seven repo checks green;
  **17/17 mutations killed** — including each relay-chain refusal, the latch
  surviving approval, staleness, idempotency, binding, mirror, reason, and
  the frozen-skip. Two suite fixes on the way: the role pin and public pin
  gained the three new routes, and the public-401 test carves out the signed
  webhook (unsigned bytes must 401, or the test would force accepting them).
- **Not done, stated:** BE-1102 (risk engine) explicitly out of scope;
  onramp/metals doors unwired for want of endpoints; Persona docs + creds.

**17 of 49 tasks are `DONE`, 16 `PARTIAL`; 20 of 21 defects.**

---

### `BE-602` — send/receive backend: assemble, sign, relay, verify
- **The endpoint existed in spirit but could not have been used.**
  `buildTransaction` returned `{to, value, data, chainId, gas}` — no nonce,
  no fee caps — so nothing could sign what the server assembled, and a device
  that filled those in itself would have been doing its own assembly. It now
  asks for the `pending` nonce (two sends in flight would otherwise be handed
  the same one) and EIP-1559 caps, and encodes ERC-20 transfers: amount in
  calldata against the contract, zero value.
- **Three commits, one architectural move first.** `TransactionsService`
  needs `BlockchainService`, and `BlockchainModule` already imported
  `TransactionsModule` for the indexer — a cycle Nest resolves into
  `undefined` dependencies, which compiles. Rather than `forwardRef`, the
  indexer moved into `transactions`: one module now owns every write to the
  `Transaction` table, and the graph is one-directional.
- **Relaying without verifying would make the ledger decorative.** The
  endpoint accepts bytes the server never saw signed; without checks, the
  row would say what the intent said while the chain did what the bytes said,
  with nothing connecting them. `decodeSignedTransaction` parses the payload
  and **recovers the signer from the signature** — a payload edited after
  signing recovers someone else — and the relay compares signer, chain and
  `to`/`value`/`data` against `assemblePayload` derived from the same intent,
  all before any network call. `assemblePayload` exists because that
  comparison needs the encoding without a second `eth_estimateGas` per
  broadcast, and because the comparison should not be able to fail because
  the chain was having a moment.
- **The fee shown is the fee recorded** — gas × cap, exact bigint, written
  at build time, because reconstructed later it would be a fee from a
  different fee market than the one the account holder agreed to.
- **Failure routing was a real decision:** transport failures are 503 with
  no detail (the pool's message carries our RPC endpoints, which are a
  metered quota), node declines are 400 with the reason. The 400 path runs
  through `summariseError`, whose comment has always claimed it strips
  endpoints while doing nothing but truncating — and viem puts
  `URL: http://…` in the first two lines of a failure. `redact()` in
  `@correnthian/security` gained a URL rule (7 tests) rather than the
  comment being edited to match the gap.
- **Verification:** TDD throughout — every production line watched failing
  first, including the adapter's. 602 API tests, 57 blockchain, 7 security,
  all seven repo checks green; **11 mutations, all killed**. The one
  survivor was instructive: removing assemble's ownership check changed
  nothing because a second check said the same thing — so the redundancy
  was removed rather than the test weakened, and the surviving check was
  then killed on its own.
- **Not done, stated:** no `packages/contracts` entries for the two new
  routes (matching `POST /transactions`, which has none either) — that
  sweep belongs with the contract registry work. `viem` is a test-only
  devDependency of the API.

**17 of 49 tasks are `DONE`; 20 of 21 defects.**

---

## 2026-10-09

### `BE-1703` — `RolesGuard` gets its first tests, and `DEF-021` falls out
- **Two layers, because one cannot prove the other.** Eleven unit tests pin
  the guard's decisions — the hierarchy in both directions with literal
  ranks (not `ROLE_RANK`, so a wrong table cannot agree with itself), an
  unknown held role denied, an unknown *requirement* denied for everyone
  including `owner`, an absent identity denied rather than crashing into a
  500. The HTTP suite then proves over all **40 role-gated routes** that a
  real `user` session gets **403** — not 401 (it is authenticated), not 200
  (it is unauthorised), not 500. `routes.spec.ts` never got past
  `SessionGuard`, so none of this was covered anywhere.
- **The session is made the honest way**: `POST /auth/register` creates
  `role: user` by default and opens a session. No minted tokens, no direct
  database writes.
- **The admission control is the load-bearing test, and it was broken when
  written.** It filtered `method === 'GET'` while discovery emits `Get`, so
  the loop ran **zero iterations** and passed in 1ms. Nothing in the suite
  could have noticed: an empty loop asserts nothing. The mutation run named
  the fix (`exact match instead of hierarchy` survived when it should have
  died) exposed it, and the loop now asserts its own iteration count above
  zero before it starts. This is the second time in this repository that
  mutation testing has found a test that was not testing.
- **`DEF-021`, found on the way and fixed the same day.** All three copies of
  the controller parser located handlers with a fixed 400-character
  look-ahead; `jobs.controller.ts`'s `@ApiOperation` block sits beyond it, so
  **`GET /jobs` was discovered by nothing** — excluded from the anonymous-401
  guard, the public pin and the no-500 check, while the per-file "found at
  least one" check stayed green because the file's *other* route was found,
  and the total stayed green at 86 > 50. Replaced with one shared
  `test/discover.ts` that walks lines to the handler with no length anywhere,
  and an **invariant** rather than a pinned number: discovery must return
  exactly as many routes as there are `@Get(`-shaped tokens, counted by an
  independent looser regex, so a decorator form the parser cannot read fails
  the build instead of shrinking coverage quietly.
- **Verification:** 581 API tests; all seven checks green; **8 mutations,
  all killed** — including the re-introduced 400-char window, class-level
  `@Roles` ignored, the guard admitting everyone, both fail-closed directions
  of `roles.ts`, exact-match instead of hierarchy, a controller losing its
  `@Roles`, and the admission control going empty again.
- **One environment trap, recorded where it will be read:** a Redis index
  outside 0–15 (there are 16 databases) does not error — `SELECT` fails,
  ioredis retries, and `app.init()` **hangs forever with nothing in the log**.
  That is how this suite first failed; the spec's comment names the index it
  chose and why.

**20 of 21 defects are now `DONE`;** `DEF-009` remains the only one that is
not, and it is gated on a decision outside code.

### The `PARTIAL` pass — sorting fifteen entries, and finding the tracker wrong
- Every `PARTIAL` entry was read with its claims checked against the code
  rather than against itself. Four groups fell out: **six with real work left
  and no external gate**, two needing only a node (`BE-302`, `BE-601`), six
  gated by a decision or on the do-not-start list, and one — `BE-004` — where
  nothing waits on the missing piece at all.
- **`BE-1703` is the one to act on.** `RolesGuard` has no test: verified by
  searching for any spec that references it. `routes.spec.ts` proves an
  anonymous request is refused; it does not prove a `user` session is refused
  on an admin route, so a controller that lost its `@Roles()` would pass the
  entire suite. That is the same shape as `DEF-001`, which is why that entry
  stays `PARTIAL`.
- **Three tracker claims were false:**
  - `BE-004` said "no BullMQ, no worker, no job runner" while `JobScheduler`
    was driving six scheduled jobs off a Redis lease with Lua renewal and a
    `JobRun` ledger. A reader would have concluded there was no
    background-job machinery and been tempted to build a second one beside it.
    What is genuinely missing is a **queue** — nothing enqueues;
    `notifications.enqueue()` writes a row to Postgres.
  - `BE-501`'s heading pointed at `DEF-007` and `DEF-008`, both `DONE`, which
    read as though the entry were waiting on them.
  - `BE-502` said "no price is ever recorded by any code", two bullets after
    describing the endpoint that records one.
- **§21's summary was wrong for the third time and disagreed with §2 of the
  same file**: it claimed 61 tasks and 19 defects against an actual 49 and 20,
  and every per-status figure was off. Its own preamble boasts that it had been
  recomputed "not from memory" — so this is the second time that boast was
  false, which is what prompted the fix below rather than another correction.
- **`scripts/check-task-counts.mjs`, wired into CI.** It recomputes the counts
  from the `Status` of every entry and fails on a mismatch, and on an entry
  carrying no status at all. That last case is real: `BE-1600` kept its status
  in its body rather than its heading and had been missing from every count as
  a result — my own count of it was wrong twice before reading the body. It
  also sums duplicate table rows instead of overwriting them, because §21
  carried `PARTIAL` on two rows and a parser that assigned would silently drop
  the first.

### `BE-601` — the confirmation sweep, and what it is for
- The scoping pass found that `eth_getTransactionByHash` was called by nothing
  in the repository, so a transaction the chain had mined and a transaction the
  chain had never heard of both sat in `broadcast` forever. `sweepByHash` is
  the fix, and it covers the four cases the log scan structurally cannot see —
  native-coin sends, unregistered or disabled tokens, the mempool window, and
  transactions that will never be mined — with one question asked about a hash.
- **The query is `state = 'broadcast'`, chosen rather than arrived at.** A row
  leaves that state in exactly two ways: it mines, or `observe` records the
  drop and moves it to `pending`. So anything still there is genuinely in
  flight, and a re-broadcast returns a row *to* it. Already-dropped rows are
  therefore out of scope by construction — no second predicate to remember to
  add later, and no row polled forever for being somewhere it no longer is.
- **A 60-second grace before absence becomes a drop.** `RpcAbsent` means every
  endpoint said no, which is the strongest evidence available, but a
  transaction submitted seconds ago can still be travelling and `droppedAt` is
  a claim about money. A false drop self-corrects: a late-broadcast
  transaction that later mines is seen by the same sweep and written.
- **Measured against the real database, same method as the scoping pass.**
  Mined at 995 → `pending`, `blockNumber: 995`, `confirmations: 5`. Absent →
  `droppedAt`, `dropCount: 1`. Reverted → `failed`, `errorCode: 'reverted'`.
  Broadcast 30 seconds ago → untouched. The sweep sits between the scan and the
  depth sweep so a sufficiently deep transaction arrives at `confirmed` in one
  run rather than two.
- **The run record names its skips.** `skipped.unknownToken` and
  `skipped.noWallet` were counted in the report and dropped before
  `JobRun.detail`. A control case that wrote nothing said only `created: 0`,
  with no reason anywhere in the output — an idle chain and a refused log are
  the same line to an operator.
- **8 tests, eight mutations killed.** One survived the first pass: the mempool
  case asserted the row but not that the run was clean, so a version that tried
  to write a null block number, threw, and had the error swallowed one level up
  looked exactly like a correct skip. Both `hashMined: 0` and
  `errors: []` now distinguish them.
- **`PARTIAL`, not `DONE`, for the same reason as `BE-302`:** no real node.
  The stub speaks genuine JSON-RPC over HTTP through viem against real Prisma,
  but it is not a chain. The verification run is queued for both.

### `DEF-020` — absence is an answer, not an outage
- The defect had a layering cause, not a message-text one: a node replying
  `null` to `eth_getTransactionByHash` and a node failing to reply both
  emerged from `RpcPool.withFailover` as `All N RPC endpoint(s) failed for this
  read. Drop detection — `BE-601`'s whole judgement — cannot be built on that,
  because it would set `droppedAt` on live transactions during any outage and
  quarantine a healthy endpoint that had answered correctly.
- **`RpcAbsent` passes through the pool instead of being swallowed by it.** It
  does not quarantine, it moves to the next endpoint, and it is only propagated
  once **every** endpoint has said no. That is deliberate: one node's silence
  is not proof of absence — a freshly broadcast transaction may not have
  propagated — while "all of them said no" is the strongest evidence the
  infrastructure can produce. If any endpoint has it, that answer wins.
- **The contract is honest now.** `getTransaction` returns
  `TransactionRecord | null`, so `'dropped'` leaves `status` as a *reply* rather
  than a value no code could produce. `'failed'` stops being decorative: it is
  read from the receipt, because mined is not succeeded, and a reverted send
  reported as confirmed would tell an account holder their money moved.
  `confirmations` and `blockTime` are **removed**, not filled — this adapter
  does not hold the head and never fetches a block, so both were hard-coded to
  `0` and `null`, and a field that is always zero reads as a measurement.
- **10 tests, seven mutations, all killed.** The assertions are about *which
  endpoints were asked and whether they were condemned*, not only what came
  back — a test checking only the return value would pass for a fix that
  quarantined the healthy node on its way out. One of the tests initially
  failed for a reason worth keeping: it built a fresh adapter per call, and
  quarantine lives on the pool, so it could never have seen the defect either
  way.
- **The test typecheck added earlier caught its first real error** — a `null`
  the `Behaviour` type did not allow. That config had been introduced two
  commits ago; this is the first thing it found.

**19 of 20 defects are now `DONE`.** `DEF-009` remains the only one that is
not, and it is gated on a decision outside code.

### `BE-601` scoped by running it, not by reading it — and `DEF-020` found
- Scope only; no product code changed. The entry previously said "write the
  remainder down before touching it", because its expected output had been
  mostly built by `BE-302` and working it as written would rebuild that.
- **The method matters more than the conclusion.** Rather than infer which rows
  stall, the real `IndexTransactionsJob` and `TransactionsService` were booted
  through Nest against the development database with a local stub node standing
  in for `eth_*` — no third-party RPC, chain 1's `rpcUrls` restored afterwards,
  fixtures deleted, tree clean. Three results:
  - an inbound ERC-20 log to a registered wallet **does** produce a correct row
    (`state: pending`, `blockNumber: 995`, `confirmations: 5`) — the positive
    control, and it took two attempts because the first used an unregistered
    token and the second a wallet address that did not match, which is how the
    next bullet was noticed;
  - a transaction the node has **mined at the current head** does not advance —
    `state: broadcast`, `blockNumber: null` before and after, `A ADVANCED? false`;
  - a transaction the node has **never heard of** is not detected as dropped
    either — `droppedAt: null`, and it stays `broadcast` forever.
- **The cause is one line of fact:** `eth_getTransactionByHash` is called by
  **nothing** in the repository. The job asks only `eth_blockNumber` and
  `eth_getLogs`. The log scan structurally cannot see native-coin sends,
  never-mined sends, unregistered or disabled tokens, or the mempool window —
  so the remainder is a single hash-keyed confirmation sweep.
- **`DEF-020`, found by asking the adapter over the wire.** A `null` result and
  a JSON-RPC `error` both throw, and `RpcPool.withFailover` wraps both into
  `All 1 RPC endpoint(s) failed for this read.` Drop detection built on that
  would set `droppedAt` on live transactions during any RPC blip — a claim about
  money made from an outage — and would quarantine a healthy endpoint for 30s
  for answering correctly. The same contract also declares `status: 'dropped' |
  'failed'`, which the EVM adapter cannot produce, hardcodes `confirmations: 0`
  and `blockTime: null`, and has zero callers.
- **A second observation:** the run record prints `created: 0` and nothing
  about why. `skippedUnknownToken` and `skippedNoWallet` are counted in the
  report and dropped before `JobRun.detail`, so the first control failure was
  invisible in the output. That goes into `BE-601`'s build.
- The defect tally also lost a range typo: it listed `DEF-001 … DEF-018` as
  `DONE`, which double-counts `DEF-009` as both `DONE` and `PARTIAL`.

### Pin the RPC wire, and typecheck every test in `packages/*`
- Follow-up to `BE-302`, and the second half closes the gap the first recorded.
- **The wire test exists because an assumption was doing work no test covered.**
  `transfers.test.ts` stubs the adapter's private `read`, which is right for
  de-duplication, sort order and what an unreadable log does — none of it is
  network behaviour. What that skips is everything between the node and our
  loop: whether viem puts `args.from` in `topics[1]` and `args.to` in
  `topics[2]`, and whether it decodes a log back into `from`, `to`, `value`.
  A wrong assumption there fails in one direction only — a filter matching
  nothing is indistinguishable from an idle chain. `rpc-wire.test.ts` stubs
  `fetch` one layer lower and answers in node shape.
- **It also pinned something the adapter had not stated:** addresses come back
  **checksummed**, not lower-cased. The indexer lower-cases before it looks a
  wallet up, which is what makes that necessary rather than defensive.
- **A finding on the way: no test in any `packages/*` was ever typechecked.**
  Thirteen `tsconfig.package.json` files exclude `src/**/__tests__/**` so tests
  stay out of `dist`, and `typecheck` reuses that config — so the exclusion
  applied to *checking* as well as building. It surfaced because
  `transfers.test.ts` passed `['http://localhost:1']` where `RpcEndpoint`
  requires `{url}`: the adapter it constructed would have thrown "No URL was
  provided to the Transport" on its first real read, and nothing had noticed
  because `read` was stubbed. Five packages have `__tests__`; each now has a
  `tsconfig.tests.json` and both configs run under `typecheck`. Two errors came
  out of it — the endpoint shape above, and an `Asset` fixture missing
  `enabled` — and both were real.
- **Still not `DONE`:** a stub is not a node. No live reorg, no provider rate
  limits, no wallet that really holds a registered token.

### BE-302 — Deposits now become rows: the indexer's event half
- `PARTIAL`, and the reason for `PARTIAL` is verification rather than code.
- **Read side:** `BlockchainAdapter.getTokenTransfers()` observes ERC-20
  `Transfer` logs. `eth_getLogs` constrains one indexed position per filter, so
  "sender OR receiver" cannot be one request — `args.from` and `args.to` are two
  calls, made in parallel and de-duplicated on `transactionHash:logIndex`,
  because a self-transfer matches both. Only three-topic logs are returned:
  ERC-721 shares topic0 but carries an indexed `tokenId` as its fourth topic.
  Native-coin transfers are **deliberately absent** — they are not in a token
  contract's logs, they belong to balance sync, and saying so on the method is
  better than a silent gap that reads like coverage.
- **Write side:** `TransactionsService.recordObserved()`, because `create()`
  describes an intent nobody filed — it asks when the intent expires and whether
  the asset may be transferred, and refusing to record a deposit because a token
  is currently frozen would put a hole exactly where an operator needs to look.
  Three differences that matter: no `transferSupported` check; **the hash is
  present on the first write**, since `@@unique([chainId, txHash])` constrains
  nothing while the column is still NULL and Postgres treats NULLs as distinct;
  and the row is born at the state its depth already warrants, so a twelve-block
  transfer is never written as `pending` beside `confirmations: 12`.
- **The cursor has no column, on purpose.** It is read from `JobRun.detail`,
  which already exists, is already redacted and is already retained. Every way
  of losing it — a crash with no `finish`, a failed run, 200 pruned records —
  falls back to a trailing window, which re-does work instead of skipping it.
  The unrecoverable case is stated rather than hidden: a transfer older than the
  window that was never seen.
- **A defect found because nothing had ever exercised it:** `assertEntitled`
  accepted the `system` actor and `assertOperator` did not, so `observe()` — the
  only method that moves a row with depth — rejected the one caller built to
  call it. Both now share the rule, and the property that makes it safe is
  pinned by a test: `system` is absent from `ROLE_RANK`, so no session can hold
  it. `observe` also takes the run's clock now, so a job is anchored to
  `ctx.now` rather than the wall clock.
- **Verification:** 28 tests. Nine mutations — the `system` branch, orphan
  detection, the trailing window, the unknown-token skip, the idempotency
  guard, the budget check, the depth-derived state, the amount summation, the
  resume margin, plus the failed-run cursor — **all killed**.
- **Not done, and it is not code:** the acceptance criterion asks for tests
  against Sepolia or a local node. There is no node binary on this machine and
  no funded address holding a registered token, so the RPC seam is stubbed and
  viem's log decoding is the part left unverified. Everything above that seam
  runs for real. Closing it is a run against a node.

### ADR-022 — Gas is sponsored through an ERC-4337 paymaster, and only for first-party operations
- `BE-603`, closed as an investigation rather than a build.
- **Decision:** passkey-owned ERC-4337 account, gas paid by a paymaster,
  **first-party operations only** — a paymaster that sponsors any transfer is an
  open faucet, and Correnthian can price gas into a first-party flow.
- **Rejected on consistency, not mechanics:** EOA + relayer and EIP-7702 both
  need a seed phrase, which contradicts the account model `packages/wallet-core`
  already specifies. Requiring the user to hold gas is the beachhead's first
  wall.
- **The boundary holds because the signature is made on the device.** The
  paymaster pays and does not sign; conflating those turns sponsorship into
  custody. The failure to design against is ever holding or reconstructing the
  owner key server-side.
- **The useful finding:** `BlockchainAdapter.estimateFee()` and
  `Chain.gasPriceUsd` already exist and **nothing calls `estimateFee`** — the
  knowledge half of the problem is built, only settlement is missing.
- Implementation stays on the do-not-start list until an account implementation
  and a paymaster are chosen. Recorded as build-time choices, not decided.

### `fb4587c` — Generate the OpenAPI response schemas from the contract registry
- `BE-102`. The served document was 78 paths with summaries, **zero response
  schemas, zero component schemas** — Swagger builds from route metadata, and
  every Correnthian route validates through Zod instead, so there was none.
- **It also had no `/api/v1` prefix.** Swagger reads the controller's registered
  path and the version middleware adds the prefix at request time, so the
  document described the *legacy unversioned alias* as the route — and that
  alias is removed on 2026-12-01. The canonical path is now added and the
  original marked `deprecated` with its sunset date.
- Schemas come from `CONTRACT_REGISTRY`, the same object `contracts.spec.ts`
  parses real responses with, so `/docs` and the contract suite cannot drift.
- `createContractDocument` is used by both `main.ts` and the test — asserting
  against a second copy of the wiring is how a green test and a broken endpoint
  coexist. 8 tests, mutation-checked on both the wiring and the schema source.
- **Not decided:** whether `/docs` is exposed in production. A disclosure
  question, recorded in the entry, implemented neither way.

### `3f0ca1f` — Exercise every route over HTTP, without a session
- `BE-1702`, first half. 21 of 22 controllers had no test outside the contract
  suite, and `DEF-001` shipped as a fully unit-tested *dead endpoint* because
  the service was tested, the controller was not, and nothing in between
  exercised the route.
- **86 routes, 7 public, 79 not.** Anonymous requests assert three things:
  non-public routes answer 401, `@Public` routes do not, nothing answers 500.
- **Discovery, not a checked-in list** — a controller added tomorrow is
  exercised tomorrow. Two guards keep discovery honest: every controller file
  must yield a route (a parser that stops understanding a new decorator would
  shrink coverage while every assertion stayed green), and the public set is
  pinned, because a route that *becomes* public is just discovered as public.
- **Mutation-checked:** stripping `@Public()` from `/auth/login`, adding it to
  `GET /users`, and unregistering `SessionGuard` each fail the suite.
- Claims Redis database 14 like the rate-limit spec: every suite spends from one
  shared `rate:auth:ip:127.0.0.1` counter with a budget of 10, and these four
  sign-in requests pushed another suite's register into 429. Six clean full runs
  after isolating.

### `aa45cd8` — Run the Prisma-write guard in CI
- `DEF-018`, second half. The static-guards job ran the other two checks and
  never this one — so a guard that exited 1 was excluded from the only thing
  that would have surfaced it. It had been broken *and* green for weeks
  precisely because nobody invoked it.
- Job display name becomes "Static guards"; the id stays `key-boundary`
  because `ARCHITECTURE.md` refers to it by that name.

### `9b80932` — Make the Prisma-write guard fail when it should
- `DEF-018`, first half. It reported `Provider.where` and `Provider.data` at
  `provider-health.service.ts:142` — neither is a column, they are the
  *arguments* to `update`.
- **Shorthand:** `{ where, data }` marks `valueStart: -1`, and the fallback for
  a missing value used `argStart` — the enclosing `update(...)`.
- **Whitespace, the one that mattered more:** at depth 1 a newline after a
  comma fell through to the fallback that clears `expectKey`, so the next
  property was consumed a character at a time. **A property directly after a
  comment was never checked** — a green run from a guard inspecting nothing.
- `--src=` / `--schema=` so a test can point it at a fixture, plus a readable
  exit-2 message for a wrong path.
- 7 tests spawn the script and assert it *fails* on a typo, on a property after
  a comment, and on the shorthand case. A guard that passes everything and one
  that is broken are indistinguishable from a green run.

### `f2cf8d2` — Put the two existing copies of the cursor helpers on the shared module
- `swaps.service.ts` and `transactions.service.ts` each carried a byte-identical
  `encodeCursor`/`decodeCursor` — same base64url `{ t, i }`, same validation,
  same error message. All four paginating lists now share one implementation
  instead of three kept in step by hand.
- Records a first attempt that cut too wide with a comment-boundary search and
  deleted `ROW_INCLUDE` alongside the cursor block; redone against exact
  anchors.

### `9c2b480` — Paginate the two admin lists on the whole sort key
- `DEF-015`. `users.list` and `devices.listAll` ordered by a timestamp but
  paginated with `cursor: { id }` and `skip: 1` — half the sort key. Two rows
  sharing a timestamp are ordered by nothing, so the page boundary can move and
  the list an operator reconciles money against shows a duplicate or a gap.
- **The comment already claimed keyset pagination**, which is how it survived
  two re-verifications.
- Both now sort on `[timestamp desc, id desc]`, filter over both halves, and
  return an opaque cursor. A raw-id cursor would let a client order the list
  however it likes; an unreadable one is a 400 rather than a silent restart at
  page one, because a restart hides a client bug behind a page that looks
  correct.
- **Two failures the types could not see**, caught by tests: the filter was
  first spread outside `where` (Prisma ignored it; spreading an `object`
  contributes no known properties to check), and it needed `AND` nesting because
  `users.list` ORs across email and displayName when searching.
- 28 tests; **11 fail against the pre-fix code**.

### `c21be31` — Run the e2e suite in CI, so the one I just fixed is not decorative
- `pnpm test` matches `**/*.spec.ts` and `test:e2e` matches `**/*.e2e-spec.ts`.
  Neither runs the other, and CI only ran the first — so the scaffold e2e had
  been failing since it was written and no build ever turned red.
- That is the second half of `DEF-013`. Fixing the assertion without wiring the
  suite would have produced a green test nothing executes, which is the shape of
  `DEF-018` and which this repository already records as a defect: a check
  nobody wires up is a comment.

### `00b095a` — Correct three artifacts that described something other than the code
- `DEF-011`: the comment above `validateEvmAddress` said mixed-case addresses
  are refused and cited an `EIP55_SUPPORTED` marker that exists nowhere, while
  the function below verified EIP-55 with viem's keccak256 and tests covered
  the canonical vectors. The dangerous reading is the one that could get a real
  check *removed*. Also rehomed an orphaned comment onto `toChecksum`.
- `DEF-012`: `AuditRow` was hand-written under a comment claiming the registry
  did not cover it — and was missing `actorEmail`, `reason` and `requestId`, so
  the dashboard showed a cuid where an address could have gone. Now inferred
  from the registry; `QuoteStats` deleted as dead.
- `DEF-017`: `ProvidersService` injected and never read, removed.
- **This is a redone.** An earlier attempt at `DEF-012` was never committed and
  a later revert of unrelated work discarded it silently.

### `31ed198` — Replace the scaffold e2e test with one that can pass
- `test/app.e2e-spec.ts` asserted `GET /` returned `Hello World!`. There is no
  root route; it answers 404. `pnpm test:e2e` had never passed — which is why
  nobody noticed CI does not run it either.
- Replaced with four properties that need no fixtures: the app boots, liveness
  answers without consulting a dependency, readiness reports `dependencies`
  under either 200 or 503, and a protected route refuses an anonymous caller
  with the error envelope. Plus the fact the old test got wrong.
- Skips locally without a database, **throws in CI** rather than skipping — a
  smoke test that is not run is worse than none.

### `9403bab` — Stop generated output living beside its sources
- `DEF-010`: 20 `.js`/`.d.ts`/`.map` files committed under `packages/*/src`
  beside the `.ts` they came from. Unreachable — every package exports
  `./dist/` — and they drift silently.
- Both directions closed in `.gitignore`: the output patterns are ignored and
  `.ts` is deliberately not, so hand-written JavaScript in a package stays
  visible.

### `8b4d408` — Make the portfolio report missing wallets as 404 and money exactly
- `DEF-007`: `forWallet` threw a bare `Error`, which the exception filter
  classifies as internal — so asking for a wallet you do not have returned
  **500**, conflating "you asked for something you cannot have" with "we are
  broken".
- `DEF-008`: `Number(balanceRaw) / 10 ** decimals` sat three lines below a
  comment forbidding exactly that. Valuation now runs through `notionalUsd` and
  `sumUsd` — the same bigint arithmetic the fees engine uses, so both sides of a
  future `BE-1602` reconciliation agree.
- **The severity, stated honestly:** a search found **no input between $1 and
  $100,000** where the old float path disagrees with the exact one at 8 decimal
  places. Divergence appears above `$10^15` and in sub-cent holdings. This was a
  real correctness bug and a comment that lied — not a wrong number anyone was
  shown.
- Money on the wire is now a decimal string. `GET /portfolio` has no contract,
  no consumer and no test, so nothing was reading the numbers it changed.
- 7 tests, every one failing against the pre-fix code.

### `7699d97` — Correct every document that stated the opposite of the code
- `DEF-014`. Four documents contradicted the repository: `README.md` and
  `engineering/standards.md` called `packages/*` "source-only, no build step"
  while all thirteen run `tsc -p tsconfig.package.json`;
  `engineering/api.md` said "Nothing exists yet — there is no auth module, no
  users module, no session handling" against twenty registered modules;
  `engineering/admin.md` said `apps/admin/` does not exist.
- **The shared failure mode, and why a banner is not a fix.** Each had a
  correction notice at the top while the operative section underneath still
  taught the old thing. `standards.md` had carried "SUPERSEDED in one respect"
  since 2026-10-06 and §1 still said the opposite. Nobody reaches a standard
  through its banner, so the sections were corrected instead of the warnings
  around them.
- `api.md` now carries a status table driven by the same field as
  `BACKEND_TASKS.md`, so the two cannot drift — and it closes by naming what is
  actually missing: the layer that moves money.
- The stale-docs inventory in `docs/agent/README.md` is empty now, kept as a
  record of what was wrong and of the failure mode so the next one is fixed
  where it is read.

---

## 2026-10-08

### `7be8a6c` — Make the readiness probe return 503 when a dependency is down
- `DEF-006`. The docstring has always promised "fails with 503 … so traffic is
  diverted, not dropped" and the handler always answered 200 with a `degraded`
  flag, so an orchestrator reading only the status code kept routing to a
  process that could not serve — a dependency failure wearing the costume of a
  load problem.
- **Observed on the running build before the change:** Redis stopped,
  `GET /health/ready` → **200**. After: **503**, same body.
- The status is set through `@Res({ passthrough: true })`, not by throwing, and
  that is the substance of the fix: `AllExceptionsFilter` rewrites any exception
  into the shared envelope, so throwing would have returned 503 with
  `dependencies` replaced by `detail` — and every consumer reads
  `dependencies` to learn *which* thing is down. Diverting traffic must not cost
  the operator the reason.
- Liveness deliberately unchanged and now asserted: an outage must pull a
  process from rotation, not make an orchestrator restart a healthy one.
- Verified live: 200 healthy → 503 with `redis: down` → liveness still 200 →
  200 on recovery. 9 controller tests for the failure paths.

### `9d90f67` — Stop the rate-limit live spec depending on a shared Redis keyspace
- It failed roughly one run in four, always in a different test, and every
  cause was another suite rather than the limiter: three suites flush
  `correnthian:rate:*` in their own `beforeAll`, so a counter read could vanish
  and a ceiling loop could be reset before reaching its ceiling.
- The suite also never set trust proxy — `main.ts` sets it and the suite never
  runs `main.ts` — so `X-Forwarded-For` was ignored and the test written to
  catch a key-on-IP guard would have passed against one.
- The suite now owns Redis database 15, asserts through response headers
  computed inside the request, mints both sessions in `beforeAll`, and sets
  trust proxy beside the version wiring that already had to be duplicated.
- Six consecutive clean full runs afterwards (470 tests each).

### `689b96b` — Name BE-603 as the next investigation, and say what "Open" defaults to
- Gas sponsorship and account abstraction becomes the fourth item after this
  sprint, and an *investigation* rather than a build — which the "Do not start"
  table now says explicitly, so nominating it does not contradict forbidding it.
- ADR-021 now states that while it is Open the recorded decision governs: an
  undecided widening is a narrowing, because the narrower thing is what is
  built, tested and reasoned about.

### `b89cb52` — Record the product document's scope deltas instead of adopting them
- The owner's product document proposes seven chains at launch, Web3 and
  seed-phrase recovery. Three of those conflict with decisions already recorded
  here, so all three are `Open` in ADR-021 rather than implemented or rejected.
- Six features it raised that had never been tracked are now backlog entries
  (`BE-204`, `BE-205`, `BE-402`, `BE-603`, `BE-1106`, `BE-1506`), two of them
  marked do-not-build until ADR-021 is called.
- Summary counts recomputed from the `Status` field: **61 tasks and 19
  defects**, not 56 and 17 — and not "17 defects, all BACKLOG", when seven were
  already done.

---

## 2026-10-07

### `8c48624` — Make the rate limiter obey config, and count against the session
- `DEF-004`. The guard hardcoded `WINDOW_SECONDS = 60` and `{ auth: 10,
  api: 120 }` while `@correnthian/config` validated environment variables that
  changed nothing. Limits now come from `ConfigService`.
- `rateLimit.authMaxRequests` (`RATE_LIMIT_AUTH_MAX_REQUESTS`) is new. There
  was never a knob for the sign-in ceiling — `RATE_LIMIT_MAX_REQUESTS` only
  ever described the general budget, so raising it for a bulk import widened
  the budget credential stuffing runs against, with nothing in `.env` to say
  so. The two are deliberately not derived from one another.
- `DEF-005`. The guard bucketed by IP despite a comment claiming otherwise.
  **Reordering it after `SessionGuard` is not the fix**, which is the part
  worth recording: `SessionGuard` returns early on `@Public()` routes and
  `POST /auth/login` has to be public — you cannot require a session to obtain
  one. Reordering would fix only routes that never needed it and leave
  credential stuffing bucketed by IP, precisely because it has no session.
- The guard now reads the `Bearer` header itself and keys on
  `session:<sha256(token)>`, byte-for-byte `Session.tokenHash`, falling back to
  `ip:<address>`. Arithmetic, not a lookup: a limiter that queries Postgres to
  decide admission has made the database a dependency of the thing protecting
  it. Stated rather than buried: the unit is the session, so one account with N
  sessions holds N budgets — bounded, because session creation is authenticated.
- **The route bucket stays in the key.** Dropping it once seemed tidy and would
  have merged the budgets, so ten logins consumed the general API budget — the
  exact inversion this guard exists to prevent.
- `DEF-019`, found because this change added a fifth booted application and
  shifted timing: `idempotency.spec` adopted `enabled: true, take: 2` with no
  issuer filter and quoted `redemption.controller.spec`'s own fixture asset
  (`RSPG` sorts before `tGOLD`), so redemption's teardown failed on
  `SwapQuote_fromAssetId_fkey` — an intermittent failure with no visible
  connection to idempotency. Measured **0/11 baseline runs failed, 4/21 with
  the new suite, 0/8 after scoping the query** to the issuer
  `contracts.spec.ts` already used. Test suites sharing one database may adopt
  fixtures only from rows they own.
- **Verified twice over.** Unit and live specs were each mutated back to the
  pre-fix guard and confirmed to fail first — 10 unit tests, 5 live, with
  messages that name the defect (`expected '10' to be '2'`,
  `expected +0 to be 1`, `[401 ×8] to include 429`). Then against a running
  API: limits answered `7`, `3`, `45` from configuration; one token went
  `6 → 5` across two addresses; two tokens from one address went `6` and `6`;
  the key matched `Session.tokenHash` in 1 of 143 sessions.

## 2026-10-07

### `50cb8a1` — Gate the operations console on role, not just on a session
- `DEF-016`. `loginAction` stored whatever role the API returned and the
  dashboard layout redirected only when there was no session, so a customer
  account was handed the whole operations shell — navigation, branding, a dozen
  panels each returning empty because the API refuses the same account on every
  call. The console now states the restriction instead of rendering it as
  confusion.
- Sign-in refuses a role below `support` *before* `setSession`, so no session
  is written at all: nothing for the shell to gate, no cookie to strip. The
  layout gates again, because a session outlives a role change. `/unauthorized`
  is the landing page, and its two redirects are what stop it bouncing against
  `/login`, which already sends any session to `/dashboard`.
- Both redirects are `return redirect(...)`. Next's `redirect` halts by
  throwing, and a guard that depends on that stops guarding the moment it is
  called from somewhere that does not. The test proved it: with a bare call the
  layout walked past its own redirect and threw on `session.role`.
- The rank table moved out of `lib/api-server` into `lib/roles`. That module is
  `server-only`, which throws on import anywhere but a React Server runtime, so
  the table had never been reachable by a test — and the table is the one thing
  an agent forks. The API already carries a duplicate of this hierarchy and it
  drifted once.
- **It is a UX gate and is documented as one.** `getSession()` reads an
  unsigned cookie, so the role it reports is display state a client could edit.
  The API re-checks authorisation on every call and that remains the real
  control. The note lives in `lib/roles.ts` so the next reader does not promote
  it to a security control.
- The admin had no test runner. It has vitest and 21 tests now, covering the
  rank matrix, the sign-in gate and the shell gate. The four that exercise the
  gates were confirmed to fail with the gates removed, then pass with them back.

### Docs — re-synchronised with the code
- `BACKEND_TASKS.md` still listed `DEF-001` through `DEF-017` as `BACKLOG`
  after four of them were fixed, and `CURRENT_SPRINT.md` still named `DEF-001`
  as the current task two commits after it was done. A tracker that lags the
  code is the same failure mode as one that lies outright, so the defect section
  was re-verified line by line rather than trusted.
- The pass corrected two that had been read as fixed: `DEF-005` looks fixed if
  you read `req.user?.id ?? req.ip` and stop, but `RateLimitGuard` is still
  registered before `SessionGuard` so that expression never runs with a user;
  `DEF-015` looks fixed if you read the comment above `users.list` and stop,
  but the code beneath it paginates on the primary key.
- `DEF-018` recorded: `check-prisma-writes.mjs` exits 1 on a false positive and
  `ci.yml` does not run it — a guard that fails and is excluded protects
  nothing. Tracked, not fixed.
- The status vocabulary in `BACKEND_TASKS.md` now lists `PARTIAL` and `OPEN`,
  which the file used throughout and plan §67 never defined.

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