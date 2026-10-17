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

## Wave 1 — Chrome + first page + settings backend (dispatched 2026-10-17)

- [~] **Sidebar** (Sextant): Correnthian brand, live operator identity,
      sub-nav groups, `navigation.ts` rewrite.
- [~] **Header** (Belfry): search palette, notifications bell, Create-button
      verdict + rewire. Verdict recommendation: operator quick actions
      (New User Invite, Record Attestation, Propose Fee Rule) — decide on
      report.
- [~] **Settings backend** (Keystone): `FeatureFlag` CRUD + per-section
      read/write audit (which settings screen already has a backend, which
      needs one).
- [~] **Users pages** (Harbor): list + detail off the contacts pattern.

## Wave 2 — Operator pages (after wave 1 merges)

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

## Wave 3 — CRM orphans (decision required)

Leads, deals, companies, contacts, activities, calendar have full Nexora UI
and **no backend models**. Options per page: repurpose onto a real entity
(users, redemptions, quotes, audit), keep as a backend build (new models +
endpoints), or remove. Reports page is fully mocked — same decision. The
orchestrator decides after wave-1 lane reports land.

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
