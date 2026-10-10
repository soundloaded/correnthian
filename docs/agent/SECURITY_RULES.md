# SECURITY_RULES

The rules an agent must not break, and how each one is enforced in code rather
than in good intentions.

Verified against the repository at `2be6499`. Longer treatment in
[`../architecture/key-boundary.md`](../architecture/key-boundary.md) and
[`../compliance/overview.md`](../compliance/overview.md).

---

## 1. The key boundary

```
private key / seed ──► user device ──► local signing ──► signed tx ──► network
        │
        └─ never crosses to Correnthian's servers. Ever.
```

Not "we do not currently send it". Not "we redact it in transit". **Never.**
No Correnthian-operated service may accept, store, log, transform, escrow or
transmit key material. There is no exception for a feature, a recovery flow, a
support workflow, an analytics pipeline or a debugging tool.

**The checkable formulation: a Correnthian server must be incapable of moving a
user's funds.**

### How it is enforced

| Mechanism | Where |
|---|---|
| `packages/wallet-core` declares one dependency: `@correnthian/types` | `packages/wallet-core/package.json` |
| Transitive closure walked and forbidden packages rejected | `scripts/check-key-boundary.mjs` |
| CI job | `.github/workflows/ci.yml`, job `key-boundary` |
| Schema-level invariant, stated at the top of the file | `services/api/prisma/schema.prisma` |
| Service-level invariant, stated at the top of the file | `services/api/src/wallets/wallets.service.ts` |

The guard's denylist: `axios`, `node-fetch`, `got`, `superagent`, `undici`,
`ws`; `@metamask/sdk`, `viem`, `ethers`, `@solana/web3.js`, `bitcoinjs-lib`,
`tronweb`, `@walletconnect/*`; `react`, `react-dom`, `react-native`, `next`,
`expo`, `react-native-keychain`, `expo-secure-store`; `@nestjs/*`, `express`,
`fastify`. Allowed workspace deps: `@correnthian/types` only.

It was verified in both directions before being trusted — it fails on an
injected `axios` and passes once removed.

### What the boundary buys

A full compromise of Correnthian's infrastructure yields: read balances,
addresses, holdings, transaction history; change preferences and display name;
revoke sessions and devices; serve wrong prices, wrong disclosures, wrong
asset metadata; refuse service; read KYC and compliance records.

It does **not** yield: any signature over a user transaction; derivation or
recovery of a private key; restoration of a revoked passkey; movement of funds.

### Note on current implementation status

`packages/wallet-core` declares `Signer`, `KeyContainer`,
`SmartAccountManager` and `SeedAccountManager` as **interfaces**. There is no
implementation of any of them. The boundary is currently upheld by absence. The
moment the first device-side key container is written, the boundary has real
code on one side of it and the guard becomes load-bearing rather than
belt-and-braces.

---

## 2. Two things share the word "account"

Conflating them is a security bug, not a naming preference.

| | **Correnthian Account** | **Key Container** |
|---|---|---|
| Where | Postgres: `User`, `Session`, `Device` | `packages/wallet-core`, device-side |
| Holds key material | **Never** | Yes |
| Domain types | `CorrenthianAccount` | `KeyContainer`, `SmartAccountManager`, `SeedAccountManager` |
| Kinds | one | `SmartAccount` (EVM, passkey) and `SeedAccount` (BTC/SOL) |

**Do not merge them.** They are separate types with separate managers
precisely so that "which recovery model protects this holding" is answerable
without inspecting the chain.

### The rule that follows

**Compromising a Correnthian Account must never yield funds.** Concretely: no
account field may be sufficient to produce a signature, and no session may be
sufficient to move funds. A session authenticates *requests*; the signature that
moves funds is produced on the device.

---

## 3. Deny by default — authentication

`services/api/src/common/core.module.ts` registers `SessionGuard` globally.
A route requires a session **unless** it is explicitly `@Public()`.

Fail-closed by construction: a forgotten decorator denies rather than allows.

### The only `@Public()` routes

| Route | Why |
|---|---|
| `POST /auth/register`, `POST /auth/login` | Obviously. |
| `GET /health/live`, `GET /health/ready` | Probes. |
| `GET /compliance/eligibility` | Asked before signing in. |
| `GET /onramp/availability` | Availability check before signing in. |

