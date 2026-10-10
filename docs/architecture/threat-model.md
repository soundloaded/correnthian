# Threat model — Correnthian API + admin console

**Status:** `PARTIAL` → this document closes the "no document" half of
SEC-001. It does not close the threat-modeling *practice* (no review
cadence, no per-feature intake yet) — see §6.

**Scope:** the NestJS API and the Next.js admin console. The mobile app,
web wallet and marketing site are framework defaults with no backend
trust placed in them: the API authenticates every call and denies by
default, so there is nothing here about clients that do not exist.

**Method:** every mitigation below names the code and the test, or is
listed in §5 as an accepted gap with an owner. A mitigation described
without either is a wish, and wishes do not survive contact with the
reader. Claims were re-verified against the tree on 2026-10-10; file
references are where they were true then.

**The one sentence this document exists to defend:** compromising an
**account** must never yield **funds**, and compromising the **server**
must never yield **keys** — because the server never has them.

---

## 1. Assets

| Asset | Where it lives | Why it matters |
|---|---|---|
| User funds | On-chain, moved only by device-held keys | The thing everything else protects; the server cannot move them by design |
| Session tokens | Postgres (`Session.tokenHash`), httpOnly cookie (admin), client memory (API consumers) | Bearer credentials; theft is account takeover |
| Password digests | Postgres (`User.passwordDigest`, argon2id) | Theft enables offline cracking |
| Account PII | Postgres (`User.email/country/region`, `Device.pushToken/label`) | Phishing, correlation, notification spoofing |
| KYC Sanctity state | Postgres (`KycProfile`, `User.kycStatus`) | A flipped bit is permission to move fiat |
| Sanctions posture | Postgres (`sanctionsResult`) + vendor | A cleared latch is permission for a listed person |
| Audit trail | Postgres (`AuditLog`) | Tampering erases the investigation |
| Provider credentials | Process env only (RPC URLs, Persona keys, fee feeds) | Quota theft, vendor impersonation |
| Webhook secret | Process env only | Forgery of verification verdicts |
| Reviewer identities | `reviewedBy`, audit `actorId` | Attribution of every human decision |

Deliberately **not** assets here: identity documents and biometrics. The
schema has no column for them, the KYC port carries codes-never-PII, and
the review-queue tests assert documents never appear in output. There is
nothing to steal because there is nowhere to keep it.

---

## 2. Adversaries

- **Remote attacker.** No credentials, any network position. Gets the
  public routes, the rate limiter, and validation errors.
- **Malicious account holder.** A valid session, their own data, and
  patience. Tries IDOR, privilege escalation, replay, and gate evasion.
- **Rogue operator.** A support/compliance/admin session used maliciously
  or stolen. Tries silent changes, self-approval, and audit cleanup.
- **Compromised vendor.** Persona, an RPC provider, or a future metals or
  pricing feed sending malicious, replayed, or absent data.
- **Supply chain.** A poisoned dependency or a leaked secret in the tree.

Out of scope: host compromise (disk encryption and provider access are
the hoster's), device compromise (the wallet's problem, and the reason
for guardians), and physical coercion.

---

## 3. Abuse cases and mitigations

### Funds and keys

**A1. Steal keys from the server.**
There are none to steal. `packages/wallet-core` accepts no HTTP client,
no RPC endpoint and no provider SDK, enforced structurally by
`scripts/check-key-boundary.mjs` in CI — a `pnpm add axios` there fails
the build. The server assembles unsigned payloads and relays
device-signed ones; `broadcastTransaction` takes bytes, never key
material (`packages/blockchain/src/evm.ts`), and the relay verifies the
recovered signer against the wallet before submitting
(`transactions.service.ts` `relay`, 14 tests, 11 mutations killed).

**A2. Move funds with a forged or substituted payload.**
The relay decodes the payload, recovers the signer from the signature,
and compares signer, chain and `to`/`value`/`data` against what the
server assembled — before any network call. A payload edited after
signing recovers someone else. Tested with a genuinely tampered payload
(`decode-signed.test.ts`), not a fixture claiming to be one.

