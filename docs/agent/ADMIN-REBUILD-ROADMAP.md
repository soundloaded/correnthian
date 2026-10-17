# Admin Rebuild Roadmap — TanStack console off Nexora patterns

**Living tracklist.** Updated as work lands. Nothing is marked done until it
is built, tested, reviewed, merged to `main`, and browser-verified against the
live API. Every page renders contract-registry data — no mocks, no stubs.

Legend: `[ ]` not started · `[~]` in progress (lane nickname) · `[x]` done +
verified (commit SHA).

Ground rules:

1. **Read before building.** Every page starts from its backend endpoints and
   the best-fit Nexora screenshot in `apps/admin/public/screenshots/`. The
   backend is the specification; the screenshot is the arrangement.
2. **Contacts is the table pattern.** List + toolbar + table + detail cards.
   Clone its structure for every entity page; change only the columns and the
   contract keys.
3. **Comments explain why, never what.** No dirty tags, no narration, clean
   commits with prose messages.
4. **Verification per page:** typecheck clean, focused specs green, `admin`
   build clean, real browser run of every action (filter, paginate, mutate,
   validation error, empty state).

---

## Wave 0 — Foundation ✅ (done, on `main`)

- [x] Shared client + `useApiQuery` + `QueryClientProvider` (`50e4e63`)
- [x] All 8 dashboard sections live; `GET /transactions/daily` added
      (`552e914`, `abe7cfe`, `656081d`, `d8c5d8e`)
- [x] Expiry-timer overflow fixed (`d386fea`); header cleanup (`8302c4c`)

## Wave 1 — Chrome + first page + settings backend (merged 2026-10-17)

- [x] **Sidebar** (Sextant → `a18af31`): Correnthian brand, live operator
      identity, grouped sub-nav, `minRole` mechanism.
- [x] **Header** (Belfry → `9939224`): route title, live search
      (users+devices only), live bell (`pending+failed`), Create → 4 real
      operator mutations. Verdict landed: Queue notification, Propose fee
      rule, Record attestation, Run scheduled job.
- [x] **Settings backend** (Keystone → `7911b56`): `FeatureFlag` CRUD +
      10-section audit (appearance/workspace/pipeline/billing: no backend;
      integrations/data: partial; notifications prefs: gap).
- [x] **Users pages** (Harbor → `10bcaac`+`ec89542`): list + detail off the
      contacts pattern, admin-gated mutations, audit surfacing.

## Wave 2 — Operator pages (merged 2026-10-17, live-verified)

- [x] **Money lane** (Ledger → `6c866f9`): transactions, quotes, redemptions.
- [x] **Trust lane** (Assay → `1bf675f`): compliance, audit, devices.
- [x] **Registry lane** (Forge → `9b6ff9e`): assets, issuers, providers,
      chains, wallets, fees.
- [x] **Shell lane** (Relay → `c6710ff`): notifications page, team rewire,
      search→user wiring, settings rebuild, full sidebar nav.
- Verification: 16 routes + 19 endpoints + 3 role gates green; detail
  ownership confirmed (stranger-404, operators admitted).

