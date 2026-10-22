# API_CONTRACTS

`@correnthian/contracts` is the single source of truth for what goes over the
wire. The API validates its responses against it; clients infer their types
from it. Neither side hand-writes a shape.

**Why it exists:** three incidents in this repository had the identical shape —
the admin declared its own TypeScript interfaces, nothing compared them to what
the API actually returned, and every mismatch surfaced as a runtime bug in a
browser rather than a build failure.

| Incident | Commit | Symptom |
|---|---|---|
| Portfolio valuation reading zero | `ce5a4a9` | Surrogate and domain `assetId` mixed; every holding unpriced |
| Assets page 500ing on `issuerName` | `a6e0dbe` | Response is `{ asset, disclosure }`; the admin assumed a flat shape |
| Disable button with an inverted label | `4bc4e90` | `enabled` was never returned, so the destructive branch was unreachable |

TypeScript was clean every time.

---

## 1. How it works

**`packages/contracts/src/schemas.ts`** — one Zod schema per response envelope,
modelled exactly as the API returns it, including wrappers.

**`packages/contracts/src/index.ts`** — the registry and the inference helper:

```ts
export type Contract<Path extends keyof typeof CONTRACT_REGISTRY> =
  z.infer<(typeof CONTRACT_REGISTRY)[Path]>;
```

**`services/api/src/contracts.spec.ts`** — boots the real API against a real
database, calls every endpoint the console consumes, and parses each response
through the same schema. 27 tests.

### Adding a contract

1. Add the schema to `packages/contracts/src/schemas.ts`, modelled on the
   actual response — including any envelope wrapper.
2. Register it in `CONTRACT_REGISTRY` keyed by `METHOD /path` — the **real**
   path, prefix included (`GET /api/v1/assets`). A registry that says `/assets`
   while the API serves `/api/v1/assets` describes an API nobody has. Error
   envelopes are registered separately, keyed `ERROR METHOD /path`, so a client
   can declare what it expects to *not* get as precisely as what it expects.
3. Add a test in `contracts.spec.ts` that calls the route and parses the result.
4. Add a consumer on the client using `Contract<'METHOD /path'>`.

Skipping step 3 is the failure the package exists to prevent: a schema nobody
executes proves nothing, which is the mistake `GET /swaps/quotes` on an empty
table already demonstrated.

---

## 2. The registry — 109 entries

| Key | Schema | Min role |
|---|---|---|
| `GET /assets` | `assetListSchema` | any session |
| `GET /assets/stats` | `assetStatsSchema` | any session |
| `GET /users` | `userListSchema` | support |
| `GET /users/stats` | `userStatsSchema` | support |
| `GET /users/:id` | `userDetailSchema` | support |
| `GET /devices/all` | `deviceListSchema` | support |
| `GET /devices/stats` | `deviceStatsSchema` | support |
| `GET /issuers` | `issuerListSchema` | support |
| `GET /chains` | `chainListSchema` | any session |
| `GET /providers` | `providerListSchema` | any session |
| `GET /swaps/quotes/stats` | `quoteStatsSchema` | support |
| `GET /swaps/quotes` | `quoteListSchema` | support |
| `GET /swaps/quotes/:id` | `quoteDetailSchema` | support |
| `GET /audit` | `auditRowSchema[]` | compliance |
| `GET /audit/:id` | `auditDetailSchema` | compliance |
| `GET /audit` (error envelope) | `apiErrorSchema` | — |
| `GET /settings/system` | `systemSettingListSchema` | support |
| `PATCH /settings/system/:key` | `systemSettingSchema` | admin |
| `GET /config` | `clientConfigSchema` | public |

`apiErrorSchema` is the standard envelope every failure path produces:
`{ error: { code, message, detail? }, path, timestamp }`.

**109 entries, covering 39 mutating routes as well as the reads.** The table
above is the part of the registry this section is about; the full map is
`CONTRACT_REGISTRY` in `packages/contracts/src/schemas.ts`, and every entry
in it is parsed by a live response in `services/api/src/contracts.spec.ts`.

`GET /config` is the first **public** entry with a body: it is what a client
reads before it offers anything, so it carries the API version, the
maintenance state and message, and the enabled chains — and nothing else.

---

## 3. What is NOT covered

This is the part that matters. A registry entry is a guarantee; its absence is
not a warning, it is silence.

### Mutating routes — a snapshot from before the registry grew

> **This list has not been re-audited.** It was written when the registry held
> sixteen read routes and nothing else, and it claims that no mutating route
> had a contract. That is no longer true: 39 mutating routes have one now,
> including `POST /assets` and `PATCH /settings/system/:key`.
> `CONTRACT_REGISTRY` in `packages/contracts/src/schemas.ts` is the
> authority; the table below is what was untyped when it was written, kept
> for the record rather than deleted.

| Route | Method | Notes |
|---|---|---|
| `/auth/register` | POST | response shape is `{ user, token, expiresAt }`; untyped |
| `/auth/login` | POST | same |
| `/auth/logout` | POST | 204, nothing to type |
| `/assets` | POST | returns `{ asset, disclosure }` — the same envelope as the list |
| `/assets/:assetId/enabled` | PATCH | **the response drove an incident** |
| `/assets/:assetId/attestation` | PATCH | |
| `/issuers` | POST | |
| `/issuers/:slug/verification` | PATCH | |
| `/issuers/:slug/licences` | PATCH | |
| `/issuers/:slug/risk-flags` | PATCH | |
| `/providers/:slug/status` | PATCH | |
| `/chains/:id/enabled` | PATCH | |
| `/users/:id/role` | PATCH | |
| `/users/:id/status` | PATCH | |
| `/pricing/record` | POST | |
| `/redemptions` | POST | **the envelope is the `RedemptionRequest` row, which has a different field set from anything else** |
| `/redemptions/:id/transition` | PATCH | |
| `/notifications` | POST | |
| `/onramp/quote` | POST | **always throws; no success shape exists** |
| `/blockchain/wallets/:walletId/sync` | POST | |

