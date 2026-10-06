# The API

> **SUPERSEDED in its status claims — 2026-10-06.**
> This document was written before the API was built and says "nothing exists
> yet" throughout. Every domain module it lists as unbuilt is built, auth and
> RBAC exist, and Prisma is in `services/api/package.json`. Read
> [`../agent/ARCHITECTURE.md`](../agent/ARCHITECTURE.md) and
> [`../agent/BACKEND_TASKS.md`](../agent/BACKEND_TASKS.md) for what is actually
> there. The conventions, module-boundary rules, rate-limit categories and open
> questions below remain current and worth reading. Tracked as `DEF-014`.

**Date:** 2026-10-05
**Status:** Partially built. This document marks clearly what exists and what
is planned; the distinction matters because the admin work will be wired to real
endpoints that mostly do not exist yet.

Source of truth for scope: [design spec](../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md) ·
Sequencing: [`TASK.md` P1](../../TASK.md)
Conventions: [engineering/standards.md](standards.md)

---

## Built today

Everything below exists. Everything else in this document is planned.

| Piece | Location | Notes |
|---|---|---|
| NestJS 12 app, ESM | [services/api/src/main.ts](../../services/api/src/main.ts) | Bootstraps `AppModule`, listens on `PORT ?? 3000` |
| Root module | [services/api/src/app.module.ts](../../services/api/src/app.module.ts) | `imports: []` — no modules yet |
| Health endpoint | [health.controller.ts](../../services/api/src/health/health.controller.ts) | `GET /health` → `{ status, service }` |
| Assets endpoint | [assets.controller.ts](../../services/api/src/assets/assets.controller.ts) | `GET /assets` → asset + disclosure |
| Seed registry | [seed-registry.ts](../../services/api/src/assets/seed-registry.ts) | Two fixture assets, **one deliberately synthetic** |
| Vitest | [vitest.config.ts](../../services/api/vitest.config.ts) | `include: ['**/*.spec.ts']`, `vite-tsconfig-paths` |
| Unit + e2e specs | `*.spec.ts`, `test/app.e2e-spec.ts` | `test:e2e` uses a separate config |

`GET /assets` exists specifically to exercise the disclosure path end to end:
it returns each asset together with `describeBacking()`'s sentence, so the
"synthetic tokens are never shown as metal" property is observable from outside
the process rather than only in a unit test.

**Not yet in place, and visible in `main.ts`:** no global route prefix, no
validation pipe, no CORS, no helmet, no graceful shutdown hooks, no structured
logger, no OpenAPI. All are P1.1/P1.4 work.

---

## Modular monolith, not microservices

**Decision:** one Nest application, well-modularised. P1 in `TASK.md` is
explicit — *"Modular monolith; do not split into microservices."*

Rationale, from the original design conversation:

> Some can start as simpler modules and become services only when scale requires
> it. Do not prematurely turn everything into microservices. Start with a
> well-modularized backend.

At this stage the team is one or two people, the domain is not yet proven, and
the critical path is an external partnership with a multi-month lead time.
Microservices would add a distributed-systems problem to a product problem.

**The discipline that makes this a decision rather than a deferral:** the module
boundaries below must be real, because the split into services — if it ever
happens — is supposed to fall out of them. A "modular monolith" whose modules
reach into each other's internals has neither property.

---

## Module boundaries

### The rule

1. **One Nest module per domain concept.** Module = the boundary, not the
   directory.
2. **A module exposes providers through its exported module only.** Other
   modules import the module and inject the provider. They do not deep-import
   files, and they do not reach into another module's repository.
3. **Controllers are thin.** Parse and validate the request, call a service,
   shape the response. No business logic, no provider calls, no database access.
4. **No `packages/*` imports Nest.** The shared packages are framework-free by
   construction. If one needs `@nestjs/common`, it has become a service.
5. **No domain module imports another domain module's *internals*.** Module A
   may depend on module B's public providers; A must not import from
   `b/`'s private services.

### The planned modules

Status is from `TASK.md` P1.3. **None of these are built** — only `assets` has a
stub with no persistence.

