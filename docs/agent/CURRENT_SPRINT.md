# CURRENT_SPRINT

Read this every time before starting work. It is deliberately short: it names
the task, what is finished, what is next, and — most importantly — what must
not be started.

Last updated: 2026-10-07.

---

## Sprint: Backend Foundation 002 — Audit and Defect Clearance

The previous sprint built the admin and the wire-format contract layer. This
sprint exists because reading the code found seventeen defects that no test,
no typecheck and no contract assertion catches. Several are silent.

### Current task

**`DEF-004` / `DEF-005` — the rate limiter ignores its config, and cannot see
the user.**

- **Why these two together:** they are one file and one behaviour. Fixing the
  budget without fixing who the budget is keyed on leaves a limiter that is
  correctly configured and still gives every client behind one NAT a shared
  pool — which is the property the config was written to express.
- **File:** `services/api/src/common/guards/rate-limit.guard.ts`,
  registration order in `services/api/src/common/core.module.ts`
- **`DEF-004`:** `packages/config` validates `RATE_LIMIT_MAX_REQUESTS` and
  `RATE_LIMIT_WINDOW_SECONDS`; the guard hardcodes `WINDOW_SECONDS = 60` and
  `LIMITS = { auth: 10, api: 120 }`. Setting them changes nothing.
- **`DEF-005`:** `RateLimitGuard` is registered before `SessionGuard`
  (`core.module.ts:29` vs `:30`) and Nest runs global guards in registration
  order, so `req.user` is always `undefined` when the key is computed. The
  `req.user?.id ?? req.ip` expression is correct and unreachable.
- **Definition of done:** both limits change at runtime through config; two
  authenticated identities behind one NAT hold separate budgets; one identity
  rotating IPs does not get a fresh one.
- **Security constraint:** rate limiting is fail-closed today and must stay so
  — an error resolving the budget denies rather than admits. Read `DEF-004`'s
  entry before touching the Redis error path.

### Then, in order

| # | Task | Why it is next |
|---|---|---|
| 2 | `DEF-006` — readiness never returns 503 | Everything in `BACKEND-15` assumes health checks work. An orchestrator currently keeps routing to a process that cannot serve. Three lines, no dependency, and it gates the hardening phase. |
| 3 | `DEF-014` — `README.md`, `docs/engineering/standards.md` and `docs/engineering/api.md` state the opposite of the code | An agent will act on them. This file is not the only one being read. |
| 4 | `DEF-007` / `DEF-008` — the portfolio returns 500 for a missing wallet, and sums floats | `054fdb9` established exact bigint money for fees. The portfolio then floats the same numbers. Two notions of a dollar must not coexist into `BE-1602`. |
| 5 | `DEF-009` — `claimBatch` claims nothing | Two workers receive the same rows, and the comment above the function says otherwise. |
| 6 | `DEF-010`, `DEF-011`, `DEF-012`, `DEF-013`, `DEF-017` — the bounded remainder | No dependency, all small, none urgent. |
| 7 | `DEF-018` — the Prisma-write guard fails and is not in CI | Recording it here rather than fixing it: it is tracked, and it is not this sprint's work. |

### Completed in this sprint

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
4. `DEF-004` / `DEF-005` — the rate limiter still ignores its config and still
   cannot see the authenticated user. `BE-101` fixed the *path* it matched, which
   is a different bug in the same file.

---

## Do not start

These are not "later". Each has a reason, and starting one without the reason
being resolved produces work that has to be thrown away.

| Do not start | Because |
|---|---|
| **Any provider integration** — metals, on-ramp, pricing feed, KYC | No provider is contracted. `packages/integrations` is `export {}`. Writing an adapter against an imagined API means rewriting it against a real contract. |
| **Smart accounts, passkeys, ERC-4337, paymaster, guardians** | No implementation exists — only interfaces in `packages/types` and `packages/wallet-core`. There is nothing to build on and no account contract to deploy against. Getting this wrong also breaks the key boundary, which is the one property that cannot be compromised. |
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