# Operations

**Date:** 2026-10-05
**Status:** Mostly planned. Nothing has been provisioned —
[`infrastructure/`](../../infrastructure/README.md) is deliberately empty at
Foundation v0.1. This document describes the intended posture and names where
decisions are still missing.

Related: [engineering/standards.md](../engineering/standards.md) (the
secret-redaction rule) · [architecture/key-boundary.md](../architecture/key-boundary.md) ·
[compliance/overview.md](../compliance/overview.md)

---

## Environments

| Environment | Purpose | Status |
|---|---|---|
| Local | `pnpm dev`; Postgres and Redis via `infrastructure/docker/` (planned) | Not provisioned |
| Staging / dev | Shared, non-production, provider **sandboxes** | Not provisioned |
| Production | Real provider credentials, real money | Not provisioned |

`.env.example` already separates the sandbox flag
(`METALS_PROVIDER_SANDBOX=true`, `ONRAMP_PROVIDER_SANDBOX=true`) from the API
credentials, which is the right shape: **staging never talks to a production
provider by configuration accident.**

**How environments are separated is undecided** — see
[engineering/api.md](../engineering/api.md) open question 4. Separate databases
with separate credentials is the safe default. A tenancy column in one database
is cheaper and is where environments leak into each other. Recommend separate;
require a decision.

---

## Configuration and secrets

### The rule

> **No key material ever enters an env file.**

Not Correnthian's, not a user's, not a fixture's, not "just for local dev".
`.env.example` states this at the top of the file, and CI enforces the narrow
case of `*.env*` files
([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), `secret-scan`).

### Two different categories of secret

Conflating these is the most common source of confusion in this section, so
they are separated explicitly:

| | **Correnthian's own secrets** | **User key material** |
|---|---|---|
| Examples | Provider API keys, DB credentials, session signing keys, Sentry DSN, RPC URLs with embedded tokens | Seed phrases, private keys, passkey material, seed entropy |
| Where they live | Platform secret store / deployment environment. **Never committed.** | The user's device. **Nowhere else. Ever.** |
| Where they may **not** live | `.env*` files, `infrastructure/` source, logs, client bundles, error reports | Anywhere on Correnthian infrastructure, full stop |
| How they are managed | Rotated; access-controlled; scoped per environment | Not applicable — Correnthian manages none |

**The asymmetry is the point.** Correnthian's own secrets are an ordinary
operational problem with ordinary controls. User key material is not a secret
Correnthian holds — it is a thing Correnthian is structurally incapable of
holding, which is why the second row has no management story. See
[architecture/key-boundary.md](../architecture/key-boundary.md).

`infrastructure/README.md` already makes this distinction correctly: *"This
directory configures Correnthian's own secrets… It is categorically separate
from user wallet material."*

### The config module

**Planned** (`TASK.md` P1.1). [`packages/config`](../../packages/config/src/index.ts)
exists as a package and is a stub — `export {}`.

Requirements when it is built:

1. **Parse once, at boot.** A typed, validated configuration object. No
   `process.env.X` reads scattered through the codebase.
2. **Fail loudly and immediately.** An incomplete configuration must stop the
   process at startup, not surface as a failed quote to a customer at 2am.
3. **Never log the parsed object.** `@correnthian/config` will hold every
   provider credential in the process; it must never be a log argument.
4. **No secret defaults.** There is no "development" credential baked into
   source. The sandbox flag gates the sandbox; it does not supply a key.

---

## Observability

### Logging

**Planned** (P1.1): structured logging with redaction wired in.
[packages/security](../../packages/security/src/index.ts) already exports
`log.info/warn/error`, which apply `redactDeep()` before writing.

Rules:

- Use `log.*`, not `console.*`, in server code.
- **Redaction is defence in depth, not permission to log.** The primary control
  is that key material never reaches the server. Redaction catches the
  mistake; it does not authorise one.
- **A signature is not key material and will not be redacted.** A logged signed
  transaction is replayable while its nonce is unconsumed. Do not log signed
  payloads.
- Every log line needs a correlation id, or an incident is untraceable.

`.env.example` already reserves `SENTRY_DSN` and
`OTEL_EXPORTER_OTLP_ENDPOINT`; neither is wired up.

### The audit log is a different system

The `audit` module (P1.3) must not be the application log.