**This list has grown by accident twice.** `/compliance/eligibility` and
`/onramp/availability` were both missing `@Public()` and were fixed in separate
commits. Two misses of the same class is a pattern: **a test that asserts a
route's authentication requirement is worth more than the decorator.** Tracked
under `BE-1702`.

### Session handling

- Tokens are 32 random bytes, base64url.
- Only the **SHA-256 digest** is stored. A database compromise does not hand an
  attacker live sessions.
- Expired, revoked and unknown tokens are **indistinguishable** — all produce
  `unauthorized('Invalid or expired session')`.
- `userAgent` truncated to 512 characters.

### Account enumeration

- Registration of an existing address returns a generic conflict: "Unable to
  create account with those details."
- Login runs a dummy argon2 verification on the miss path so a missing account
  and a wrong password take comparable time.
- Wallet registration does not confirm that an address is already registered.
- The admin login form does not confirm which addresses exist.

**Keep it that way.** Any new endpoint that takes an identifier must not become
an oracle for whether it exists.

### Role hierarchy

`user < support < compliance < admin < owner`, in `RolesGuard`. A role
satisfies a requirement if it is equal or higher. Unknown actual role ranks
`-1`; unknown requirement ranks `Infinity` — so an unknown requirement is
unsatisfiable. Fail-closed by construction.

Notable role gates: `compliance` for issuer verification, asset creation,
attestation, audit read and redemption transitions. `admin` for role and status
mutation, asset enable, chain enable, provider status.

---

## 4. Deny by default — jurisdiction

`services/api/src/compliance/jurisdiction.service.ts`.

**A location with no matching active `JurisdictionRule` is denied, not permitted
by omission.** For a regulated financial product, unknown jurisdiction means
stop and ask. The inversion is the whole point of the module.

- A missing or non-two-character country denies immediately.
- Region rules take precedence over country-wide rules (`region: ''`).
- An inactive rule is treated as no rule.
- `assertEligible` **throws** 451 rather than returning `false`. A blocked
  jurisdiction is a refusal with a reason, not a silent no-op a caller may
  ignore.
- Redemption is gated more strictly than a crypto swap, because selling
  physical metal is licensed activity in many US states.
- A jurisdiction rule can block specific providers by slug.

**The development seed creates one `US` rule marked `DEVELOPMENT ONLY`** that
permits buy, sell and metals and refuses redemption. It must be replaced with
counsel-reviewed rules before any deployment. It is not a legal position.

### Compliance is load-bearing in v1

Not deferred. Selling gold to consumers with dollars triggers AML and sanctions
obligations **regardless of custody posture**, and offering physical delivery
may make Correnthian a precious-metals dealer, separately licensed in many US
states.

**None of this is implemented.** `KycProfile` exists as a model and is never
written. There is no KYC flow, no sanctions screening, no risk engine. See
`BE-1101` and `BE-1105`.

---

## 5. Fail closed — rate limiting

`services/api/src/common/guards/rate-limit.guard.ts`.

Redis `INCR` + `EXPIRE` on a 60-second fixed window, keyed
`correnthian:rate:<bucket>:<actor>`.

| Bucket | Limit |
|---|---|
| `/auth/*` | 10 per minute |
| everything else | 120 per minute |

**On any Redis error the request is rejected with 429.** Not allowed through.
An API that stops limiting when its cache is unavailable has invited exactly the
traffic the limit exists to shed, and silently failing open is the more dangerous
default of the two.

Verified live before it was committed: 10×401 then 429, correct headers, and
429 with Redis stopped.

`@SkipRateLimit()` opts a route out. `HealthController` is the only user.

**Two properties, both now real** (closed in `8c48624`; both were `DEF-004`
and `DEF-005`):

- **Every limit comes from configuration.** `RATE_LIMIT_WINDOW_SECONDS`,
  `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_AUTH_MAX_REQUESTS` are validated at
  boot and read by the guard. The sign-in ceiling is a separate setting rather
  than a fraction of the general one, so raising a bulk-import budget cannot
  quietly widen the budget credential stuffing runs against.
