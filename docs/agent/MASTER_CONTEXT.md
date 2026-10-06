# MASTER_CONTEXT

Read this first. Everything else in `docs/agent/` is downstream of it.

Verified against the repository at commit `2be6499` (2026-10-06). Where this
document says something is absent, it was checked and it is absent.

For agent-facing working rules, read [`../../CLAUDE.md`](../../CLAUDE.md) —
this document does not restate it.

---

## 1. What Correnthian is

A **self-custodial platform for holding and buying tokenized precious metals**.
A user buys gold with a card or a bank account, and the metal is delivered to an
address only they can move.

### What Correnthian is not

This list is as load-bearing as the list above. An agent that builds toward any
of these has built the wrong product.

| Not this | Why |
|---|---|
| A token issuer | Correnthian does not mint metal tokens. It registers them. |
| A custodian | It holds no user assets and no key material. |
| A broker or dealer taking principal risk | It earns stated, itemised fees. |
| A DEX aggregator as the primary path | Reversed — see ADR-003 in [`DECISIONS.md`](DECISIONS.md). |
| A wallet that stores keys | That is the product of a competitor, not this one. |

### The wedge

> The product is trust and execution, not token support.

Any wallet can list a gold token in an afternoon. What cannot be added to a token
list is a verifiable answer to *what am I holding, who backs it, and can I take
it out*. That sentence is the whole differentiation, and it is why
`packages/assets` and the backing fields in the registry are the product rather
than metadata.

Full rationale: [`../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md`](../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md).

---

## 2. The beachhead

**The gold-owning non-crypto buyer** — someone who wants gold exposure but
refuses to hand custody to a broker. That refusal *is* the wedge.

What this forces into the product, and what exists today:

| Forced by this user | State in the repository |
|---|---|
| Fiat on-ramp | `services/api/src/onramp/` refuses; no provider contracted |
| Gold-denominated UX | No client app exists. Absent. |
| Invisible custody | `packages/wallet-core` defines the interfaces; **no implementation exists** |
| Gas sponsorship | Absent. No paymaster, no ERC-4337 code. |
| Provenance UI | `apps/admin` renders the disclosure string verbatim. Built. |
| Redemption path | `services/api/src/metals/` has the state machine. **Request path is dead** — see [`BACKEND_TASKS.md`](BACKEND_TASKS.md) `BE-212`. |

**Seed-account recovery is unresolved.** Guardians live in a smart-account
contract; Bitcoin and Solana have no equivalent, so those accounts currently
have no recovery path at all. Recorded in
[`../architecture/key-boundary.md`](../architecture/key-boundary.md).

---

## 3. Technology, as actually installed

Versions read from the workspace manifests.

| Layer | Choice | Version |
|---|---|---|
| Workspace | pnpm + Turborepo | pnpm 10.30.2, turbo ^2.3.3, Node >= 22 |
| API | NestJS, modular monolith, ESM | NestJS 12, TypeScript ^6.0.2 |
| Database | PostgreSQL via Prisma | Prisma 7.10.0, Postgres 17 (docker image) |
| Cache / rate limits | Redis | redis ^6.3.0 client, Redis 7 image |
| Validation | Zod | ^4.6.5, on every route |
| Chain access | viem (EVM only) | viem ^2.57.3 |
| Password hashing | argon2id | `@node-rs/argon2` ^2.2.1 |
| Contracts | Zod wire-format schemas | `@correnthian/contracts` |
| Admin | Next.js + shadcn/ui | Next 16.3.8, React 19.2.8, Tailwind v4, `shadcn` ^4.21.2 |
| Marketing / web | Next.js | Next 16.3.8 — both are still `create-next-app` defaults |
| Mobile | Expo | Expo ~57, React Native 0.86 — a bare `App.tsx` |

**Known toolchain divergence:** the workspace is not on one TypeScript version.
Root is `^5.7.2`, `apps/*` are `^5`, `apps/mobile` is `~6.0.3`,
`services/api` is `^6.0.2`. Vitest is `^2.1.8` at the root and in packages,
`^4.1.2` in `services/api`. Recorded in
[`../engineering/standards.md`](../engineering/standards.md).

---

## 4. Security rules — the short version

Full text in [`SECURITY_RULES.md`](SECURITY_RULES.md). The four that an agent
will get wrong if it does not know them:

1. **The key boundary.** Private keys and seed phrases never reach Correnthian
   infrastructure. Enforced by `scripts/check-key-boundary.mjs` in CI over
   `packages/wallet-core`'s transitive dependency closure.
2. **Deny by default on authentication.** A route needs a session unless it is
   explicitly `@Public()`. Registered globally in
   `services/api/src/common/core.module.ts`.
3. **Deny by default on jurisdiction.** No matching `JurisdictionRule` means
   denied, not permitted by omission. `services/api/src/compliance/jurisdiction.service.ts`.
4. **Fail closed on rate limiting.** A Redis outage produces a 429, not an
   unthrottled API. `services/api/src/common/guards/rate-limit.guard.ts`.

---

## 5. Business model

**Explicit, itemised, pre-signature fees.** Provider fee, network fee and
Correnthian fee are separate lines shown before the user signs. Correnthian
never earns by mispricing an asset — hiding a spread in the gold price would
poison the exact trust model the product is built on.

**No fee percentage, partner term, provider licence or custody arrangement is
asserted anywhere in this repository, because none is verified.** If a document
here names a number, treat it as unverified.

---

## 6. Current phase

**Backend foundation through admin operations console. Nothing ships to a
customer.** No wallet holds funds, no provider is contracted, and the critical
path — a licensed metals issuer/LP — has not been started.

| Area | State |
|---|---|
| Monorepo, packages, key boundary | Done and enforced in CI |
| Database, identity, RBAC, rate limiting | Done |
| Domain modules (assets, issuers, chains, providers, wallets, pricing, portfolio, swaps, metals, compliance, audit, notifications, blockchain) | Built. Several refuse by design because no provider is contracted. |
| Admin console | Eleven route files, real API data, no mocks |
| Marketing site, web wallet, mobile | `create-next-app` / Expo defaults. Nothing built. |
| Smart accounts, passkeys, ERC-4337, paymaster, guardians | **Absent.** Interfaces only, in `packages/types` and `packages/wallet-core`. |
| Provider integrations | **Absent.** `packages/integrations/src/index.ts` is `export {}`. |
| Production deployment | Not provisioned. `infrastructure/` is a docker-compose file for local dev only. |

### The critical path is external

The metals issuer / LP partnership has a multi-month lead time and nothing in
this repository can substitute for it. Legal counsel (entity structure,
money-transmitter analysis, CFTC vs SEC for metals) is required **before design
freeze**, not before launch. Both are recorded as open in
[`BACKEND_TASKS.md`](BACKEND_TASKS.md).

---

## 7. Where to go next

| You want to… | Read |
|---|---|
| Understand how the pieces fit | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Know what is being worked on now | [`CURRENT_SPRINT.md`](CURRENT_SPRINT.md) |
| Know what to build, and what already exists | [`BACKEND_TASKS.md`](BACKEND_TASKS.md) |
| Know why something is the way it is | [`DECISIONS.md`](DECISIONS.md) |
| Know the order of remaining work | [`BACKEND_ROADMAP.md`](BACKEND_ROADMAP.md) |

## 8. Trust this document carefully

Every claim here was checked against code. Where a claim could not be checked,
it is marked **unverified** rather than asserted. If you find a claim here that
contradicts the code, the code is right and this file is stale — fix this file
in the same commit.