Path claims are disjoint; all lanes clone the contacts/users arrangement.
Sidebar entries: Sextant's `navigation.ts` owns them — lanes request entries
via their reports; orchestrator adds them at merge (one commit, no lane
touching another's paths).

- [~] **Money lane** (Ledger): Transactions list + detail (states, directions,
      keyset pagination; transitions/observations UI; broadcast is system-side,
      read-only) + Quotes list + detail (read-only; `sizeCapUsd` +
      `executionQuality` first-class) + Redemptions list + queue
      (state-filtered; `PATCH :id/transition` compliance-gated, actions driven
      by the state machine; `transitionSchema` is `{state}` only — no reason
      field, unlike decide).
- [~] **Trust lane** (Assay): Compliance reviews queue + decide dialog
      (`decision` approve/reject + `reason` min-1, `assertReason` enforces the
      real floor; sanctions-hit styling) + jurisdiction rules table
      (`GET rules`, `PATCH rules/:id` admin) + Audit list + detail
      (action/outcome/requestId filters; `denied` = destructive; compliance
      role gate) + Devices table (`includeRevoked=true`, revoked dimmed).
- [~] **Registry lane** (Forge): Assets list + detail (disclosure verbatim,
      fact grid, enabled/attestation PATCH) + Issuers list + detail
      (evidence behind left rule; licence/risk/tier PATCH) + Providers
      (list + health; degraded = destructive; status PATCH admin) + Chains
      (rows; enabled PATCH admin; no RPC column ever) + Wallets list +
      detail (guardians/label/primary PATCH; snapshots manual) + Fee rules
      (list, `:id`, diagnostics; preview-before-propose; owner writes).
- [~] **Shell lane** (Relay): `/notifications` console page (bell "View all"
      destination; list + stats; terminal rows — no read/dismiss endpoint, so
      no fake state) + Team page rewire (`GET /users` as source; role/status
      PATCH admin-gated; NO Invite button — no transport, matches gap #2) +
      search `onSelect` → `/users/$userId` wiring (Belfry left the TODO) +
      Settings shell sections against Keystone's audit (Flag table UI for
      `GET/POST/PATCH/DELETE /settings/flags`; sections with no backend
      render an honest "no backend" state, never mocks).

| Page | Nexora pattern | Backend | Notes |
|---|---|---|---|
| Transactions | contacts table + detail cards | `GET /transactions`, `:id`, `stats`, `daily` ✅ | transitions/observations need operator UI; broadcast is system-side |
| Compliance / reviews | team cards or contacts rows | `reviews`, `decide`, `rules`, `PATCH rules/:id` ✅ | decide needs reason field; sanctions-hit styling |
| Redemptions | deals pipeline or contacts rows | list, `transition`, `stats` ✅ | state machine drives the actions offered |
| Quotes / swaps | deals table | `GET /swaps/quotes`, `:id`, `stats` ✅ | read-only; `sizeCapUsd` + `executionQuality` columns (§6) |
| Assets | contacts detail cards | list, `stats`, `PATCH enabled/attestation` ✅ | disclosure verbatim, fact grid (§6) |
| Issuers | contacts detail cards | list, `stats`, licence/risk/tier PATCH ✅ | evidence behind left rule (§6) |
| Providers | team-style cards or rows | list, `health`, `PATCH status` ✅ | degraded = destructive tone (§6) |
| Chains | rows | list, `PATCH enabled` ✅ | no RPC column, ever (§6) |
| Devices | rows | `devices/all?includeRevoked=true`, `stats` ✅ | revoked dimmed, never hidden (§6) |
| Wallets / portfolio | detail cards | list, `:id`, `portfolio` ✅ | guardians/label/primary PATCH; snapshots manual |
| Audit | rows + filter | `GET /audit`, `:id`, `actor/:actorId` ✅ | compliance role; denied = destructive (§6) |
| Jobs / scheduler | rows | `GET /jobs`, `POST /jobs/:name/run` ✅ | run is a destructive-confirm action |
| Fees | rows or detail | `rules`, `:id`, `diagnostics`, `preview` ✅ | preview before propose |
| Pricing | rows | `record`, asset history ✅ | manual record only until a feed exists |
| On-ramp | availability panel | `availability` only ✅ | availability check UI; no quote UI (no provider) |
| Notifications | bell + list page | list, `stats`, `POST` enqueue ✅ | **gap: no per-item read/dismiss** — Keystone or wave-2 backend task |
| Settings | settings shell (exists) | Keystone's audit decides per-section | rebuild sections against real endpoints only |
| Team | team cards | ⚠️ `GET /users` + role/status PATCH as the source | "invite" needs a backend decision — no invite/reset/email transport exists |

## Wave 3 — CRM orphans (removed 2026-10-17, `24b2e46`)

Decision: **remove, all of it.** No backend models exist for leads, deals,
companies, contacts, activities, calendar, or reports — 115 mock files,
zero `useApiQuery` calls among them. Building models would mean new Prisma
tables for CRM entities a self-custody metals console has no product reason
to own; repurpose candidates all duplicate live pages (leads-as-users,
activities-as-audit, companies-as-issuers). Pattern reference now lives in
the live pages. Reports nav group, hero preview link, and the orphan-only
date-range picker went with them. All 17 live routes verified 200, all 10
removed verified 404.

---

## Backend gaps found (for Keystone / wave 2)

1. **Notifications have no read/dismiss.** Service tracks delivery state, not
   per-operator reads. Bell badge needs either a `NotificationRead` model or
   a documented local-only read state.
2. **No invite / reset / email transport.** Team "Invite Member" and any
   password-reset UI have nothing to call. Either build `BE-1506`-adjacent
   invite endpoints or remove the affordances.
3. **No per-operator notification preferences.** If the bell gains mute/filter,
   that is a new model too.
4. **Settings sections without backends** — Keystone's audit enumerates.
5. `POST /transactions`, transitions, observations exist but are account-side
   intents; the operator console needs a read view first, actions later.

## Page-behaviour notes (from ADMIN_OPS.md §6 — still binding)

Disclosure verbatim; revoked devices visible; degraded = destructive; denied
audit = destructive; executable-quote two-column rule; full-list honesty ("says
so when the list is full"); URL-is-state for filters where cheap; "not yet"
for undeployed smart accounts; inline errors, never toasts, on mutations;
destructive actions confirm and say what survives.
