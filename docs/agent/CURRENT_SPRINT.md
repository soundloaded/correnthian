# CURRENT_SPRINT

Read this every time before starting work. It is deliberately short: it names
the task, what is finished, what is next, and — most importantly — what must
not be started.

Last updated: 2026-10-07.

---

## Sprint: Backend Foundation 002 — Audit and Defect Clearance

The previous sprint built the admin and the wire-format contract layer. This
sprint exists because reading the code found defects that no test, no typecheck
and no contract assertion catches. Several were silent. There are nineteen
recorded (`DEF-001` … `DEF-019`); **seven are done**.

### Current task

**`DEF-006` — the readiness probe never returns 503.**

- **Why this one:** everything in `BACKEND-15` assumes health checks work. An
  orchestrator reading only the status code currently keeps routing traffic to a
  process that cannot serve it, and the docstring on the handler promises
  otherwise. It is the cheapest defect left and it gates the hardening phase.
- **File:** `services/api/src/health/health.controller.ts`
- **What is wrong:** `ready()` computes `status: ok | degraded` from the
  database and Redis checks and returns HTTP 200 in both cases. The comment
  above it says "Fails with 503 when a required dependency is down so traffic is
  diverted, not dropped."
- **Definition of done:** `/health/ready` returns 503 when either dependency is
  down and 200 when both are up; a test covers the failure path, not only the
  healthy one.
- **Decision to make rather than assume:** if 503 is wrong — if the intent is a
  soft status for dashboards — then the docstring changes instead and the
  orchestrator wiring is documented as out of scope. Either answer is
  acceptable; leaving the promise and the behaviour disagreeing is not.
- **Security constraint:** none specific, but a probe that throws must not be
  able to take the process down. Keep the check inside the handler.

### Then, in order

| # | Task | Why it is next |
|---|---|---|
| 2 | `DEF-014` — `README.md`, `docs/engineering/standards.md` and `docs/engineering/api.md` state the opposite of the code | An agent will act on them. This file is not the only one being read. |
| 3 | `DEF-007` / `DEF-008` — the portfolio returns 500 for a missing wallet, and sums floats | `054fdb9` established exact bigint money for fees. The portfolio then floats the same numbers. Two notions of a dollar must not coexist into `BE-1602`. |
| 4 | `DEF-009` — `claimBatch` claims nothing | Two workers receive the same rows, and the comment above the function says otherwise. |
| 5 | `DEF-010`, `DEF-011`, `DEF-012`, `DEF-013`, `DEF-017` — the bounded remainder | No dependency, all small, none urgent. |
| 6 | `DEF-018` — the Prisma-write guard fails and is not in CI | Recording it here rather than fixing it: it is tracked, and it is not this sprint's work. |

### Completed in this sprint

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

1. The remaining fourteen defects — `DEF-007` onward, mostly small, plus
   `DEF-018` recorded during the re-verification.
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
| **Smart accounts, passkeys, ERC-4337, paymaster, guardians** | No implementation exists — only interfaces in `packages/types` and `packages/wallet-core`. There is nothing to build on and no account contract to deploy against. Getting this wrong also breaks the key boundary, which is the one property that cannot be compromised. **An investigation is not a start** — `BE-603` exists to *decide* this and reports back as an ADR. Writing the adapter, the paymaster or the account contract is what is forbidden, and forbidden until that ADR exists. |
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