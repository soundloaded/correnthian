# CURRENT_SPRINT

Read this every time before starting work. It is deliberately short: it names
the task, what is finished, what is next, and — most importantly — what must
not be started.

Last updated: 2026-10-10.

---

## Sprint: Backend Foundation 002 — Audit and Defect Clearance

> **Defect phase complete.** 20 of 21 defects are `DONE`, the one that is
> not (`DEF-009`) is `PARTIAL` and gated on a decision outside code, and
> nothing remains in `BACKLOG`. Work below has moved on to what the defects
> were blocking.

The sprint began because reading the code found defects that no test, no
typecheck and no contract assertion catches. Several were silent — including one
where a guard had stopped checking anything and reported a green run. There are twenty-one
recorded (`DEF-001` … `DEF-021`); **twenty are done, one is half fixed, none are `BACKLOG`**.

### Current task

**Next: the node-backed acceptance run (now covering BE-302, BE-601, BE-602
plus the KYC webhook shapes), then `BE-1102` if risk scoring is wanted for v1.**
`BE-1101` / `BE-1105` are built and measured: the
send path walks intent → build → sign → broadcast with the payload verified
against what the server assembled. What remains of the transaction story is
shared with `BE-302`/`BE-601` — one run against a real node (item 2).

**Done:** `BE-601` was built and measured: the
scope was written by running the real job against a stub node rather than
reading the source, `DEF-020` — which that uncovered — is fixed, and the sweep
itself was verified against the same setup across four cases. What `BE-601` and
`BE-302` still share is a real node, which is item 2. The old `BE-102`
production-`/docs` question is still undecided and is now item 4.

- **`BE-302` is `PARTIAL`, and the gap is verification rather than code.**
  Balance sync and event indexing both exist. `getTokenTransfers` observes
  ERC-20 logs, `TransactionIndexingService` writes one `Transaction` row per
  hash through `TransactionsService.recordObserved()`, the depth sweep promotes
  and demotes rows against the current head, and `blockchain.index-transactions`
  runs the whole thing every 60s. All three definition-of-done bullets are
  covered by tests that were mutation-checked: nine deliberate breaks, nine
  failures.
- **Why it is not `DONE`:** the acceptance criterion says tests "against
  Sepolia or a local node, not mocks", and this machine has neither a node
  binary nor a funded address holding a registered token. The RPC wire is now
  covered by stubbing `fetch` in node shape — so viem's topic encoding and log
  decoding are pinned, not assumed — but a stub is still not a node: no live
  reorg, no provider rate limits, no wallet that really holds a registered
  token. Everything above the wire is real: the lifecycle table, `observe()`'s
  promote/demote rules, the audit trail, and a store that enforces
  `@@unique([chainId, txHash])`. Closing it is a run against a node, not a
  code change.
- **A defect found on the way, now fixed:** `assertEntitled` accepted the
  `system` actor and `assertOperator` did not, so `observe()` — the only method
  that moves a row with depth — rejected the one caller built to call it. It had
  never surfaced because nothing scheduled called `observe` before this. Both
  now share the same rule, and a test pins the property that makes it safe:
  `system` is absent from `ROLE_RANK`, so no session can carry it.
- **Dependency for what follows:** `BE-601` depends on `BE-302`, which is now
  satisfied.

### Then, in order

| # | Task | Why it is next |
|---|---|---|
| 1 | Sandbox run for the KYC vendor path + node-backed acceptance for `BE-302`, `BE-601`, `BE-602` | Persona literals verified against the docs; what remains is credentials (Persona sandbox key, secret, template id) and a live run, plus a node and funded address for the chain half. |
| 2 | `BE-1102` — risk engine, if it is v1 | Explicitly out of the KYC scope; velocity/structuring detection is the remaining unbuilt compliance piece. |
| 3 | `BE-102`'s open question — is `/docs` exposed in production? | Not decided. An API schema is a map of everything an attacker can call; the answer is a disclosure decision, not a technical one. |
| 4 | ADR-022's build-time choices — account implementation, paymaster, EntryPoint | Gated on a vendor or a contract, same as `BE-802`. Recording them as decided would repeat the `claimBatch` mistake. |
| 5 | Contract entries for every write route | The two new `BE-602` routes have no `packages/contracts` entry, matching `POST /transactions` and `:id/transitions`. Whether *every* write route gets one is a sweep, not a patch. |

**Still open, deliberately not scheduled:**

