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

---

## Roster

| Nickname | Area | Owns these paths | Status | Updated |
|---|---|---|---|---|
| **Orchestrator** | Merge, review, browser verify, full suite, docs | `docs/agent/AGENT-ROSTER.md`, `docs/agent/ADMIN-REBUILD-ROADMAP.md`, merges to `main` | Active | 2026-10-17 |
| **Sextant** | Sidebar chrome + sub-nav + brand + session identity | `apps/admin/src/components/app-sidebar.tsx`, `nav-main.tsx`, `nav-projects.tsx`, `nav-secondary.tsx`, `nav-user.tsx`, `team-switcher.tsx`, `apps/admin/src/config/navigation.ts` | Wave 1 — dispatched | 2026-10-17 |
| **Belfry** | Header: search palette, notifications bell, Create-button verdict + rewire | `apps/admin/src/components/app-header.tsx`, `header-search.tsx`, `header-notifications.tsx`, `header-create.tsx` | Wave 1 — dispatched | 2026-10-17 |
| **Keystone** | Settings backend: FeatureFlag CRUD + settings-section audit | `services/api/src/settings/**` (new), `packages/contracts/src/**` (append), `services/api/test/roles.spec.ts` (append), `services/api/src/contracts.spec.ts` (append) | Wave 1 — dispatched | 2026-10-17 |
| **Harbor** | Users list + detail off the contacts pattern, live data | `apps/admin/src/routes/_admin.users.*` (new), `apps/admin/src/components/users/**` (new) | Wave 1 — dispatched | 2026-10-17 |

Reference-only (read, never edit): `apps/admin/src/components/contacts/**`
(the pattern Harbor clones), `apps/admin/public/screenshots/**` (all lanes
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
schemas in `dto/`, `@Roles(...)` on every operator route, pin new gated routes
in `services/api/test/roles.spec.ts`, add contract-over-HTTP coverage in
`services/api/src/contracts.spec.ts`, every fix ships with a failing-without-it
test. Key boundary: `packages/wallet-core` takes no HTTP/RPC/provider — ever.

---

## Handoffs

Newest first. Need something in another lane's paths? Write it here, do not
reach across.

- *(open)* Harbor → Sextant: users list + detail routes need sidebar entries
  (Operations group). Harbor implements pages; Sextant owns `navigation.ts`.
- *(open)* Belfry → Keystone: bell content depends on what the settings audit
  says about notification preferences (per-operator mute/filter has no
  backend — confirm so the bell ships without it).
- *(open)* All → Orchestrator: CRM orphans (leads, deals, companies,
  contacts, activities, calendar) have no backend models. Lanes report
  mapping options; orchestrator decides repurpose vs remove in wave 2.

---

## Task logs

### Orchestrator

- 2026-10-17: wrote this roster + `ADMIN-REBUILD-ROADMAP.md`; dispatched wave 1
  (Sextant, Belfry, Keystone, Harbor) on isolated worktrees.

### Sextant

- *(lane reports here)*

### Belfry

- *(lane reports here)*

### Keystone

- *(lane reports here)*

### Harbor

- *(lane reports here)*