| | Application log | Audit log |
|---|---|---|
| Mutability | Rotated, sampled, redacted | **Append-only.** Never edited, never deleted |
| Purpose | Diagnose | Evidence |
| Content | Whatever helps debugging | Who did what, to which entity, when, from where |
| Retention | Weeks | Set by the record-keeping obligation — **not yet determined** (see [compliance/overview.md](../compliance/overview.md) #9) |

Events that must land in the audit log: any change to an asset's `Backing` or
`Trust` payloads (this changes what a customer is told they own); every admin
write; every session revocation; every jurisdiction decision.

### Metrics

Unspecified. The obvious ones given the architecture: provider quote latency and
failure rate by rail, RPC health per endpoint, quote-to-settlement time, and the
distribution of `executionQuality` actually returned — that last one is the
honest measure of whether the liquidity assumption in
[architecture/rails.md](../architecture/rails.md) holds.

---

## Backup posture

**Planned.** Nothing runs yet, so this is intent rather than configuration.

| Data | Backup | Notes |
|---|---|---|
| Postgres | Automated backups + point-in-time recovery | The only Correnthian data that is authoritative |
| Redis | **None, and none needed** | Cache and rate-limit counters only. Losing them costs a cold cache, not data |
| Provider-side state (KYC status, orders) | **Not ours to back up** | **This is the exposure.** A provider-side incident cannot be recovered from |
| Audit log | Treated as append-only; retention TBD | Depends on counsel |
| Secrets | Platform-managed, with rotation | Not backed up — reissued instead |

**The provider-side row is the honest risk in this table.** Customer identity
and order state live with third parties Correnthian does not control. That is a
direct consequence of the thin-aggregator posture — the same posture that keeps
assets out of Correnthian's hands keeps critical records in someone else's. It
is a trade, not a free win, and it should not be presented as one.

**The Redis rule needs ratifying.** "Redis is never the source of truth" is
currently a convention stated in [engineering/api.md](../engineering/api.md) and
here, not an enforced constraint. It should be enforceable — for example, no
job may be durable in Redis, and queue state must be reconstructible.

---

## Provider health and failover

### The critical dependency

The metals provider is the **primary rail and a launch dependency**
([architecture/rails.md](../architecture/rails.md)). The DEX fallback is thin by
definition and unusable by the beachhead buyer. The spec accepts this as a
single point of failure: *"Mitigated by the rail interface, not eliminated."*

### The RPC manager

`.env.example` already anticipates this, under a comment that is worth reading
before changing anything:

> `# --- Blockchain RPC (failover-managed; no single provider is authoritative) ---`

The concept: **a pool of endpoints per chain, with health tracking and
failover, behind one interface that the rest of the codebase sees as a single
client.** The blockchain package exists to put exactly one abstraction in front
of EVM, Bitcoin and Solana
([packages/blockchain](../../packages/blockchain/src/index.ts) — currently
`export {}`).

Properties the manager must have:

1. **Health is measured, not assumed.** Latency, error rate, and — the one that
   matters most — whether it is returning the *same* chain head as its peers. An
   endpoint that is fast and serving an old or forked view is worse than one
   that is slow and correct.
2. **Failover is transparent to callers.** `BlockchainAdapter` does not branch
   on which endpoint answered.
3. **Failover must never change what a signed transaction means.** This is the
   hard constraint. A signature is over a payload; a different endpoint serving
   a different nonce or a different gas estimate does not invalidate the
   signature, but reconciling it incorrectly does lose the user's transaction.
   **Reads** may fail over freely. **Broadcast** goes to one chosen endpoint and
   is then reconciled across the pool. Conflating the two is how a "recovered"
   transaction becomes a double-spend.
4. **Degraded is not down.** `ProviderRail`'s quote path and the RPC pool both
   need to distinguish "working" from "working but slow", because a quote engine
   that cannot say this size is not available will quote something it cannot
   fill — the same principle as `sizeCap`.

### Observability for all providers

Not yet built. Required:

- Health and latency by provider and by endpoint, continuously.
- Alerting on degradation, not only on total outage. A thin quote that fills at
  a bad price is a customer-harm event that never registers as an error.
- Every provider failure reaching the customer's UI must name the provider and
  whether it is degraded or down — see the `PROVIDER_UNAVAILABLE` category in
  [engineering/api.md](../engineering/api.md).

---

## Runbooks

**`docs/runbooks/` is empty.** Nothing is written. What is needed, in priority
order:

| Runbook | Trigger | Why urgent |
|---|---|---|
| **Key-boundary incident** | Any indication key material reached a server | No procedure exists. This is the worst-case scenario and it currently has none |
| Provider outage (metals) | Primary rail down or degraded | Single point of failure; the customer-visible path |
| RPC exhaustion / fork | Pool unhealthy or disagreeing on head | Can produce an unrecoverable balance discrepancy |
| Disclosure correction | A backing or trust field is found to be wrong | Customer-facing; may be a legal matter |
| Sanctions / compliance hit | A screening result blocks a user | Time-sensitive, and the path is undefined |
| Provider credential rotation | Routine or compromise | No runbook; also the least rehearsed |
| Key-boundary CI guard failure | The guard trips | Means either a policy bug or a real incident; decide which *before* it happens |

The first one is the striking gap: the repository's central security invariant
has no incident procedure.

---

## Open questions

1. **Hosting and deployment.** Nothing decided. `infrastructure/` anticipates
   docker/terraform overlays, but there is no target platform, and the choice
   determines where secrets live and therefore several rows above.
2. **Environment separation.** Separate databases or tenancy column? See
   *Environments*.
3. **Job execution.** Notifications, attestation-expiry flags, pricing refresh
   and audit-log processing all need background work. BullMQ, a cron runner, or
   a managed scheduler — none chosen. This is what makes the "Redis is never the
   source of truth" rule enforceable or not.
4. **Retention periods.** Application logs, audit records, KYC records. All
   three depend on counsel ([compliance/overview.md](../compliance/overview.md) #9)
   and none is set.
5. **On-call.** There is no on-call rotation, no escalation policy, and no
   defined response time for a provider outage that blocks customers from
   buying.
6. **Recovery objectives.** RPO and RTO for the Postgres instance are unset. For
   a product whose main asset is trust, "we restored from backup" needs a
   measured number attached to it.
7. **Secret rotation cadence and procedure.** No policy exists for rotating a
   provider key, a DB credential, or a session signing key — including how
   rotation interacts with sessions that are already live.
8. **Does the deployment platform's secret store satisfy the "no `.env`"
   requirement?** Deploying to a platform that materialises env vars is fine;
   committing them is not. Confirm per platform rather than assuming.
9. **Status page and customer communication.** When the primary rail is down,
   what does the customer see, and where? No incident-communication path is
   designed, and for this audience (banking-grade expectations, per spec §8)
   silence is the most expensive option available.