| | Why it waits |
|---|---|
| `DEF-009` | `PARTIAL`. The comment is honest; the claim mechanism needs a column, a lease with a timeout and a requeue path — design questions belonging to ADR-020's transport decision, not a patch for a method nothing calls. |

---

### The `PARTIAL` pass — 15 entries, sorted

Every `PARTIAL` entry was read and its claims checked against the code, rather
than taken from the tracker — which is what this pass exists for. The 15 sort
into four groups, and only the first is a queue.

**Not blocked. Real remaining code work (6).**

| Task | What is actually left |
|---|---|
| `BE-1703` | ~~**`RolesGuard` has no test.**~~ **Done 2026-10-09** — 11 unit tests plus an HTTP suite over all 40 gated routes (customer → 403, pinned gate list, admin-admission control). Building it found `DEF-021`. Still missing: SAST, dependency audit, secret scanning beyond env files, rate-limit bypass testing. |
| `BE-1702` | Controller/service specs. The gap `DEF-001` fell through. |
| `BE-1701` | `QuoteState` has six states; `swaps.service.ts:215` writes `quoted` and nothing else. |
| `BE-501` | Allocation, history charting, scheduled snapshots. `capture` is only reached by its own endpoint. |
| `BE-105` | Metrics, traces, error reporting. `SENTRY_DSN` and `OTEL_EXPORTER_OTLP_ENDPOINT` are in `.env.example` and read by nothing — verified. |
| `SEC-001` | The threat model document itself. Scoped to API + admin, and writable now; nothing external gates it. |

**Verification only — needs a node (2):** `BE-302`, `BE-601`. One run covers
both; both were proven against a stub node speaking real JSON-RPC.

**Gated by a decision outside code, or on the do-not-start list (6):**

| Task | Gate |
|---|---|
| `DEF-009` | ADR-020 transport decision |
| `BE-1201` | Deliberately not sending — ADR-020 |
| `BE-1104` | "Do not write a fee number that is not in code" |
| `BE-502` | Pricing feed — "no provider is contracted" |
| `BE-401` | Counsel-reviewed verification criteria |
| `BE-1704` | The repository has no remote and no environment to deploy to |

**Nothing waits on it (1):** `BE-004`. Its status says a queue is missing, and
it is — but no producer exists either: `notifications.enqueue()` writes a row
to Postgres, jobs are scheduled rather than enqueued. Building BullMQ now
would be building against no consumer. Its entry was also wrong about
something else: it claimed "no job runner" while `JobScheduler` was driving six
of them off a Redis lease.

**Three tracker claims corrected while sorting:** `BE-004` above; `BE-501`'s
heading pointed at `DEF-007`/`DEF-008`, both of which are `DONE`; and
`BE-502` said "no price is ever recorded by any code" when `PricingService.record()`
exists and is called by `POST /pricing/record`.

**§21 was wrong for the third time**, and disagreed with §2 of the same file.
`scripts/check-task-counts.mjs` now recomputes it from the entries and is wired
into CI, so the next one fails the build instead of shipping.

---

### Completed in this sprint

- **Autonomous PARTIAL sweep (2026-10-10).** BE-1703 (dep + secret gates,
  both in CI with failing-proof specs), BE-105 (Sentry/OTel wired
  optionally), SEC-001 (threat model document, practice open by design),
  BE-1701 (corrected: expiry writes, rest awaits execution), BE-501
  (snapshots stay manual until pricing — quota spent on `$0` rows
  otherwise). Nine checks green, 698 API tests, lint below baseline.
  Deliberately not started: anything gated (BE-1104/BE-502/BE-401/BE-1201),
  anything deferred by design (adapters, clients, microservices), and
  large underspecified builds (BE-1102 risk engine has no rules to
  implement — inventing scoring would be fabrication, not engineering).

- **`BE-602` — send/receive backend, `DONE`.** The server assembles, the
  device signs, the server relays — and *verifies before it relays*. Three
  commits: a module restructure so `transactions → blockchain` is acyclic
  (the indexer moved home; every `Transaction` writer now shares the module
  that owns the lifecycle); the adapter half, where `buildTransaction` learned
  to be signable at all (it returned no nonce and no fee caps — a device
  filling those in would be doing its own assembly) and gained ERC-20
  encoding plus a pure `assemblePayload` and a `decodeSignedTransaction`
  that **recovers the signer from the signature**; and the service half,
  where `assemble` records the exact fee the account holder was shown and
  `relay` checks signer, chain and `to`/`value`/`data` against the
  assembled intent before any network call. Failures split 503/400 so a
  retryable outage is not billed to the caller as their mistake, and the
  400 path redacts — `summariseError`'s comment always promised that and
  only truncation delivered; `redact()` gained a URL rule. 35 tests across
  four packages, **11 mutations all killed**, one survivor found and the
  redundant guard it exposed removed rather than the test weakened.
  Receive needed nothing: a registered address is the receive side.

