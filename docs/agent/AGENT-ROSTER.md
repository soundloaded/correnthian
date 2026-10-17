# Agent Roster — Admin Ops Rebuild

Who is working where. Read this before your first edit; update it as you go.
Modelled on the PATRIOTS_HYIP coordination pattern: path claims, handoffs,
stage-by-name, serialize suites.

**Rules (non-negotiable):**

1. **Pick a nickname** and take a row before your first edit. One row per agent.
2. **Claim your paths.** Ownership is by directory. If a path is not in your
   row, do not edit it — open a handoff below instead.
3. **Shared foundation** (`lib/api.ts`, `lib/auth.ts`, `lib/use-api-query.ts`,
   `config/navigation.ts` structure, `@correnthian/ui` primitives) is consumed
   by everyone. Additions welcome; changing existing behaviour needs a handoff
   note first.
4. **Commit your own work, stage by name.** Never `git add -A` / `git add .` —
   it sweeps up another lane's in-flight work. `git add <your paths>` only,
   check `git status` before committing.
5. **No mocks, no stubs, no dummy data.** Every figure renders from a contract
   registry endpoint. A state with no data renders a designed empty state.
6. **Nexora patterns only.** Reuse the reference components and arrangement.
   No new styling, no new UI idiom, no off-reference invention. If no Nexora
   pattern fits, say so in your report — do not invent one.
7. **Test serialization.** API suites share one dev database and Redis. Run
   only your focused specs (`vitest run <your file>`) plus typecheck; the
   orchestrator runs the full suite at merge. Never run the full suite while
   another lane is running theirs.
8. **Verify before reporting done:** `typecheck` clean, focused specs green,
   `admin` build clean for frontend lanes. Browser verification is done by the
   orchestrator at merge (dev servers live in the main checkout).
9. **Commit message** prose (what + why), ending with the attribution line.
   One task per commit. Report the SHA back.

**Worktree env note (learned wave 1):** `.env.local` is gitignored and never
copies into a fresh worktree. Without `VITE_API_URL`, the admin dev fallback
reads `window.location.origin` at module load and the SSR prerender crashes
with `window is not defined` — which reads as a code failure but is a missing
env file. Copy `apps/admin/.env.local` from the main checkout (or write
`VITE_API_URL=http://localhost:3100`) before typecheck/build in any new
worktree, and delete it before merging back (it must never be committed).

---

## Roster

| Nickname | Area | Owns these paths | Status | Updated |
|---|---|---|---|---|
| **Orchestrator** | Merge, review, browser verify, full suite, docs | `docs/agent/AGENT-ROSTER.md`, `docs/agent/ADMIN-REBUILD-ROADMAP.md`, merges to `main` | Active | 2026-10-17 |
| **Sextant** | Sidebar chrome + sub-nav + brand + session identity | `apps/admin/src/components/app-sidebar.tsx`, `nav-main.tsx`, `nav-user.tsx`, `team-switcher.tsx`, `apps/admin/src/config/navigation.ts` (deleted `nav-projects.tsx`, `nav-secondary.tsx`) | Merged (`a18af31`) | 2026-10-17 |
| **Belfry** | Header: search palette, notifications bell, Create-button verdict + rewire | `apps/admin/src/components/app-header.tsx`, `header-search.tsx`, `header-notifications.tsx`, `header-create.tsx` | Merged (`9939224`) | 2026-10-17 |
| **Keystone** | Settings backend: FeatureFlag CRUD + settings-section audit | `services/api/src/settings/**`, `services/api/test/settings-flags.spec.ts`, `packages/contracts/src/schemas.ts` (append), `services/api/test/roles.spec.ts` (append), `services/api/src/contracts.spec.ts` (append) | Merged (`7911b56`) | 2026-10-17 |
| **Harbor** | Users list + detail off the contacts pattern, live data | `apps/admin/src/routes/_admin.users.*`, `apps/admin/src/components/users/**` | Merged (`10bcaac`, `ec89542`) | 2026-10-17 |
| **Ledger** | Wave-2 money pages: transactions, quotes, redemptions | `apps/admin/src/routes/_admin.transactions.*`, `_admin.quotes.*`, `_admin.redemptions.*`, `apps/admin/src/components/transactions/**`, `quotes/**`, `redemptions/**` | Merged (`6c866f9`) | 2026-10-17 |
| **Assay** | Wave-2 trust pages: compliance, audit, devices | `apps/admin/src/routes/_admin.compliance.*`, `_admin.audit.*`, `_admin.devices.*`, `apps/admin/src/components/compliance/**`, `audit/**`, `devices/**` | Merged (`1bf675f`) | 2026-10-17 |
| **Forge** | Wave-2 registry pages: assets, issuers, providers, chains, wallets, fees | `apps/admin/src/routes/_admin.assets.*`, `_admin.issuers.*`, `_admin.providers.*`, `_admin.chains.*`, `_admin.wallets.*`, `_admin.fees.*`, `apps/admin/src/components/assets/**`, `issuers/**`, `providers/**`, `chains/**`, `wallets/**`, `fees/**` | Merged (`9b6ff9e`) | 2026-10-17 |
| **Relay** | Wave-2 shell pages: notifications, team rewire, search wiring, settings sections | `apps/admin/src/routes/_admin.notifications.*`, `apps/admin/src/components/notifications/**`, `apps/admin/src/components/team/**`, `apps/admin/src/components/settings/**`, `apps/admin/src/components/header-search.tsx` (onSelect only) | Merged (`c6710ff`) | 2026-10-17 |