**A3. Replay a financial POST (double purchase, double payout).**
`Idempotency-Key` with a Postgres-backed claim, serialised across
instances by a unique index rather than a lock — proven by firing six
simultaneous duplicates at two application instances (BE-106).

### Sessions and authentication

**B1. Steal a session from the database.**
`Session.tokenHash` is SHA-256 of a 32-byte random token
(`auth/token-hash.ts`, `auth.service.ts:53`); a dump yields hashes with
no useful inversion, and the rate limiter keys on the same digest rather
than inventing a second hash that could drift.

**B2. Steal a session in transit or from the browser.**
Admin tokens live in an `httpOnly`, `Secure` (in production),
`SameSite=Lax` cookie, never localStorage (`apps/admin/src/lib/session.ts`
— the comment states the XSS reasoning). API consumers hold bearer
tokens in memory. CSRF posture depends on deployment topology and is an
accepted gap (§5), not a claim.

**B3. Guess credentials.**
Argon2id with enforced floors (`ARGON2_MEMORY` floor 19456, config-tested),
a dedicated auth rate ceiling independent of the general one (DEF-004),
and login verifying a dummy digest for missing accounts so absent and
wrong take comparable time (`auth.service.ts` — timing-attack parity by
construction).

**B4. Use a stolen, expired or revoked session.**
`resolveSession` rejects revoked and expired sessions on every request;
`revokeSession` exists; TTL defaults to 720h. Thirty days is long-lived
for a bearer token — noted in §5 rather than defended.

**B5. Lose the password.**
There is no reset flow (verified absent). With no email infrastructure
(BE-1201 sends nothing) there is nothing to send a reset link through.
A forgotten password is permanent lockout today — availability gap, §5.

### Authorisation

**C1. Read or move another account's data (IDOR).**
Ownership comes from the session and the wallet row, never from input:
`create` takes the owner from the wallet, `assemble`/`relay`/`observe`
check `wallet.userId`, the gate checks the profile row. Creation
endpoints return 404 (not 403) for foreign ids so probing learns
nothing. Covered by service specs plus the 403-over-HTTP suite.

**C2. Reach an operator route as a customer.**
`RolesGuard` with a fail-closed hierarchy (unknown held role ranks below
`user`; unknown requirement is unsatisfiable), tested at two layers:
11 unit tests plus all 40 gated routes proving a real `user` session
gets 403 while `admin` is admitted where the hierarchy admits it. The
pinned gate list fails if a route loses its `@Roles()` (BE-1703,
DEF-021).

**C3. A rogue operator acts silently.**
The audit trail is append-only — verified: no update, delete or upsert
path on `AuditLog` exists outside `create`. State changes go through
`recordChange` with the reason asserted *before* the write, and the
review queue records reviewer, timestamp and reason per decision. Audit
write failures are swallowed deliberately (availability over
completeness), which is a stated tradeoff, not a silent one.

### Compliance evasion

**D1. Buy or cash out unscreened.**
`ComplianceGate.assertFiatAllowed` stands in front of every fiat
movement row that exists (`redemption.request`; onramp execution and
metals purchase have no endpoints to wire). Unapproved KYC, latched
sanctions, stale screens (re-screened inline) and unreachable vendors
all deny; uncertainty never allows. Denials are one generic 403 —
typed internally, reason-free externally (tipping-off). 10 gate tests,
8 job tests, 17/17 mutations killed.

**D2. Unfreeze with a later clean screen.**
The latch only clears on a human approve decision — tested at webhook,
rescreen, decide and no-op paths. A subsequent clean screen records
without unfreezing.

**D3. Forge a verification verdict.**
HMAC over raw bytes verified before parse before apply; unsigned is
401, duplicates/stale/unbound ack without applying (so Persona never
retries what can never apply). Tested over HTTP with real HMACs,
including rotation pairs. Residual: no live signed bytes without a
public receiver URL.

**D4. Claim a different jurisdiction.**
Country and region come from the account row, never the request —
`RedemptionRequestInput` has no country field, which makes the lie
unrepresentable rather than discouraged. Unmatched locations deny;
`routes` and service specs pin both directions.

### Infrastructure and supply chain