- **`BE-1703`'s headline item — `RolesGuard`, tested at two layers.** Eleven
  unit tests pin the guard's decisions (hierarchy both ways, unknown held
  role denied, unknown *requirement* denied for everyone including `owner`,
  absent identity denied rather than crashing). An HTTP suite
  (`test/roles.spec.ts`) then proves over all **40 role-gated routes** that a
  real registered `user` session gets 403 — not 401, not 200, not 500 — that
  the gated set is pinned so a route *losing* its `@Roles()` fails, and that
  an `admin` session is admitted where the hierarchy admits it. That last
  control is why the suite is trustworthy, and it was **itself broken when
  written**: it filtered `method === 'GET'` against discovery's `Get`, ran
  zero iterations, and passed. A mutation run caught it; the loop now asserts
  its own iteration count first. 8 mutations, all killed.
- **`DEF-021`** — discovered while building the above: the controller parser
  (copied into three specs) located handlers with a fixed 400-character
  look-ahead, and `GET /jobs`'s long `@ApiOperation` sat beyond it. One of the
  API's 87 routes was invisible to the anonymous-401 guard, the public pin
  and the no-500 check — with the per-file and total-count checks green.
  Replaced by one shared `test/discover.ts` whose handler lookup is a line
  walk with no length limit, plus an invariant: discovery must return exactly
  as many routes as there are route decorators, counted by an independent
  looser regex. Fixed and mutation-checked the same day.

- **`BE-601` — the confirmation sweep, built and measured.** `sweepByHash`
  asks the chain about the transactions no log can describe: native-coin
  sends, unregistered or disabled tokens, and anything not yet mined or never
  to be. All four sat in `broadcast` forever; all four are now handled by one
  question asked about a hash. Verified against the real database through a
  stub node on four cases — mined writes its block and depth, absent is
  dropped after a 60-second grace window, reverted becomes `failed`, and a
  send broadcast seconds ago is left alone. The query is `state = 'broadcast'`
  because that is the only state a row can be waiting in, which takes
  already-dropped rows out of scope by construction rather than by a filter.
  The run record also names its skips now, after a control case wrote nothing
  and said only `created: 0`. 8 tests, eight mutations killed.

- **`DEF-020` — fixed.** `getTransaction` used to be unable to say "the node
  does not have this": a `null` result and a node failure both threw, and
  `RpcPool.withFailover` wrapped both as `All N RPC endpoint(s) failed for this
  read`. Drop detection built on it would have set `droppedAt` on live
  transactions during any RPC blip. `RpcAbsent` now passes through the pool
  without quarantining the endpoint and is only propagated once **every**
  endpoint has said no, so one stale node cannot declare a transaction gone.
  The contract is honest too: `null` replaces `'dropped'`, `'failed'` is read
  from the receipt rather than asserted by inclusion, and `confirmations` and
  `blockTime` — both hard-coded and unfillable — are removed rather than
  documented. 10 tests, seven mutations, all killed.

- **`BE-601` scoped by measurement.** The real job and services were booted
  through Nest against the development database with a local stub node standing
  in for `eth_*` — no third-party RPC, and chain 1's `rpcUrls` restored
  afterwards. Three results: an inbound ERC-20 log **does** produce a correct
  row (`state: pending`, `blockNumber: 995`, `confirmations: 5`); a transaction
  the node has **mined** does not advance, because `eth_getTransactionByHash`
  is called by nothing in the repository; and a transaction the node has
  **never heard of** is not detected as dropped either. The remainder is one
  mechanism — a hash-keyed confirmation sweep — covering native sends,
  never-mined sends, unregistered tokens and the mempool window, all of which
  the log scan structurally cannot see.
- **`DEF-020`**, found on the way: `getTransaction` conflates "the node does
  not have this" with "the node failed", because `RpcPool.withFailover` wraps
  both identically. Drop detection built on that would mark live transactions
  dropped during any RPC blip.

