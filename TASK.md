# Correnthian — Task Tracker

**Last updated:** 2026-10-05 (API foundation)
**Current focus:** API foundation, then admin.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## How to use this file

Read it before starting work. When you complete something, tick it **and** move
the `Last updated` date. If you start something, mark it `[~]` so parallel
workers do not duplicate it. Add new tasks as they are discovered — do not let
work happen that is not tracked here.

---

## P0 — Repository foundation ✅

- [x] pnpm + Turborepo monorepo
- [x] App shells — marketing (Next.js 16), web (Next.js 16), mobile (Expo), api (NestJS 12)
- [x] Twelve source-only shared packages
- [x] Domain types — asset identity, accounts, rails
- [x] `wallet-core` key boundary with structural enforcement
- [x] Asset registry with backing disclosure + tests
- [x] `SwapRail` abstraction with `sizeCap` / `executionQuality`
- [x] Secret redaction + tests
- [x] Design tokens (obsidian / silver / gold, glass, motion)
- [x] CI — typecheck, build, test, key-material guard
- [x] Design spec written and committed
- [x] `CLAUDE.md`, `TASK.md`, documentation set

---

## P1 — API foundation 🔴 CURRENT

> Heaviest investment. Modular monolith; do **not** split into microservices.

### P1.1 Data layer
- [x] PostgreSQL via Prisma — schema (18 models, 15 enums), validated, client generated
- [~] Migrations + seed — schema written; cannot run locally (no Postgres/Docker)
- [x] Redis client with ping-based health check
- [x] Config module — typed, validated env (`@correnthian/config`), 6 tests
- [x] Structured logging via nestjs-pino
- [x] Graceful shutdown hooks
- [x] Liveness `/health/live` and readiness `/health/ready` probes
- [ ] Integration test harness that skips cleanly without a database

### P1.2 Identity & access
- [x] Auth module — argon2id passwords, SHA-256 session digests, 7 tests
- [x] Users module — keyset pagination, role/status mutation, dashboard counters
- [x] Devices module — register, list, soft-revoke
- [x] RBAC guards — role hierarchy, deny-by-default session guard
- [ ] Magic-link / passwordless auth (target UX for the beachhead user)
- [ ] Redis-backed rate limiting

### P1.3 Domain modules
- [x] `assets` — registry CRUD, derived identity, disclosure, attestation, stats
- [ ] Issuers module — issuer onboarding and due-diligence record
- [ ] `chains` — chain configuration, per-chain enablement
- [ ] `providers` — provider registry, health, credentials
- [ ] `swaps` — quote requests, `SwapRail` resolution
- [ ] `metals` — instruments, serialisation, redemption states
- [ ] `pricing` — metal spot + reference vs executable price
- [ ] `onramp` / `offramp` — provider adapters
- [ ] `compliance` — jurisdiction engine, sanctions screening hooks
- [ ] `admin` — internal operations surface
- [ ] `audit` — immutable audit log
- [ ] `notifications`

### P1.4 Hardening
- [x] Input validation (Zod) on every route, with env-var-named config errors
- [x] Error taxonomy + global exception filter, no internal detail leaked
- [ ] OpenAPI docs
- [ ] Integration test harness against real Postgres/Redis
- [ ] Error taxonomy and mapping

---

## P2 — Admin (shadcn/ui) 🟠 NEXT

- [ ] Next.js admin app in the monorepo
- [ ] shadcn/ui init with a preset — **use `-d` / `--preset`, never bare `init`**
- [ ] `npx shadcn@latest add dashboard-01`
- [ ] **Examine every stubbed file** and record what is mock data
- [ ] Rewire to real API data
- [ ] Auth + RBAC gate
- [ ] Pages: users, devices, assets, issuers, providers, chains,
      transactions, quotes, compliance, audit
- [ ] Loading, empty, and error states designed — not placeholder text

**Known shadcn gotchas:**
- CLI v4 removed `--style`, `--base-color`, `--src-dir`, `--css-variables`.
- New style uses the unified `radix-ui` package, not `@radix-ui/react-*`.
- After `init`, replace `--font-sans: var(--font-sans)` in `@theme inline` with
  **literal** font names, or Tailwind v4 will resolve to nothing.
- `Avatar` has no `size` prop — use Tailwind classes.

---

## P3 — Client apps ⬜ LATER

- [ ] Marketing site content
- [ ] Web wallet
- [ ] Mobile (Expo) — smart account + passkey flow

---

## Blockers and risks

| Item | Impact | Status |
|---|---|---|
| **Metals issuer / LP partnership** | **Critical path.** Multi-month lead time. Metals cannot ship without it. | [!] Not started — start immediately |
| Legal counsel | Entity, money-transmitter analysis, CFTC vs SEC for metals. Required **before design freeze**, not before launch. | [!] Not engaged |
| Provider due diligence | Verify Kinesis/PAXG/XAUT specifics independently — research was degraded and unverified | [ ] |

---

## Done log

- **2026-10-05** — Monorepo foundation complete and committed.
  Fixed two upstream defects: Nest's scaffolded test was broken on arrival
  (vitest/esbuild omits decorator metadata → DI silently fails), and Nest 12
  shipped vitest 4 against a hoisted vite 5.