- **The budget is keyed on the session.** `correnthian:rate:<bucket>:session:
  <sha256(bearer)>`, which is byte-for-byte `Session.tokenHash`, falling back to
  `correnthian:rate:<bucket>:ip:<address>` when there is no token.

**Why the limiter reads the header instead of waiting for `SessionGuard`.**
Reordering is the obvious fix and does not work: `SessionGuard` returns early on
`@Public()` routes, and `POST /auth/login` must be public — you cannot require a
session in order to obtain one. Reordering would fix only routes that never
needed it and leave credential stuffing bucketed by IP, which is the route with
the tightest budget precisely because it has no session.

**This does not make the limiter a session or account control.** The unit is
the session, not the account: one account holding N sessions holds N budgets.
Session creation goes through authenticated flows, so the amplification is
bounded and not reachable by an unauthenticated client. Per-IP remains the
fallback for every unauthenticated route other than sign-in, where the address
is the only identity that exists.

---

## 6. Disclosure rules — the product claim

The sentence Correnthian exists to produce is *what am I holding, who backs it,
and can I take it out*. Three rules protect it.

### Never present a synthetic token as metal

`describeBacking()` in `packages/assets/src/index.ts`:

- `synthetic` → "Price exposure only. No physical metal is held for this token."
- `unallocated` → "Backed in aggregate. No specific metal is reserved for the
  holder."
- `allocated` → custodian, vault locations, per-token grams or ounces, and the
  last attestation date — or "never attested".

Covered by `packages/assets/src/__tests__/registry.test.ts`.

### Every asset response carries its disclosure

`AssetsService.list` and `findByAssetId` attach `disclosure` to every asset. An
asset without one is a bug: the UI must never be able to render a token as metal
without saying what it is. The API falls back to "Backing information
unavailable." rather than returning an empty string.

### Render it verbatim in the admin

`apps/admin/src/app/(dashboard)/assets/page.tsx` renders `row.disclosure` as
returned. It is never recomputed, summarised, truncated or reformatted
client-side. `synthetic — not metal` and `never attested` are **badges**, not
grey text — grey is how a serious disclosure disappears.

An operator seeing a different disclosure string from a customer would make the
claim uncheckable, which is the one thing the claim cannot survive.

---

## 7. What must never be stored

| Never | Where the rule lives |
|---|---|
| Seed phrases, private keys, signing shares | `services/api/prisma/schema.prisma` invariant; `.env.example` header; CI `credential-scan` |
| In any `.env*` file | CI greps `*.env*` for assignments to `PRIVATE_KEY`, `MNEMONIC` or `SEED_PHRASE` |
| Identity documents or biometric data | `KycProfile` stores `providerRef`, an opaque pointer, and nothing else |
| Provider API credentials in the database | `Provider` has no credential field. Only a health-probe payload. |
| Chain RPC URLs in any API response | `ChainsService` and `BlockchainService` select explicit field lists that omit `rpcUrls` |
| Signed payloads in logs | A signature is not key material, so `redactDeep` will not catch it — but a logged signed transaction is a replayable authorisation if the nonce is unconsumed |
| Secrets in audit metadata | `AuditService.record` calls `redactDeep()` **on write** |

### Redaction

`packages/security/src/index.ts`:

- `redact()` — BIP-39-style mnemonics, 32-byte hex keys, bech32 Bitcoin
  addresses.
- `redactDeep()` — recurses through objects and arrays, and replaces any value
  under a key matching `/seed|mnemonic|privatekey|secret|password|passphrase/i`.
- `log.info/warn/error` — all three redact.

Second line of defence: `nestjs-pino` redacts `req.headers.authorization`,
`req.headers.cookie`, `password` and `*.password` at the transport layer.
Confirmed against a real 500 trace — the client received
`{"code":"internal","message":"Internal server error"}` and the log held the full
stack with the token replaced.

---

## 8. Information disclosure

- **Internal detail never crosses the HTTP boundary.** `AllExceptionsFilter`
  maps everything to a taxonomy and forwards only `code`, `message` and a
  `detail` that is explicitly safe. Prisma constraint errors become 409/404/422
  with generic messages rather than leaking constraint names and column values.