- **No test in any `packages/*` was ever typechecked.** All thirteen
  `tsconfig.package.json` files exclude `src/**/__tests__/**` so tests stay out
  of `dist` — and `typecheck` reuses that config, so the exclusion applied to
  checking too. It was found because `transfers.test.ts` passed `['http://…']`
  where `RpcEndpoint` requires `{url}`; the adapter it built would have thrown
  "No URL was provided to the Transport" had `read` not been stubbed out. Fixed
  with a `tsconfig.tests.json` per package and both configs in `typecheck`,
  for the five packages that have `__tests__`. Two errors surfaced and both
  were real.
- `BE-302` — **`PARTIAL`, implementation complete.** The event half of the
  indexer: `getTokenTransfers` on the adapter (two `eth_getLogs` calls, one per
  direction, because a filter constrains one indexed position; de-duplicated on
  `txHash:logIndex`; three-topic check so ERC-721 sharing topic0 is not mistaken
  for a token), `recordObserved` on the service, and a scheduled job with a
  cursor read back from its own run record. **A new column would have been
  tidier and would have needed a migration, which `DEF-003` says never to run
  against a shared database** — so the resume point lives in `JobRun.detail`,
  and every way of losing it falls back to a trailing window, i.e. backwards,
  never past unread blocks. Native-coin transfers are deliberately absent and
  the gap is stated on the method rather than papered over. 28 tests,
  9 mutations, all killed.

- `BE-603` — **ADR-022**, an investigation rather than a build. Gas sponsorship
  settles on ERC-4337 + a paymaster, scoped to first-party operations only,
  because a paymaster that sponsors any transfer is an open faucet. Two
  alternatives rejected for consistency with the account model rather than on
  mechanics: both reintroduce the seed phrase `packages/wallet-core` exists to
  remove. **Useful finding: `estimateFee()` and `Chain.gasPriceUsd` already
  exist and nothing calls `estimateFee`** — the knowledge half is built, only
  settlement is missing.
- `BE-102` — the document `/docs` serves now carries response schemas from
  `CONTRACT_REGISTRY` (`fb4587c`), and its paths are versioned. It had been 78
  paths with **no schemas at all**, describing the legacy unversioned alias
  rather than the route. `createContractDocument` is shared by `main.ts` and the
  test, so a green test describes the served document. 8 tests,
  mutation-checked.
- `DEF-018` — the Prisma-write guard now fails when it should **and** is run by
  CI (`9b80932`, `aa45cd8`). Two parsing bugs, one of which mattered more than
  the reported failure: a property directly after a comment was never checked,
  so the guard could produce a green run while inspecting nothing. 7 tests spawn
  it against fixtures and assert it fails. It had been broken *and* green for
  weeks because CI never invoked it — a check nobody wires up is a comment.
- `DEF-015` — both admin lists now paginate on the whole sort key
  (`9c2b480`, `f2cf8d2`). The comment above `users.list` had claimed keyset
  pagination all along, which is how it survived two re-verifications. Two
  failures the types could not see: the filter was first spread outside
  `where`, so Prisma ignored it and every page returned the same rows, and it
  needed `AND` nesting because `users.list` ORs across email and displayName
  when searching. 28 tests, 11 of which fail against the pre-fix code.
- **The bounded remainder** — `DEF-010`, `DEF-011`, `DEF-012`, `DEF-013`,
  `DEF-017` (`9403bab`, `31ed198`, `00b095a`, `c21be31`). Each was an artifact
  describing something other than the code: generated output committed beside
  its sources, a comment describing the *pre-fix* EIP-55 behaviour while telling
  a reader the check was missing, a hand-written type claiming the registry did
  not cover it, an injection implying rail binding that was never written, and
  an e2e test asserting a root route that has never existed.
  `DEF-013` also got the CI step that was missing — `pnpm test` matches
  `*.spec.ts` and `test:e2e` matches `*.e2e-spec.ts`, so the suite had been
  failing since it was written with no build turning red.
- `DEF-009` — the `claimBatch` docstring now describes the code. Marked
  `PARTIAL`, not `DONE`: the lie is gone but the claim mechanism is not built,
  and building it needs a column that does not exist plus a lease with a
  timeout. That is a design question for ADR-020's transport decision, not a
  patch for a method nothing calls. See the entry for why the obvious fix is
  worse than the bug.
