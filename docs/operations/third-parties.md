# Third-party and external-provider registry

**Purpose:** every outside dependency production needs, why it is needed,
what breaks without it, and what it touches in code — so procurement can
start in lead-time order instead of discovering vendors at integration
time. Researched 2026-10-10 against the tree (env registry, provider
model, pricing, RPC, swaps, onramp, notifications, infra docs).

**The rule this file must never contradict:** no third party ever holds,
sees, or moves user keys. The key boundary (`docs/architecture/key-boundary.md`)
is not a vendor policy — vendors listed here get addresses, emails and
order flow as their business requires, and never anything that signs.

**Status legend:** `decided` (chosen, integrating/integrated) ·
`named` (category known, vendor not chosen) · `open` (not yet decided).

---

## 1. Required vendors (production does not work without these)

### 1.1 Chain node access — `named`, register now
- **Why:** every balance read, gas estimate, nonce lookup, log scan,
  transaction relay and confirmation count is an RPC call. No node, no
  product — the API refuses (`No RPC endpoint is configured`, a
  deployment gap, not a client error).
- **What it touches:** `Chain.rpcUrls` in Postgres, read by
  `BlockchainService.forChain` into a failover `RpcPool` (quarantine +
  retry across endpoints; no single provider is authoritative by design).
  Chains in scope: Ethereum (1), Base (8453); Sepolia (11155111) for
  pre-production.
- **Options:** (a) managed vendor — Alchemy, Infura, QuickNode and kin,
  one account can serve all three chains; (b) self-hosted (Geth/Reth/Erigon
  + Base supervisor). The pool already supports mixing both.
- **Recommendation:** vendor first for time-to-production, self-hosted as
  the independence milestone. Two reasons beyond ops burden: a vendor sees
  every address our backend looks up (query-pattern privacy), and metered
  quotas are a cost line that grows with users while a node is flat.
- **Gap found while researching:** `RPC_ETHEREUM_MAINNET` etc. exist in
  `.env.example` but **nothing reads them** — seed writes `rpcUrls: []`
  and no route manages them. Wire (seed fills when empty, or an admin
  route) or remove; an env var nothing reads is a promise to no one.
- **Lead time:** account signup is same-day; self-hosted sync is days to
  a week per chain. Start the account now; plan the node for later.
- **Status 2026-10-12:** accounts exist (Alchemy + Infura). Ethereum mainnet
  wired as failover pair (Alchemy first) and verified live: both answer the
  same head, pool health reports Ethereum healthy, chain reads leak no URLs.
  Still needed: Base + Sepolia endpoints (same keys may cover them — confirm
  in each dashboard rather than guessing URLs).

### 1.2 Identity verification + sanctions screening — `decided` (Persona)
- **Why:** selling gold for dollars triggers AML/sanctions obligations
  regardless of custody posture. The fiat gate denies without it.
- **What it touches:** `ScreeningProvider` port, `KycService`,
  `ComplianceGate`, `POST /compliance/webhooks/persona`,
  `compliance.rescreen-stale`. PII never touches our servers; only
  inquiry ids and decision codes cross the boundary.
- **Still needed:** sandbox credentials exist; production credentials,
  production template, and a public receiver URL for live webhooks.
- **Lead time:** contract + production approval; start as soon as sandbox
  verification closes.

### 1.3 Metals issuer / liquidity provider — `open`, longest lead time
- **Why:** the gold itself. Someone must issue or redeem the tokens
  (PAXG/XAUT/KAU or equivalent), publish attestations, and settle
  physical redemption. No issuer relationship, no product — everything
  else is rails to an empty station.
- **What it touches:** `Provider` rows (`category: metals`), `Asset.issuer`
  + backing disclosure (custodian, vaults, proof-of-reserve URL,
  cadence), manual attestation recording (`PATCH
  /assets/:assetId/attestation`), redemption provider mechanics. Seed
  carries `placeholder-metals` (disabled) as an explicit refusal to
  invent one.