**E1. Steal RPC quota or vendor credentials.**
RPC URLs are read from the database and never returned by any route
(verified by grep: no `rpcUrls` outside the service, Prisma and
generated code). Provider error strings are redacted through
`summariseError` (endpoint-stripping, not just truncation — the URL
rule exists because viem puts `URL: http://…` in line two). Secrets
live in env only: `credential-scan` plus `check-secrets.mjs` in CI cover
PEM blocks anywhere, key-material assignments in any file, and vendor
token shapes outside fixtures.

**E2. Poison a dependency.**
`pnpm install --frozen-lockfile` in CI, and `check-deps.mjs` gates on
*untriaged* high/critical production advisories — severity without
reachability analysis would fail forever on build-tooling chains and get
disabled. Each entry names the chain and why it cannot reach production
traffic; new advisories fail until triaged. `wallet-core`'s dependency
graph is guarded separately (A1).

**E3. Exhaust the service.**
Per-session/per-IP rate buckets with independent auth ceilings;
scheduled jobs with budgets, leases and bounded batches; Zod validation
at every mutating edge with a whole-table no-500 suite. Bypass testing
beyond bucketing is an accepted gap (§5).

**E4. Blind the operators.**
Audit is thetamper-evident record (C3); job health derives from the run
ledger, not process belief (`GET /jobs` contract test); Sentry error
reporting and OTel tracing start from their variables when set — unset
means off, and delivery is unproven without accounts behind the sinks.

### Data at rest

**F1. Read the database dump.**
Sessions and passwords resist offline attack (B1, argon2id). Everything
else — emails, countries, verification states — is cleartext. Field-level
encryption does not exist; rest-state protection is the host's disk
encryption. Accepted gap (§5), stated plainly: a dump reader learns who
is verified, not their documents (there are none) and not their funds
(no keys).

**F2. Abuse push notification tokens.**
`Device.pushToken` is stored and never used — BE-1201 sends nothing, so
there is no sender to spoof through. When a transport lands, token
handling needs its own review; until then the column is inert.

---

## 4. What the model assumes (and breaks if wrong)

- The device holds keys and signs; the server never sees them. Breaks
  the whole left column if the client ever uploads one.
- Persona verifies humans and reports honestly; our code distrusts its
  transport (HMAC), its timing (staleness), its duplicates (idempotency)
  and its availability (fail-closed) — but not its verdicts. A
  compromised vendor clearing its own hits is outside this model.
- Clocks are roughly right. TTLs, grace windows, replay tolerance and
  confirmation math all assume it; NTP is infrastructure, not code.
- One live inquiry per user and vendor-unique inquiry ids (the binding
  fallback depends on both).

---

## 5. Accepted gaps (owner: maintainer)

| Gap | Why accepted | What would close it |
|---|---|---|
| No password reset | No email infra (BE-1201 sends nothing); a reset link has nowhere to go | BE-1201 transport + reset flow with single-use tokens |
| 30-day bearer sessions | Revocation + httpOnly mitigate; shorter TTL is one constant | Usage data or a policy call; the knob exists |
| Field-level DB encryption | Host disk encryption; highest-value fields already one-way | Per-field encryption for email/country if regulation demands |
| CSRF posture | Depends on admin/API deployment topology, still undecided | Same-origin decision + token/origin check if cross-origin |
| SAST tooling | Type-aware lint + four static guards run; no scanner configured | A scanner that stays green (see BE-1703's warning about crying wolf) |
| Auth fuzzing / rate-limit bypass | Role suites + bucketing tests cover the designed surface | Adversarial suites when the surface stabilises |
| Webhook proof against live bytes | No public receiver URL exists to collect one | Deploy + capture a real delivery |
| Push token handling | Column inert until a transport exists | Review with BE-1201's transport |

---

## 6. Keeping this document true

This file rots like every status table before it. Two rules slow that:

1. Every mitigation names code and tests. A mitigation that cannot name
   both belongs in §5, not §3.
2. New features that move value, gate access, or store identity data
   must add their abuse case here or state why not in the commit. The
   reviewer asks "where is the §3 line?" the way CI asks for the test.