### Read routes not covered

| Route | Min role | Why it matters |
|---|---|---|
| `GET /auth/me` | any | `{ id, email, role }` — trivially stable |
| `GET /health/live`, `GET /health/ready` | public | The orchestrator contract. Untyped means a probe change is not a build failure. |
| `GET /issuers/stats`, `GET /issuers/:slug` | support | |
| `GET /chains/:id` | any | |
| `GET /providers/health`, `GET /providers/:slug` | any | Health shape matters for the alert path |
| `GET /blockchain/health` | support | Per-chain reachability |
| `GET /wallets`, `/wallets/portfolio`, `/wallets/:id` | any | |
| `POST /wallets`, `PATCH /wallets/:id/label`, `/primary`, `DELETE /wallets/:id` | any | |
| `POST /wallets/:id/balances/:assetId` | any | |
| `GET /portfolio`, `/portfolio/wallets/:walletId`, `.../history` | any | **Valued shapes. A drift here reads as "the user has no money".** |
| `GET /pricing/assets/:assetId`, `.../history` | any | Reference vs executable — the shape carries the honest-failure statement |
| `GET /notifications/mine`, `/notifications/stats` | any / support | |
| `GET /redemptions/mine`, `/redemptions/stats` | any / support | |
| `GET /swaps/quotes/mine` | any | |
| `GET /audit/actor/:actorId` | compliance | |
| `GET /devices`, `POST /devices`, `DELETE /devices/:id` | any | |
| `GET /compliance/eligibility` | public | The pre-sign-in check |
| `GET /onramp/availability` | public | Self-describing `{ available, reason }` — an ADR-worthy shape |

### Envelopes nobody has registered at all

- **`Device`** from `GET /devices` and `POST /devices` — a different projection
  from `deviceRowSchema` (no `user` join, no `revokedAt`).
- **`Wallet`** — `apps/admin`'s users page renders `wallets` inside
  `userDetailSchema`, so the shape is pinned there, but there is no standalone
  wallet contract and no `GET /wallets` contract.
- **`Holding` / `Portfolio`** — the most consequential untyped shape in the
  system.

---

## 4. The contract suite

`services/api/src/contracts.spec.ts`, 27 tests.

### What it guarantees

- Every registered key's real response parses through its schema.
- `GET /swaps/quotes` filters by `state` and `railKind`; each filter was
  mutation-checked by disabling it and confirming the right tests fail.
- Keyset pagination neither repeats nor skips a row, and the cursor survives a
  filter change.
- An unreadable cursor is a 400, not a silent restart at page one.
- The asset symbols and provider name are resolved server-side.
- `GET /audit` filters by action and outcome and resolves the actor to an
  address; `GET /audit/:id` returns the redacted metadata; a missing entry is
  a 404.
- Every failure path uses the shared error envelope.

### What it deliberately does not let happen

- **It refuses to skip in CI.** When `CI` is set and `DATABASE_URL` is absent,
  the suite throws rather than skipping. A green build that quietly omitted the
  check would assert that drift is impossible while proving nothing — worse than
  no check, because the guarantee would be believed. Locally it still skips so a
  contributor without Docker is not blocked.
- **It seeds its own fixtures.** `GET /swaps/quotes` on an empty table returns
  `{ items: [], nextCursor: null }`, which parses perfectly — a schema assertion
  against an empty table would pass forever.
- **It resets the Redis rate-limit bucket** before its first request, because
  every request shares one seeded identity's 120/min window. Without that, the
  result would depend on how recently the suite last ran.

### Its blind spot

**The suite only exercises read routes the console consumes.** No mutating
route is covered, which is why `DEF-002` — a write to a Prisma column that does
not exist — survived both the suite and `tsc`. See
[`BACKEND_TASKS.md`](BACKEND_TASKS.md) `BE-1702`.

---

## 5. Client-side usage

`apps/admin/src/lib/types.ts` is the shared inference surface:

```ts
export type AssetSummary = Contract<'GET /assets'>[number];
export type UserDetail   = Contract<'GET /users/:id'>;
```

Pages needing a page-local type declare it beside the page, still inferred —
`quotes/page.tsx` and `audit/page.tsx` both do this correctly.

**One exception remains.** `dashboard/page.tsx` imports a hand-written
`AuditRow` from `lib/types.ts`, whose comment claims the type is "not yet in the
contract registry". It is. `QuoteStats` in `lib/types.ts` is dead, shadowed by
the quotes page's own declaration. Tracked as `DEF-012`.

---

## 6. Adding the missing coverage

Priority order, highest consequence first:

1. **`GET /portfolio*`** — a drift here is a user believing they hold nothing.
2. **`POST /redemptions`** — the envelope nobody has typed, and the route with
   two live defects.
3. **`PATCH /assets/:assetId/enabled`** — the response shape whose absence
   already caused an incident.
4. **`GET /auth/login`** — the admin's entire session model depends on
   `{ token, user }`.
5. **`GET /health/ready`** — the orchestrator contract.
6. Everything else, as mutating routes grow.

**Recommendation:** when adding a mutating route, register its response in the
same commit. The suite asserting reads only is a structural blind spot, not an
oversight.