| Module | Owns | Notes |
|---|---|---|
| `assets` | Asset + issuer registry CRUD, backing disclosure | Has a stub. See [architecture/asset-registry.md](../architecture/asset-registry.md) |
| `chains` | Chain configuration, per-chain enablement | Config, not a service, after the EVM slice |
| `providers` | Provider registry, health, **credentials** | The only module that holds provider secrets |
| `swaps` | Quote requests, `SwapRail` resolution | Rail selection policy is unwritten — [architecture/rails.md](../architecture/rails.md) |
| `metals` | Instruments, serialisation, redemption states | Serialisation implies minted serial numbers; needs a decision |
| `pricing` | Metal spot + reference vs executable price | The reference/executable distinction matters for the fee disclosure |
| `onramp` | Fiat buy provider adapters | KYC and card/bank rails are provider-handled |
| `offramp` | Fiat sell provider adapters | v1.5, needs its own compliance analysis |
| `compliance` | Jurisdiction engine, sanctions screening hooks | See [compliance/overview.md](../compliance/overview.md) |
| `admin` | Internal operations surface | Backs [engineering/admin.md](admin.md) |
| `audit` | Immutable audit log | See below |
| `notifications` | Delivery of user-facing messages | |

**Where credentials live.** Exactly one module — `providers` — holds provider
API keys, and nothing else may read them. `integrations/*` (the per-provider
adapter packages) receive credentials through an injected interface, never
through the environment. See [operations/overview.md](../operations/overview.md).

**The audit module is not a log file.** It must be append-only, queryable by
actor and entity, and separate from application logs — because application logs
are redacted, sampled and rotated, and an audit record that can be edited is not
an audit record. Any change to an asset's `Backing` or `Trust` payloads changes
what a customer is told they own; that is an audit event.

---

## Data layer

**Planned** (P1.1), and currently the only item on that list marked in
progress:

| Piece | Choice | Status |
|---|---|---|
| PostgreSQL | Via Prisma — schema, migrations, seed | `[~]` **in progress.** Prisma is **not** in `services/api/package.json` yet — no schema, no client, no migration |
| Redis | Client + health checks | Planned |
| Config | Typed, validated env via `@correnthian/config` | Planned. The package is a stub — `packages/config/src/index.ts` is `export {}` |
| Logging | Structured, with `redactDeep()` wired in | Planned |
| Shutdown | Graceful | Planned. `main.ts` currently has no lifecycle hooks |

**Config must validate at boot and fail loudly.** A missing provider key
discovered at the first customer quote is far worse than a process that refuses
to start. `@correnthian/config` should parse once, export a typed object, and
refuse to boot with an incomplete configuration — see
[operations/overview.md](../operations/overview.md).

**Redis is a cache and a rate-limit counter. It must never be the source of
truth** for anything a customer would notice losing. This is stated as a rule
here because it has not yet been formally ratified, and because "we put it in
Redis because it was there" is the usual way that rule dies.

**Where do validation schemas live?** Open, and blocking. P1.4 requires Zod on
every route; the repo also wants a typed `@correnthian/api-client`. If the
schemas live in the service, the client package cannot import them without
depending on a service; if they live in `packages/types`, the service depends on
a shared package for runtime behaviour. Decide before either is built.

---

## Identity and access

**Planned** (P1.2). Nothing exists yet — there is no auth module, no users
module, no session handling.

| Piece | Direction |
|---|---|
| Auth | Passwordless, session strategy |
| Users, devices, sessions | Correnthian Account data — see [architecture/key-boundary.md](../architecture/key-boundary.md) |
| Device registration and trust | A device is a *listed* device; what a listed device authorises is undecided |
| Rate limiting | Redis-backed |
| Admin role / RBAC | A guard; role checks must be server-side, never only in the admin UI |

**Two constraints from the key boundary that this module must respect:**

1. A session authenticates **requests**. It never authorises a signature. The
   transaction that moves funds is signed on the device; the session is what
   asks the server for the data and for a quote.
2. No field on a Correnthian Account may be sufficient to produce a signature.
   If a session can, the account is custodial and the boundary has failed.

**Passwordless is a real product decision, not just an implementation detail.**
This audience is seed-phrase-phobic because it is phishing-averse and
credential-fatigued. An email-link or passkey session that is itself phishable
undercuts the trust claim. Consider what the session flow asks the user to
trust, not only how convenient it is.

---

## Rate limiting

**Planned** (P1.2), Redis-backed.

Limits are not uniform, and the categories that matter:

| Endpoint class | Expectation |
|---|---|
| Auth / session creation | Aggressive. Credential-stuffing and phishing-enumeration surface |
| Quote requests | Cost-bearing — every quote hits a provider. Must be limited and must be attributable |
| Provider credentials | Must never be reachable from a public route |
| Admin reads | Bounded and audited; the internal surface is a target |
| Admin writes | Every one audited |

No specific numbers are proposed here. They should come from the provider's
rate limits and from the admin's own usage, and both are unverified.

---

## Validation

**Planned** (P1.4): **Zod on every route.** Not "on routes that take a body" —
every route, including path and query parameters.

- Validate at the boundary, once, before any business logic runs.
- Fail closed. A payload that does not match the schema is rejected, never
  coerced.
- The parsed, validated value — not the raw request — is what reaches the
  service.
- Asset identity arrives as an `AssetRef`
  (`{ chainId, contractAddress, issuerId }`), never as an `assetId` string or a
  symbol. See [architecture/asset-registry.md](../architecture/asset-registry.md).

---

## Error taxonomy

**Proposed. Not decided, not implemented.** Recorded here because
[engineering/admin.md](admin.md) needs a stable shape before the admin is wired
to real data, and because an ad-hoc taxonomy discovered during the rewiring will
be worse than a small deliberate one.

Requirements:

1. **Stable, machine-readable `code` strings.** The admin and the future clients
   branch on the code, never on the human message.
2. **HTTP status derived from the category**, not chosen per handler.
3. **No internal detail in the response body.** Provider response bodies, stack
   traces and internal identifiers stay in the server log — redacted
   ([engineering/standards.md](standards.md)).
4. **Jurisdiction and risk refusals are their own category**, distinct from
   generic errors, so the UI can say the right thing. A user in an ineligible
   state must be told *that*, not shown a validation error.

A workable starting shape:

| Category | HTTP | Carries |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Field-level issues from Zod |
| `UNAUTHENTICATED` | 401 | — |
| `FORBIDDEN` | 403 | Required role or missing entitlement |
| `NOT_FOUND` | 404 | — |
| `CONFLICT` | 409 | Including stale quote, duplicate submission |
| `RATE_LIMITED` | 429 | Retry-after |
| `UNSUPPORTED` | 422 | Rail or asset pair unsupported |
| `JURISDICTION_BLOCKED` | 403 | Jurisdiction + rule id + effective date |
| `PROVIDER_UNAVAILABLE` | 503 | Which provider, degraded vs down |
| `INTERNAL` | 500 | Correlation id only |

`JURISDICTION_BLOCKED` carrying a **rule id and effective date** is what makes
the compliance engine auditable — see
[compliance/overview.md](../compliance/overview.md).

---

## OpenAPI

**Planned** (P1.4). Generated from the DTO schemas, published alongside the
service, and treated as the contract the admin is built against.

The sequencing constraint: if the admin is wired to real endpoints before the
schema exists, the contract is whatever the admin happens to observe. That
inverts the dependency and makes both sides worse.

---

## Open questions

1. **Where do shared Zod schemas live?** See *Data layer*. Blocking for both the
   admin and `@correnthian/api-client`.
2. **Is the error taxonomy above accepted?** It is a proposal. It should be
   agreed before the admin rewiring begins.
3. **Global route prefix.** None today. `/assets` and `/health` are at the root.
   Decide before the surface grows; changing it later breaks the admin.
4. **Multi-tenancy / environment separation.** Nothing in the design describes
   how `dev`, `staging` and `production` are kept apart — separate databases,
   separate provider sandboxes, or a tenancy column. Needed for
   [operations/overview.md](../operations/overview.md).
5. **What does a session authorise on a device?** Device registration and trust
   are planned; what a registered device can actually *do* server-side is not
   written down. This is the most security-relevant unanswered question in P1.2.
6. **What does `metals` serialisation mean?** "Serialisation" in the module list
   implies minted serial numbers on physical holdings. Whether Correnthian has
   that data at all depends on the partner. It may be an empty module.
7. **Who reads the audit log, and is it queryable by end users?** An internal
   immutable log and a user-facing one are different products. Only the internal
   case is currently implied.
8. **Job execution.** Notifications, attestation-expiry flags and pricing
   refresh all need background work. BullMQ, a cron runner, or a managed
   scheduler — none chosen. See [operations/overview.md](../operations/overview.md).