- **Note:** prior Kinesis/PAXG/XAUT specifics were researched under
  degraded conditions and are unverified (tracker blockers table) — treat
  them as leads, not diligence.
- **Lead time:** multi-month (contract, diligence, counsel review).
  **This is the critical path. Start it first.**

### 1.4 Fiat on-ramp / off-ramp — `open`
- **Why:** card/bank → crypto and back. `OnRampService` picks a provider
  and refuses without one; quote and execution both need it.
- **What it touches:** `Provider` rows (`category: onramp/offramp`),
  `OnRampService.activeProvider`, future execution endpoint. Seed
  carries `placeholder-onramp` (disabled). Note the service comment:
  a licensed provider runs the KYC on its own flow — ours gates
  independently regardless.
- **Lead time:** commercial negotiation, typically weeks.

### 1.5 Price data — `open`, two sources not one
- **Why:** every portfolio value, fee notional and swap quote needs a
  reference price younger than 300s (`PricingService.MAX_AGE_SECONDS`).
  Today the table fills only by hand (`POST /pricing/record`); without a
  feed the portfolio reads everything as unpriced.
- **What it touches:** `AssetPrice` rows via a feed job to be built
  (BE-502), consumed through `latestMap` (fresh-only map: stale prices
  never leak into valuation).
- **Recommended shape:** (a) **on-chain oracle as primary** — Chainlink
  XAU/USD (and XAG/USD) feeds are readable through our own node: no API
  vendor, no key, no extra trust beyond the chain itself. Verify feed
  addresses at integration time; never hardcode from memory. (b) **A
  market-data vendor as fallback/cross-check** (Metals-API, GoldAPI,
  Xignite, OANDA or equivalent) for staleness detection and non-chain
  hours. Either alone is a single point of truth for money math; together
  they check each other.
- **Lead time:** oracle integration is engineering (node access suffices);
  vendor account is same-day signup.

### 1.6 Email delivery — `open`, blocks two features
- **Why:** magic-link sign-in (BE-203, the design spec's target UX —
  `User.passwordDigest` is nullable specifically for it) and password
  reset (no reset flow exists today; a forgotten password is permanent
  lockout) both need an email transport. `notifications` also needs it
  once ADR-020 picks a transport.
- **What it touches:** `NotificationsService` + `claimBatch` lease
  (DEF-009: needs a column, a lease with timeout, a requeue path) +
  future auth endpoints.
- **Options:** SES, Postmark, Resend or equivalent. Transactional-only;
  no marketing mail exists to complicate this.
- **Lead time:** same-day signup; domain warmup (SPF/DKIM/DMARC) takes
  days — register the sending domain early even before choosing.

### 1.7 Push delivery (when notifications get a transport) — `open`
- **Why:** `Device.pushToken` is already stored. FCM (Android) and APNs
  (iOS) are free but need accounts, keys and review.
- **Lead time:** Apple Developer enrollment involves identity verification
  (days); do it with the app-store accounts below, not after.

---

## 2. Infrastructure vendors (needed, mostly decided in shape)

| Need | Shape already chosen | Still open |
|---|---|---|
| Postgres | **Neon** (named in `infrastructure/docker/compose.yml` comments) | Account + project + backup/retention policy (§8 of operations overview: rotation vs live sessions) |
| Redis | Managed Redis (cache + queue, never source of truth) | Provider choice (Upstash/Memorystore/ElastiCache follow the hosting decision) |
| API hosting | **Nothing decided** (operations overview §1) | Platform (Fly/Render/AWS/…), secret store satisfying the no-`.env` rule, TLS termination (`TRUST_PROXY` exists for it) |
| Admin/marketing hosting | Undecided (Vercel-class platforms fit Next.js) | Same platform call as above, or split |
| Domain + DNS + TLS | — | Registrar, sending subdomain for §1.6 |
| Error/tracing backends | Wired, optional | Sentry project + OTel collector to prove delivery (code proves init, not receipt) |
| CI | GitHub Actions (exists, 9 guards) | Nothing — no vendor action |
| App stores | — | **Apple Developer + Google Play accounts now**: enrollment identity checks and first-review lead times are measured in days-to-weeks, and they gate nothing until the client exists, which is exactly why they should start early |