- `DEF-007` / `DEF-008` — the portfolio pair (`8b4d408`). A missing wallet is a
  404 instead of a 500, and balances and totals are exact bigint arithmetic
  through `notionalUsd` / `sumUsd`, the same primitives the fees engine uses.
  Recorded with its real severity: **no input between $1 and $100,000 made the
  old float path disagree with the exact one**, so this was a correctness bug
  and a comment that lied, not a number an operator had been shown. 7 tests, all
  failing against the pre-fix code.
- `DEF-014` — every document that stated the opposite of the code is corrected
  (`README.md`, `docs/engineering/standards.md`, `docs/engineering/api.md`,
  `docs/engineering/admin.md`, `docs/README.md`). The shared failure mode was
  that each had a "superseded" banner at the top while §1 underneath still
  taught the old thing — nobody reads a banner for the operative section, so
  the sections were fixed instead. `api.md` now carries a status table driven by
  the same field as `BACKEND_TASKS.md`, so the two cannot drift. The stale-docs
  inventory in `docs/agent/README.md` is now empty and records what was wrong.
- `DEF-006` — the readiness probe now returns 503 when a dependency is down
  (`7be8a6c`). Verified against the running API with Redis stopped: 503 with
  `redis: down` in the body, liveness still 200 in the same window, recovery
  clean. The status is set through `passthrough` rather than thrown, so
  `dependencies` survives the exception filter and an operator still learns
  which dependency failed. 9 controller tests. It also forced a fix in
  `rate-limit.live.spec.ts` (`9d90f67`), which had been failing roughly one run
  in four because three other suites flush its Redis keys mid-test and the
  suite never set trust proxy — that suite now owns database 15.
- `DEF-004` and `DEF-005` — the rate limiter now obeys its configuration and
  counts against the session (`8c48624`). Limits read from `ConfigService`, with
  `RATE_LIMIT_AUTH_MAX_REQUESTS` added because the sign-in ceiling never had a
  knob at all. Keyed on `sha256(bearer)`, which is byte-for-byte
  `Session.tokenHash`, falling back to the address when there is no token.
  Reordering the guards was *not* the fix: `SessionGuard` returns early on
  `@Public()` routes and `POST /auth/login` has to be public, so reordering
  would have left credential stuffing — the route that most needs it — bucketed
  by IP. Verified against a running API: one token `6 -> 5` across two
  addresses, two tokens `6` and `6` behind one, and the key matched
  `Session.tokenHash` in 1 of 143 sessions.
- `DEF-019` — a test suite adopted fixtures another suite deletes, found because
  adding a fifth booted application shifted timing (0/11 baseline runs failed,
  4/21 with the new suite, 0/8 after scoping the query).
- `DEF-016` — the admin console now gates on role, not just on a session
  (`50cb8a1`). Refused at sign-in before a session is written, gated again at
  the shell, landing on `/unauthorized`. The admin had no test runner; it has
  21 tests now. The gate is documented as a UX control, not a security one —
  `getSession()` still reads an unsigned cookie and the API still authorises
  every call.
- `DEF-001` and `DEF-002` — `5a31c4b`. The redemption controller resolves
  jurisdiction from the authenticated account, and `reviewedBy` is a column.
  `scripts/check-prisma-writes.mjs` was added against the whole class of
  invisible Prisma-write typos.
- `DEF-003` — `7ad3d69`. Schema and database agree; `prisma migrate diff`
  reports no difference, so `migrate dev` can no longer reintroduce the
  uniqueness hole.
- **A re-verification pass over all seventeen defects**, because this file and
  `BACKEND_TASKS.md` still named `DEF-001` as the current task two commits
  after it was fixed. Four are `DONE`, fourteen are `BACKLOG`. Two that had
  been read as fixed are not — see the note in `BACKEND_TASKS.md` §2.
- `BE-101` — API versioning. `/api/v1` on every route; `/health` and `/docs`
  deliberately outside it. The version lifecycle is data, not prose, so retiring
  a version is one line plus an announcement the API already makes on every
  response. Deprecated versions keep working; retired ones return 410 naming the
  successor; the two 404s that used to be indistinguishable now are not.
- `BE-106` — idempotency for the three financial POSTs. Durable in Postgres, not
  Redis, and serialised across instances by a unique index rather than a lock —
  proved by firing six simultaneous duplicates at two separate application
  instances.
