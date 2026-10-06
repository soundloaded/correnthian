# CURRENT_SPRINT

Read this every time before starting work. It is deliberately short: it names
the task, what is finished, what is next, and — most importantly — what must
not be started.

Last updated: 2026-10-06.

---

## Sprint: Backend Foundation 002 — Audit and Defect Clearance

The previous sprint built the admin and the wire-format contract layer. This
sprint exists because reading the code found seventeen defects that no test,
no typecheck and no contract assertion catches. Several are silent.

### Current task

**`DEF-001` — `POST /redemptions` can never succeed.**

- **Why this one first:** it is a route that is fully implemented, fully tested
  at the service layer, and completely unreachable. The tests pass because they
  call the service directly and pass a country. Nothing in the repository
  exercises the controller.
- **File:** `services/api/src/metals/redemption.controller.ts`
- **Definition of done:** a `POST /redemptions` in a permitted jurisdiction
  creates a row in state `requested`; the same request in an unmatched
  jurisdiction returns 451. Both verified against a live database.
- **Security constraint:** jurisdiction must come from the authenticated `User`
  row. Taking it from the request body is a different decision and needs an ADR.

### Then, in order

| # | Task | Why it is next |
|---|---|---|
| 2 | `DEF-002` — `reviewedBy` written to a model without that column | Fails at runtime, maps to a 500. Currently the only reachable failure in the redemption flow once DEF-001 is fixed. |
| 3 | `DEF-003` — `services/api/prisma/schema.prisma` has drifted from the database | The next person to run `prisma migrate dev` will silently reintroduce the asset-registry uniqueness hole. Every minute this stays open is a minute someone can do that. |
| 4 | `DEF-004` / `DEF-005` — rate limiter ignores its config and cannot see the user | Two documented properties that do not hold. |
| 5 | `DEF-006` — readiness never returns 503 | An orchestrator will keep routing to a process that cannot serve. |
| 6 | `DEF-014` — `README.md` and two docs state the opposite of the code | An agent will act on them. |

### Completed in this sprint

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

1. `DEF-007` through `DEF-017` — the remaining defects, mostly small.
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