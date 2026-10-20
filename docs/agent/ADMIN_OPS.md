# ADMIN_OPS

`apps/admin` — the internal operations console. Vite 8 + TanStack Router
(SPA), React 19, Tailwind 4, shadcn/ui from `packages/ui`.

Verified against the repository at `3763196`.

---

## 1. What it is

A single-page console. Twenty-six route files, seventeen of them reachable
from the sidebar; the rest are detail routes reached from their lists. Every
data-backed surface renders live API data — the placeholders are loading and
empty states, which are states rather than fakes.

| Group | Route | API endpoints | Min role |
|---|---|---|---|
| Operations | `/dashboard` | `/users/stats`, `/assets/stats`, `/redemptions`, `/redemptions/stats`, `/swaps/quotes/stats`, `/transactions/daily`, `/providers` | support |
| | `/users` | `/users` (search, role, kycStatus, sort, order, limit, cursor) | support |
| | `/users/$userId` | `/users/:id`, `/audit/actor/:actorId`, `/transactions?userId=` | support |
| | `/transactions` | `/transactions` (state, direction, chainId, walletId, userId, limit, cursor), `/transactions/stats` | support |
| | `/transactions/$txId` | `/transactions/:id`, **POST** `/transactions/:id/transitions`, **POST** `/transactions/:id/observations` | support |
| | `/quotes` | `/swaps/quotes` (state, railKind, limit, cursor), `/swaps/quotes/stats` | support |
| | `/quotes/$quoteId` | `/swaps/quotes/:id` | any session |
| | `/redemptions` | `/redemptions` (state, limit, cursor), `/redemptions/stats` | support |
| | `/compliance` | `/compliance/reviews`, `/compliance/rules` | **compliance** |
| | `/audit` | `/audit` (action, outcome, requestId, limit) | **compliance** |
| | `/notifications` | `/notifications` (state, limit, cursor), `/notifications/stats` | support |
| Registry | `/assets` | `/assets` (category, chainId, issuerId, enabled, limit), `/assets/stats`, **POST** `/assets` (compliance) | any session |
| | `/assets/$assetId` | `/assets/:assetId` | any session |
| | `/issuers` | `/issuers`, `/issuers/stats`, **POST** `/issuers` (compliance) | support |
| | `/issuers/$slug` | `/issuers/:slug` | support |
| | `/providers` | `/providers` (category), `/providers/health` | any session |
| | `/chains` | `/chains` | any session |
| | `/devices` | `/devices/all` (search, platform, includeRevoked, limit, cursor), `/devices/stats` | support |
| | `/wallets` | `/wallets` | any session |
| | `/wallets/$walletId` | `/wallets/:id`, `/portfolio/wallets/:walletId`, **POST** `/blockchain/wallets/:walletId/sync` | any session |
| | `/fees` | `/fees/rules` (operation, kind, active, limit), `/fees/rules/diagnostics`, **POST** `/fees/rules` (owner) | **admin** |
| | `/fees/$ruleId` | `/fees/rules/:id`, **POST** `/fees/preview`, **PATCH** `/fees/rules/:id` | **admin** |
| Workspace | `/team` | `/users` (search, role, kycStatus, limit, cursor) | support |
| System | `/settings` | `/settings/flags` (**POST**/**PATCH**/**DELETE**), `/devices/all`, `/notifications`, `/audit`, `/providers/health`, `/jobs`, **POST** `/jobs/:name/run` | any session |

Navigation lives in `apps/admin/src/config/navigation.ts`. Detail routes
(`/users/$userId` etc.) stay unlisted; they are reached from their lists.

---

## 2. The role model

### Server-side is the real one

`RolesGuard` on the API enforces independently: `user < support < compliance <
admin < owner`. The UI gate exists only so a support agent is not shown a
button that will only bounce.

### UI-side is cosmetic, deliberately

`apps/admin/src/lib/roles.ts` exports `rankAtLeast(actual, required)`, which
mirrors the API's rank table. It fails closed on both sides: an unrecognised
role ranks `-1`, and an unrecognised requirement is unsatisfiable.

**These UI role gates are not a security control and must not be described as
one.** An operator can rewrite the stored session to change what the console
shows them. They see no different data — every call is authorised server-side.

