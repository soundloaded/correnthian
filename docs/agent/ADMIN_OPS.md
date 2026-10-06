# ADMIN_OPS

`apps/admin` — the internal operations console. Next.js 16.3.8, App Router,
server-rendered, shadcn/ui `radix-nova`.

Verified against the repository at `2be6499`. Design detail in
[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

---

## 1. What it is

Eleven route files, every one rendering live API data. **No mock data remains** — the
placeholders are loading skeletons and empty states, which are states rather
than fakes.

| Route | API endpoints | Min role |
|---|---|---|
| `/login` | `POST /auth/login` | public |
| `/dashboard` | `/users/stats`, `/assets/stats`, `/audit?limit=200`, `/providers` | support (audit needs compliance) |
| `/users` | `/users` | support |
| `/users/[id]` | `/users/:id` | support |
| `/devices` | `/devices/all?includeRevoked=true`, `/devices/stats` | support |
| `/assets` | `/assets?limit=200` | any session |
| `/issuers` | `/issuers`, `/issuers/stats` | support |
| `/chains` | `/chains` | any session |
| `/providers` | `/providers`, `/providers/health` | any session |
| `/quotes` | `/swaps/quotes`, `/swaps/quotes/stats` | support |
| `/audit` | `/audit`, `/audit/:id` | **compliance** |

Navigation is flat, in `apps/admin/src/components/layout/nav-links.tsx`. Collapsible
sub-groups were dropped: an operator console has a dozen destinations, all one
level deep, and making people expand a section is friction for no gain.

---

## 2. The role model

### Server-side is the real one

`RolesGuard` on the API enforces independently: `user < support < compliance <
admin < owner`. The UI gate exists only so a support agent is not shown a button
that will only bounce.

### UI-side is cosmetic, deliberately

`apps/admin/src/lib/api-server.ts` exports `roleAtLeast(actual, required)`,
mirroring the API's rank table. It is used in `guard()` inside
`apps/admin/src/app/(dashboard)/actions.ts` for every mutation.

**`getSession()` reads an unsigned base64 cookie.** It never validates the token
against the API — the cookie is display state only, and the code says so:

> The session payload is the signed-in identity only. Authorisation is
> re-checked server-side on every call — this is display state, never a security
> decision.

**These UI role gates are not a security control and must not be described as
one.** A user can trivially rewrite the cookie to change what the console shows
them. They see no different data.

### DEF-016 — the console has no role gate on sign-in

`loginAction` stores whatever role the API returns. `DashboardLayout` redirects
only when there is no session at all. **An account with role `user` reaches the
console shell.** It sees no data — every page routes through `ApiState` and the
API enforces independently — but the console does not state the restriction, and
a non-operator looking at an empty console is a poor first impression of an
internal tool.

Fix: refuse a session below `support` in `loginAction` or in the layout, and say
why.

---

## 3. Session

`services/api` issues bearer tokens. They are held in an **httpOnly cookie**
(`correnthian_admin_session`, 12 hours, `sameSite: 'lax'`, `secure` in
production), set by the server action in `apps/admin/src/app/login/actions.ts`.

`localStorage` was rejected: an XSS in this admin could otherwise exfiltrate a
token that reaches every account, KYC record and audit entry.

A second cookie, `correnthian_admin_session_user`, carries the display payload
(base64url JSON). `logoutAction` revokes server-side via `POST /auth/logout`
best-effort, then clears both cookies regardless.

---

## 4. Data access

`apps/admin/src/lib/api-server.ts`. Two functions, deliberately distinct at the call site:

- `apiFetch<T>(path)` — reads.
- `apiSend<T>(path, method, body)` — writes.

`API_URL` comes from `env`, defaulting to `http://localhost:3000`. **`API_URL`
was undocumented and defaulted to the admin's own port**, so an unset value sent
every fetch to the wrong place and pages rendered empty rather than failing
loudly. Fixed in commit `419fca5` by adding `.env.example` / `.env.local`.

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
them into one "failed" state is how an admin gets shown a login screen during an
outage — which locks everyone out rather than telling them the API is down.

451 is mapped to a jurisdiction explanation rather than a generic error.
5xx maps to `unavailable`, everything else to `error`.

### `ApiState`

`apps/admin/src/components/feedback/api-state.tsx`. Every data-backed surface routes
through it, and it renders five designed states:

| State | Treatment |
|---|---|
| `ok` | The surface, or a designed empty state |
| `unauthorised` | "Session expired" with a link to `/login` |
| `forbidden` | "Not permitted" with the API's message |
| `unavailable` | "API unavailable" with **Retry** |
| `error` | "Request failed" with **Retry** |

`RetryButton` calls `router.refresh()` in a transition — a server component
cannot retry on its own, because a refetch means re-running the render on the
server.

### A partial read is not an all-clear

`dashboard/page.tsx` tracks which of its four requests succeeded. If some failed
it names them:

> Not checked, because the request failed: *users, assets*. This is not an
> all-clear.

This is deliberate and is the kind of honesty the rest of the console keeps. An
operator reading a green panel must be able to trust it.

---

## 5. Mutations

`apps/admin/src/app/(dashboard)/actions.ts` — server actions, each guarded by
`guard(requiredRole)` on both sides.

| Action | Endpoint | Role |
|---|---|---|
| `changeUserRoleAction` | `PATCH /users/:id/role` | admin |
| `changeUserStatusAction` | `PATCH /users/:id/status` | admin |
| `setAssetEnabledAction` | `PATCH /assets/:assetId/enabled` | admin |
| `recordAttestationAction` | `PATCH /assets/:assetId/attestation` | compliance |
| `setIssuerTierAction` | `PATCH /issuers/:slug/verification` | compliance |
| `addIssuerRiskFlagAction` | `PATCH /issuers/:slug/risk-flags` | compliance |
| `setProviderStatusAction` | `PATCH /providers/:slug/status` | admin |
| `setChainEnabledAction` | `PATCH /chains/:id/enabled` | admin |

Each calls `revalidatePath` on success.

**Errors render inline, not as a toast.** A permission change that silently
disappears is indistinguishable from one that never happened.

Destructive actions use `AlertDialog` through `ConfirmAction`, and say what
survives: disabling an asset or a chain leaves balances untouched on-chain.

Components are grouped by role rather than the block's flat names —
`layout/`, `feedback/`, `forms/`, `actions/`, `charts/`.

---

## 6. Page behaviour worth preserving

### Assets

- The disclosure string is rendered **verbatim** from `row.disclosure`, in a
  full-bleed band, never rebuilt from `asset.backing` on the client. This is
  the product's claim and a second implementation would drift in the direction
  that is easiest to get wrong.
- `synthetic — not metal` and `never attested` are **badges**, not grey text.
- Custody model, custodian, vault locations and attestation freshness sit in a
  fact grid above the disclosure.
- The page requests 200 rather than the API's default 50 and **says so when the
  list is full**, instead of silently truncating a registry an operator believes
  they are seeing whole.

### Issuers

The evidence is the page, not the badge. Licence types and references sit behind
a left rule that turns destructive when an `issuer_verified` issuer has nothing
behind the tier.

### Devices

Requests `includeRevoked=true`. Revoked devices are soft-deleted precisely so
the audit trail survives, so a console that hides them makes a revocation
unverifiable — an operator could see only an absence, indistinguishable from
never having had one. Revoked rows render dimmed with a destructive badge.

### Providers

`degraded` takes the **destructive** tone, not grey: a degraded rail is still
offered to users, so it is the state an operator must act on. A provider never
checked reads destructive too. Credentials are never in the table.

### Chains

No RPC column, and there never will be one — the API does not return an RPC
URL. Testnet reads as its own network badge, separate from enabled/disabled.

### Users and users/[id]

Filtering and pagination live in the URL via a plain GET form, so the URL is the
state. A smart account whose deploy transaction has not confirmed renders as
**"not yet"** with a tooltip stating it exists nowhere on-chain and cannot hold
or move anything. It must never read as live.

### Quotes

`sizeCapUsd` and `executionQuality` are first-class columns, because those two
fields are why a quote is or is not fillable. `executable` is displayed as the
honest read of the two rather than as a third opinion.

### Audit

`denied` is the only outcome that takes the destructive tone — a denied action
is a refusal someone may need to explain. The filter is a GET form over
`action` and `outcome`.

---

## 7. Not built

| Page | Blocked on |
|---|---|
| Transactions | `BE-601` — no `Transaction` row is ever written |
| Compliance / risk operations | `BE-1102` — no risk engine |
| Metals / redemption | `BE-805`, and DEF-001 makes the request path dead |
| Finance / revenue | `BE-1601` — no analytics |
| System configuration | `BE-1505` — `FeatureFlag` exists, nothing reads or writes it |
| Users list audit history | `GET /audit/actor/:actorId` exists and is not surfaced |

---

## 8. Environment

| Variable | Default | Notes |
|---|---|---|
| `API_URL` | `http://localhost:3000` | **Must be set.** It was undocumented and defaulted to the admin's own port. |
| `NODE_ENV` | — | Drives `secure` on the session cookie |

CORS: `CORS_ORIGINS` defaults to `http://localhost:3001`. The admin does not
currently run on 3001 — it has no `dev` script pinned to a port in
`package.json`. Set both together.

---

## 9. A note on provenance

The previous admin implementation is preserved at `archive/admin-legacy/`,
including its `STUB-AUDIT.md` — a per-file inventory of every mock the shadcn
block shipped with (68 fake data-table rows, 21 dead sidebar links, four
hardcoded metric cards, a 91-row frozen chart, three mutually inconsistent
reviewer lists, and three of four view tabs that were empty dashed divs).

`archive/` is outside the pnpm workspace globs, so it is never built or
typechecked. `git mv archive/admin-legacy apps/admin` restores it exactly.

The root `TASK.md` still links to `apps/admin/STUB-AUDIT.md`, which no longer
exists at that path.