# Correnthian — Task Tracker

**Last updated:** 2026-10-05
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
- [~] PostgreSQL via Prisma — schema, migrations, seed
- [ ] Redis client + health checks
- [ ] Config module — typed, validated env (`@correnthian/config`)
- [ ] Structured logging with redaction wired in
- [ ] Graceful shutdown

### P1.2 Identity & access
- [ ] Auth module — session strategy, passwordless
- [ ] Users, devices, sessions
- [ ] Device registration and trust
- [ ] Rate limiting (Redis-backed)
- [ ] Admin role / RBAC guard

### P1.3 Domain modules
- [ ] `assets` — registry CRUD, issuer management, backing disclosure
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
- [ ] Input validation (Zod) on every route
- [ ] OpenAPI docs
- [ ] Integration test harness against real Postgres/Redis
- [ ] Error taxonomy and mapping

---

## P2 — Admin (shadcn/ui) 🟠 NEXT

- [x] Next.js admin app in the monorepo
- [x] shadcn/ui init with a preset — **use `-d` / `--preset`, never bare `init`**
      (CLI 4.21.1; presets are `nova vega maia lyra mira luma sera rhea`; used `nova`)
- [x] `npx shadcn@latest add dashboard-01`
- [x] **Examine every stubbed file** and record what is mock data
      → [`apps/admin/STUB-AUDIT.md`](apps/admin/STUB-AUDIT.md)
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
  *(Superseded: as of CLI 4.21.1 `Avatar` does accept `size?: "default" | "sm" | "lg"`.)*

**Gotchas the block shipped that the list above did not cover:**
- `dashboard-01` never mounts `TooltipProvider`, so `next build` fails prerendering
  `/dashboard` with "`Tooltip` must be used within `TooltipProvider`". It also never
  mounts `<Toaster />`, which makes every `toast.promise(...)` a silent no-op.
- The block ships two `react-hooks/set-state-in-effect` lint **errors**
  (`use-mobile.ts`, `chart-area-interactive.tsx`) that turn root `pnpm lint` red.
- The block leaves **no `TODO`/stub comments** — every mock is undiscoverable without
  reading the values. That is why `STUB-AUDIT.md` is per-file rather than a summary.

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

- **2026-10-05** — `apps/admin` created, shadcn `nova` preset initialised,
  `dashboard-01` installed, every stubbed file audited.
  Fixed three defects the block shipped on arrival: the missing `TooltipProvider`
  (which broke `next build` outright), the unmounted `<Toaster />`, and two
  `react-hooks/set-state-in-effect` lint errors. Full mock inventory in
  [`apps/admin/STUB-AUDIT.md`](apps/admin/STUB-AUDIT.md).
- **2026-10-05** — Monorepo foundation complete and committed.
  Fixed two upstream defects: Nest's scaffolded test was broken on arrival
  (vitest/esbuild omits decorator metadata → DI silently fails), and Nest 12
  shipped vitest 4 against a hoisted vite 5.