---

## 3. Session

`services/api` issues bearer tokens. The console runs in SPA mode, so there is
no server to hold an httpOnly cookie: the bearer lives in memory and is
mirrored to `localStorage` so an operator stays signed in across tabs and
reloads.

That mirror is readable by any script running on the origin, which is the
accepted cost. It is why the console must never render untrusted HTML, why
stored sessions die at expiry, and why the shell re-validates against the API
on every navigation. `sessionStorage` was tried first and rejected: it
isolates tabs, so signing in on one tab left every other tab signed out.

`getSession()` returns the session or `null`; it never validates the token
against the API. A role below `support` is refused at sign-in, before a
session is written, and the shell gates again because a session outlives a
role change.

---

## 4. Data access

Two modules, and only two:

- `apps/admin/src/lib/api.ts` — the client, built on `@correnthian/api-client`.
  Reads and writes both go through it; response types come from the contract
  registry, so a screen never hand-writes a response shape.
- `apps/admin/src/lib/use-api-query.ts` — one query hook for every console
  read, mapping the client's discriminated result onto query states.

### The failure vocabulary

```ts
type ApiResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unauthorised' }
  | { status: 'forbidden'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string; code?: string }
```

Distinct outcomes because the UI must react differently to each. Collapsing
them into one "failed" state is how an admin gets shown a login screen during
an outage — which locks everyone out rather than telling them the API is down.

### DEF-024 — the query parameters were being dropped

`packages/api-client/src/client.ts` destructured `query` out of the request
options and then built the URL from path params alone. Every list filter,
sort, limit and pagination cursor the console sent was discarded before the
request left the browser, and the server answered with its defaults.

The console looked inert because of it: the filters looked live and did
nothing, and "Next page" returned the same rows. Fixed in `ce23a50`.

The client test named *"fills path params and query strings"* passed no
params and asserted a bare URL — it was named for the behaviour and checked
none of it, so the suite stayed green while the behaviour was absent. The
shape of `DEF-018` and `DEF-021`: a check that is wired up and green while
inspecting nothing.

One consequence still applies: the API's length caps on free-text filters
are now reachable for the first time. The console inputs that could exceed
their cap carry a `maxLength` so a long paste fails one request rather than
the page.

---

## 5. The operator surfaces

These were added on 2026-10-20. Each one writes to a real endpoint, behind
the role the endpoint actually requires, with the outcome rendered inline.

| Surface | Endpoint | Role | Notes |
|---|---|---|---|
| Transaction detail — **Operator actions** | `POST /transactions/:id/transitions`, `POST /transactions/:id/observations` | support | The state list comes from the server's own `permittedNext`, never from a hard-coded set. The form collects the evidence each edge carries: a hash for `broadcast`, a code and message for `failed`, a reason of at least 8 characters for the two edges that move a settled row backwards. |
| Wallet detail — **Chain state** | `POST /blockchain/wallets/:walletId/sync` | support | Re-reads the chain. Nothing else is offered here: registering a wallet and writing a balance are the account holder's own writes, and an operator typing a number into a chain-derived balance is a liability, not an ops tool. |
| Settings — **Scheduled jobs** | `GET /jobs`, `POST /jobs/:name/run` | support / **admin** | Lists every scheduled job with its cadence and last run. "Run now" is admin's, and the outcome is rendered inline — the job's own report, not a toast. |
| Assets — **Register an asset** | `POST /assets` | compliance | Every field maps 1:1 to the API's `createAssetSchema`. The chain and issuer are selects populated from the live registry; choosing a chain auto-fills `decimals`. |
| Issuers — **Register an issuer** | `POST /issuers` | compliance | No tier field: the API always creates an issuer unverified, and tier is a separate audited act. |
| Fee rules — **Create a fee rule** | `POST /fees/rules` | **owner** | Owner only, and the reason is part of the request. The confirmation states what will be created in plain words before it happens. |

### What is deliberately not offered

- **Building or broadcasting a transaction.** The device signs; the server
  relays. Both routes require the transaction's own account, so an operator
  gets a 404 — correctly.