---

## 3. What needs NO third party (ours outright)

- **Keys, signing, derivation** — `wallet-core`, no network deps by CI
  enforcement. Never vendor-touchable by architecture, not by policy.
- **Chain reads/writes given node access** — indexing, balances, gas
  estimation, nonces, log scans, relays, confirmation counting. A node
  (ours or rented) is infrastructure, not a data vendor: it answers with
  public chain state.
- **DEX execution plumbing** — a swap is a transaction to a router
  contract assembled server-side (like ERC-20 calldata today) and signed
  on-device. On-chain price discovery needs only the node. What a vendor
  (0x/1inch-style aggregator) would buy is routing quality and
  maintenance, not capability. Decision, not dependency.
- **Fees math** — network fee from the chain, provider fee from provider
  quotes, ours from `FeeRule` rows. No fee vendor exists or is needed.
- **Auth/sessions/audit/jobs/rate-limiting/KYC machinery** — all built.
  (Persona provides verdicts, not machinery.)
- **Attestation *recording*** — operator-recorded URLs plus verification
  workflow. The auditor is external (issuer's), the ledger is ours.

## 4. The client-side node question

The mobile and web apps contain **no chain code today**, and they may
never need direct node access: every balance, price, quote and history
read already has an API route, and signed payloads relay through
`POST /transactions/:id/broadcast` — the server's node, not the
client's. Self-custody of keys does **not** imply self-supply of node.

- **Recommended:** clients talk only to our API (backend-proxy). One
  quota to manage, no keys shipped in apps, no per-client provider
  config — and the vendor never sees per-user query patterns from
  devices, only our aggregated backend traffic.
- **Alternative:** ship a client-side provider key (Infura/Alchemy in
  the app). Keys extract from apps, quotas get abused, and every
  address lookup leaks to the vendor per-device. Only if
  decentralisation demands it.
- Either way this is an architecture decision to record, not a vendor
  to register — except that backend-proxy concentrates load on §1.1,
  which is another reason to size node access generously.

## 5. Registration order (lead time first)

1. **Metals issuer/LP engagement** — multi-month; the critical path. (User track)
2. **Legal counsel** (entity, money-transmitter, CFTC-vs-SEC) — answers reshape the buy flow and client. (User track)
3. **Apple Developer + Google Play** — enrollment waits for no code. (User track, today)
4. **Sending domain + DNS** — warmup takes days; needed for §1.6 whenever it lands. (User track, today)
5. **RPC vendor account** (Ethereum + Base; keep Sepolia on any free tier) — same-day, unblocks all verification runs. (User track, now)
6. **Price-feed vendor** (fallback leg only; oracle leg is engineering) — same-day. (User track, soon)
7. **Onramp vendor** — weeks of commercial work; start when counsel confirms the flow needs no reshaping. (User track)
8. **Persona production** — after sandbox closes. (User track)
9. **Email vendor** — when BE-203/transport is scheduled. (Later)
10. **Neon/Redis/hosting/Sentry** — with the deployment decision. (Later)

## 6. Open decisions that change the list above

- Hosting + deployment platform (operations overview §1) — cascades to Redis, secrets, TLS, and whether proxy-per-client holds.
- ADR-020 transport (email/push vendor selection + claim lease).
- ADR-021 scopes (extra chains multiply §1.1 endpoints; Web3 changes client needs).
- ADR-022 build-time choices (bundler/paymaster are new vendor-ish integrations with their own RPC URLs — `BUNDLER_RPC_URL`/`PAYMASTER_RPC_URL` already reserved in env).
- Whether the oracle-primary pricing shape is accepted (needs no vendor, but needs explicit sign-off since it makes Chainlink load-bearing for money math).