Reference-only (read, never edit): `apps/admin/src/components/contacts/**`
(the pattern Harbor cloned), `apps/admin/public/screenshots/**` (all lanes
check the best-fit screenshot before building), `docs/agent/ADMIN_OPS.md`
(stale — describes the archived Next.js console, kept for its page-behaviour
notes in §6 only).

---

## Shared foundation

| File | What it gives you |
|---|---|
| `apps/admin/src/lib/api.ts` | `api` client, `apiBaseUrl`, `login`/`logout`. Do not wrap it. |
| `apps/admin/src/lib/auth.ts` | `getSession`/`setSession`/`clearSession`, `canAccessConsole`. 30-day TTL; expiry timer is clamp-and-rearm (32-bit `setTimeout` overflows past ~24.8d — see `d386fea`). |
| `apps/admin/src/lib/use-api-query.ts` | `useApiQuery(key, params?, query?)` — the one hook for reads. Path params and query params are distinct arguments. |
| `packages/api-client/src/client.ts` | Typed client; method comes from the registry key. |
| `packages/contracts` | `CONTRACT_REGISTRY`. New backend routes register here or the admin cannot call them. Rebuild the package after editing (`pnpm --filter @correnthian/contracts build`). |
| `@correnthian/ui` | Nexora primitives. Theme tokens only, never ad-hoc hex. |

Backend conventions: explicit `@Inject(Service)` DI (CI enforces it), zod
schemas in `dto/`, `@Roles(...)` on every operator route (`user < support <
compliance < admin < owner` rank), keyset pagination via `common/keyset` for
lists, audit sensitive writes via AuditService with required reasons. Check
`STATUS` in `common/errors.ts` before asserting HTTP codes in specs: zod
pipe failures cross as **422** (`validation_failed`), guard refusals as
**400** (`bad_request`) — Keystone's spec tripped on exactly this (`e96239f`).
Run DB specs from the workspace root via `pnpm --filter` (cwd-sensitive
`discover.ts` breaks under bare `pnpm vitest` from `services/api/`).
Key boundary: `packages/wallet-core` takes no HTTP/RPC/provider — ever.

---

## Handoffs

Newest first. Need something in another lane's paths? Write it here, do not
reach across.

- *(closed)* Wave-2 sidebar entries — added by orchestrator at Relay merge:
  Operations (transactions, quotes, redemptions, compliance, audit,
  notifications) + Registry (assets, issuers, providers, chains, devices,
  wallets, fee rules). Every entry verified against an existing route.
- *(closed)* Harbor → Sextant: users sidebar entries — shipped in `a18af31`.
- *(closed)* Belfry → Keystone: notification preferences — answered **no
  backend** (Keystone audit); bell ships without mute/filter.
- *(open)* `DELETE /settings/flags/:key` has no contract-registry entry
  (Relay hand-rolls via raw fetch) — Keystone follow-up or bless convention.
- *(closed)* Wave-3 CRM orphans — **removed** (`24b2e46`): 115 mock files,
  10 routes, reports nav group all gone. Verified 404/200.

---

## Task logs

### Orchestrator

- 2026-10-17: wrote this roster + `ADMIN-REBUILD-ROADMAP.md`; dispatched wave 1
  (Sextant, Belfry, Keystone, Harbor) on isolated worktrees.
- 2026-10-17: wave 1 merged — Harbor `10bcaac`+`ec89542`, Sextant `a18af31`,
  Belfry `9939224`, Keystone `7911b56`. Live-verified: 10 route/API checks +
  5 mutation/gate checks green. Pre-existing failures recorded (contracts.spec
  transaction-intent — fails on clean main too; onramp quote 503-shape —
  predates Keystone). Full suite: 911/912 with those two aside.
- 2026-10-17: wave 2 dispatched (Ledger, Assay, Forge, Relay).
- 2026-10-17: wave 2 merged — Ledger `6c866f9`, Forge `9b6ff9e`, Assay
  `1bf675f`, Relay `c6710ff`. Live-verified: 16 routes + 2 detail shapes +
  19 endpoints + 3 role gates, all green. Detail ownership confirmed in
  service code (stranger-404 rule, operators admitted). Open: DELETE-flags
  registry entry, wave-3 orphan decision.

### Sextant

- Lane work complete; see wave-1 merge commit `a18af31`.

### Belfry

- Lane work complete; see wave-1 merge commit `9939224`.

### Keystone

- Lane work complete; see wave-1 merge commit `7911b56`.

### Harbor

- Lane work complete; see wave-1 merge commits `10bcaac`, `ec89542`.

### Ledger

- Lane work complete; see wave-2 merge commit `6c866f9`.

### Assay

- Lane work complete; see wave-2 merge commit `1bf675f`.

### Forge

- Lane work complete; see wave-2 merge commit `9b6ff9e`.

### Relay

- Lane work complete; see wave-2 merge commit `c6710ff`.