- **Registering a wallet, or writing a balance.** Those are the account
  holder's own writes, scoped to `user.id`.
- **Composing a notification.** The enqueue route stamps the row with the
  *caller's* account and the DTO has no recipient field, so it can only ever
  notify the operator themselves.

---

## 6. Page behaviour worth preserving

### Errors render inline, not as a toast

A permission change that silently disappears is indistinguishable from one
that never happened.

### A partial read is not an all-clear

Every list page says what it does not know. "The API did not answer. The list
below may be stale or empty — this is not an all-clear." An operator reading
a green panel must be able to trust it.

### Devices

Revoked devices are soft-deleted precisely so the audit trail survives, so a
console that hides them makes a revocation unverifiable — an operator could
see only an absence, indistinguishable from never having had one. Revoked
rows render dimmed with a destructive badge.

### Assets

The disclosure string is rendered **verbatim** from `row.disclosure`, in a
full-bleed band, never rebuilt from `asset.backing` on the client. This is
the product's claim and a second implementation would drift in the direction
that is easiest to get wrong. The page requests 200 rather than the API's
default and **says so when the list is full**, instead of silently truncating
a registry an operator believes they are seeing whole.

### Issuers

The evidence is the page, not the badge. Licence types and references sit
behind a left rule that turns destructive when an `issuer_verified` issuer
has nothing behind the tier.

### Providers

`degraded` takes the **destructive** tone, not grey: a degraded rail is still
offered to users, so it is the state an operator must act on. A provider never
checked reads destructive too. Credentials are never in the table.

### Chains

No RPC column, and there never will be one — the API does not return an RPC
URL. Testnet reads as its own network badge, separate from enabled/disabled.

### Users and users/$userId

A smart account whose deploy transaction has not confirmed renders as
**"not yet"** with a tooltip stating it exists nowhere on-chain and cannot
hold or move anything. It must never read as live. The account footprint
counts *active* devices, because the detail projection holds revoked rows
back.

### Quotes

`sizeCapUsd` and `executionQuality` are first-class columns, because those two
fields are why a quote is or is not fillable. `executable` is displayed as the
honest read of the two rather than as a third opinion.

### Audit

`denied` is the only outcome that takes the destructive tone — a denied action
is a refusal someone may need to explain.

---

## 7. Not built

| Capability | Blocked on |
|---|---|
| Risk operations / velocity scoring | `BE-1102` — no risk engine exists |
| Finance / revenue / AUM | `BE-1601` — no analytics backend |
| Reconciliation | `BE-1602` — blocked on `BE-802` |
| Support tickets | `BE-1506` — no model, no route |
| `GET /compliance/eligibility`, `GET /onramp/availability` | The console calls neither |
| Account-status filter on the users list | `GET /users` has no `status` param, though the column is shown |
| `GET /portfolio/wallets/:id/history-series` (with its `bucket` filter) | The console calls `/history` instead |
| `/providers/:slug` and `/chains/:id` detail pages | The API serves both; the console has no route for either |
| `GET /pricing/assets/:assetId`, `GET /meta/versions`, `GET /blockchain/health`, `GET /wallets/portfolio`, `GET /portfolio/allocation` | No console surface; each is an operator-readable fact the console does not yet show |

---

## 8. Environment

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3100` | The API origin. Falls back to the serving origin in production, never to a localhost constant that would point every request at the operator's own machine. |
| `PORT` (API) | `3100` | `services/api/.env` |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Must include the admin's origin. |

The admin dev server runs on port 3000 (`vite dev --port 3000`) and listens on
IPv6 localhost — `http://localhost:3000` works, `127.0.0.1:3000` may not.

---

## 9. A note on provenance

The previous admin implementation is preserved at `archive/admin-legacy/`,
including its `STUB-AUDIT.md` — a per-file inventory of every mock the shadcn
block shipped with (68 fake data-table rows, 21 dead sidebar links, four
hardcoded metric cards, a 91-row frozen chart, three mutually inconsistent
reviewer lists, and three of four view tabs that were empty dashed divs).

`archive/` is outside the pnpm workspace globs, so it is never built or
typechecked. `git mv archive/admin-legacy apps/admin` restores it exactly.