- `docs/agent/` — the agent memory system (plan §69), all thirteen documents
  plus an index.
- `TASK.md` folded into `docs/agent/BACKEND_TASKS.md`.
- A full read of the repository against the plan, producing this tracker.

### Completed previously

- The API's full module set: auth, users, devices, assets, issuers, chains,
  providers, wallets, pricing, portfolio, swaps, metals, compliance, audit,
  notifications, on-ramp, blockchain, health.
- `@correnthian/contracts` and the contract suite (ADR-010).
- `BlockchainAdapter`, `EvmAdapter`, `RpcPool`, EIP-55 verification (ADR-005).
- The admin console, eleven route files, real data, no mocks.

### Next, after this sprint

1. `DEF-015` — the last code fix. `DEF-018` is a CI wiring decision and
   `DEF-009` is gated on the transport call.
2. `BE-1702` — controller-level tests. Fourteen routes have none outside the
   contract suite, and DEF-001 exists precisely because of that gap.
3. `BE-102` — generate OpenAPI from `CONTRACT_REGISTRY` rather than shipping a
   document that describes no request or response schemas.
4. **`BE-603` — investigate gas sponsorship and account abstraction.**
   Named rather than left implicit, because it is the one item in the backlog
   the owner's product document asked for directly: "you can't swap because you
   don't have $4 of ETH" is the first wall an ordinary buyer hits, and it is
   worth more to the gold-owner beachhead than a sixth chain.

   **It is an investigation, not a build.** Output is an ADR that settles the
   relayer-vs-paymaster-vs-smart-account question, who bears the gas, whether
   it applies only to metal purchases, and what any of it does to the key
   boundary. The "Do not start" row above forbids the implementation until that
   ADR exists — which is exactly why the investigation has to come first.

---

## Do not start

These are not "later". Each has a reason, and starting one without the reason
being resolved produces work that has to be thrown away.

| Do not start | Because |
|---|---|
| **Any provider integration** — metals, on-ramp, pricing feed, KYC | No provider is contracted. `packages/integrations` is `export {}`. Writing an adapter against an imagined API means rewriting it against a real contract. |
| **Smart accounts, passkeys, ERC-4337, paymaster, guardians** | **The boundary question is closed** — ADR-022 decided the mechanism (passkey-owned ERC-4337 account, paymaster-paid gas, first-party operations only) and showed why it holds. What still forbids starting is that no account implementation and no paymaster have been chosen: `packages/wallet-core` has interfaces only, there is no account contract to deploy against, and a vendor chosen in code rather than in a decision gets rewritten. **Writing the adapter, the paymaster or the contract is still not allowed** — and nothing may hold or reconstruct an owner key server-side, ever. |
| **Bitcoin or Solana adapters** | Deferred by the design spec until after the EVM slice. Nothing in v1 needs them. |
| **Marketing site, web wallet, mobile app** | All three are framework defaults. The API is not stable enough to build a client against, and the product decisions the client depends on (buy flow, redemption mechanics) are blocked on counsel. |
| **A microservice split** | The decision is a modular monolith. A split is not a task; it is an ADR. |
| **`@correnthian/api-client`** | Empty. It has no consumer, and building it before the contract registry covers more routes would produce a client that has to be rewritten. |
| **`packages/ui`, `packages/design-tokens` consumption** | The admin currently uses shadcn defaults and a neutral palette. It does **not** consume `design-tokens`. Mapping the obsidian/silver/gold tokens into the admin is a real design decision, not a mechanical import, and it is not the sprint's work. |
| **Fee percentages, custody terms, provider names** | Nothing in this repository is verified. Do not write a number that is not in code. |
| **DApp browser, WalletConnect, DeFi, CEX routing** | Removed from scope by the design spec. `CexRail` is reserved and should stay reserved — it weakens the key boundary. |
| **`pnpm migrate dev` against any shared database** | See DEF-003. `prisma migrate deploy` only. |

---

## Working rules for this sprint

- **One logical task at a time** unless tasks are genuinely independent.
- Every fix ships with a test that fails without it. DEF-002 is the reason:
  a nonexistent Prisma column typechecks cleanly.
- Update `docs/agent/BACKEND_TASKS.md` and `docs/agent/CHANGELOG.md` in the
  same commit as the fix.
- Before claiming anything works, verify `pnpm typecheck && pnpm test && pnpm
  build`. A change that passes those but was not run against a live database is
  not verified — say so.