- **Error codes are stable and machine-readable.** Clients branch on `code`,
  never on the message. `jurisdiction_blocked` is its own code with 451, so the
  UI can say the right thing rather than showing a validation error.
- **Status 500 responses log a redacted stack server-side** and tell the client
  nothing.
- **Admin surfaces say what they could not read.** `dashboard/page.tsx` names
  the checks that failed instead of rendering an all-clear after a partial
  failure. A partial read is not a clear.
- **Independence of concerns in the admin's failure vocabulary.** `apiFetch`
  distinguishes `ok`, `unauthorised`, `forbidden`, `unavailable` and `error`, and
  maps 451 to a jurisdiction explanation. Collapsing these into one "failed"
  state is how an admin shows a login screen during an outage and locks
  everyone out.

---

## 9. Audit

- Every mutating HTTP request is recorded **by construction** via
  `AuditInterceptor`, not by a `record()` call per service method that would be
  forgotten when the next endpoint is added. (ADR-012)
- `/auth/*` is skipped because `AuthService` records sign-in attempts itself,
  where it knows whether the attempt succeeded. Recording them in the
  interceptor would log a failure for every successful sign-in, which trains
  operators to ignore the trail.
- Metadata is redacted **on write**. An audit log is the one place a stray secret
  survives, because it is written deliberately rather than by accident.
- Write failures are swallowed deliberately: losing an audit line is bad;
  refusing a user's withdrawal because logging failed is worse.
- The list projection is explicit and withholds `metadata`; metadata is read one
  entry at a time through `GET /audit/:id`.
- `GET /audit` is `compliance`-gated. Reading the trail is privileged.

**Not yet implemented:** the audit trail is append-only by convention — no
database-level constraint prevents an `UPDATE` or `DELETE` on `AuditLog`. If
that matters, it needs a trigger or a restricted role.

---

## 10. Nine ways to break the boundary

From `docs/architecture/key-boundary.md`. Any of these is a break regardless of
intent.

1. An HTTP client, RPC endpoint or provider SDK in `wallet-core`'s dependency
   graph. The canonical break.
2. A server-side backup, restore or recovery-key service. That is custody.
3. A support tool that can view or request a signature. Read-only support
   tooling is fine.
4. A phishing-shaped recovery flow — any surface asking a user to paste a seed
   phrase, even our own page, even if it works.
5. Session keys minted server-side with scopes broader than the user's intent.
6. A gas paymaster that can *cause* a transaction rather than only sponsor one.
   It must be able to pay for a user-signed operation and be structurally unable
   to originate one.
7. CEX routing. `CexRail` is reserved and marked "probably never".
8. Logging a signed payload.
9. An admin capability that can move user funds. Admins operate the platform;
   they do not operate users' wallets.

---

## 11. Unresolved

These are open security questions, not gaps this document can close.

1. **Seed accounts have no recovery path.** Guardians live in a smart-account
   contract; Bitcoin and Solana have no equivalent. Four options are laid out;
   none is chosen. Decide before any BTC/SOL work.
2. **The session-key model is undefined** — scope, lifetime, revocation, and
   whether one can be minted without a fresh device signature.
3. **Pre-deployment of smart accounts.** Addresses are CREATE2-derived and
   `deployed: false`. Who pays the deploy, and can a provider deliver tokens to
   an undeployed address safely? A live question for the unsigned partner.
4. **Guardian selection.** Suggesting guardians edges toward Correnthian
   influencing recovery; suggesting nothing means most users pick badly. Needs
   a product and a compliance answer.
5. **No incident runbook for a boundary breach.** `docs/runbooks/` is listed in
   the docs index and does not exist.
6. **The audit log is not protected at the database level.**
7. **There is no formal threat model** beyond the key boundary. No analysis of
   account takeover, session theft, admin compromise, provider credential
   leakage or supply chain. `SEC-001` is `PARTIAL` for this reason.
8. **All of this is untested.** There is no test that a `user` role cannot
   reach an admin route, no authorisation fuzzing, and no rate-limit bypass
   testing. The controls are real; their resistance to attack is unmeasured.