# Correnthian — build status for stakeholders (updated 2026-10-11)

*Plain-language record, task by task, from scaffold to today. Posted to Slack in parts; this file is the source of truth for the next update.*

---

## AREA 1 — API (backend) — status: IN PROGRESS, backend largely complete

*Stack: NestJS 12, TypeScript, Prisma 7 + PostgreSQL 17, Redis 7, viem (chain access), Zod (validation), vitest (800+ tests).*
*Approach: modular monolith. Server assembles transactions, the user device signs, server verifies. Deny-by-default everywhere. Money math is exact integers, never floats.*

- ✅ Task 1: scaffolded the monorepo (pnpm + turbo, Node 22)
- ✅ Task 2: built the data layer, identity (register/login/sessions) and asset registry
- ✅ Task 3: added chains, providers, audit trail, swaps and jurisdiction rules
- ✅ Task 4: ran the API against a real database, fixed what that exposed
- ✅ Task 5: added metals, notifications and fiat on-ramp modules
- ✅ Task 6: added issuers, wallets, pricing, portfolio and rate limiting
- ✅ Task 7: built the transaction lifecycle engine (created → signed → broadcast → confirmed, with failure paths)
- ✅ Task 8: versioned the API under /api/v1; made money-moving POSTs idempotent
- ✅ Task 9: built the fees engine (itemised fees, no more $0 guesses)
- ✅ Task 10: added scheduled jobs (indexing, re-screening, expiry sweeps, health probes)
- ✅ Task 11: built chain indexing (balances, transfers, confirmations, drop detection)
- ✅ Task 12: built KYC + sanctions screening (Persona), review queue, fiat gates that fail closed
- ✅ Task 13: wired RPC config into seeding; pinned every route in the contract registry (98 routes, 99 keys)
- ✅ Task 14: controller + service test suites across all modules (two real bugs found and fixed: empty price history, BigInt crash)
- ✅ Task 15: fixed the two leaks the work exposed (endpoint URLs in sync errors, unscoped detail reads)
- ⬜ NOT STARTED: live KYC verification re-run (waiting on a completed verification flow)
- ✅ Task (acceptance, reads): RPC wired (Alchemy + Infura), pool green, Sepolia sync + assemble proven live
- ✅ Task (acceptance, broadcast): session wallet funded, dust sent + confirmed live (pending 3/12); relay-submit path still unit-only
- ⬜ NOT STARTED: relay endpoint submitting a device-signed payload (needs raw-signing path)
- ⬜ NOT STARTED: risk-scoring rules (waiting on thresholds paragraph)
- ⬜ NOT STARTED: client-side jurisdiction gate (waiting on clients existing)
- ⬜ NOT STARTED: price-feed job, metals-buy endpoint, on-ramp execution, mail/push transport (each waiting on its vendor)

## AREA 2 — ADMIN console (operations) — status: IN PROGRESS, all planned pages live

*Stack: Next.js 16, shadcn/ui, Tailwind v4, types inferred from the API contract registry.*
*Approach: server-rendered pages reading real API data (no mocks); role-gated actions, every change needs a written reason.*

- ✅ Task 1: scaffolded the app, dashboard shell + sidebar
- ✅ Task 2: built users, devices, chains, providers pages on real data
- ✅ Task 3: built dashboard, assets, issuers pages
- ✅ Task 4: built quotes and audit pages (including endpoints they were missing)
- ✅ Task 5: gated the console by role (customer/support/compliance/admin/owner)
- ✅ Task 6: built fees page (rule table, conflict alerts, owner-only writes)
- ✅ Task 7: built jobs page (health board, confirm-gated manual runs)
- ✅ Task 8: built redemptions page (including the list endpoint it needed)
- ✅ Task 9: built reviews page (approve/reject with reasons, end-to-end verified)
- ✅ Task 10: built transactions page + detail view
- ✅ Task 11: built notifications page (reads only — no send button until a transport exists)
- ✅ Task 12: built jurisdictions page (rules table, reason-gated flag editors, dev-rules warning)
- ✅ Task 13: hardened jurisdiction writes (reason gates before any write; mid-flight deletes answer 404)
- ⬜ NOT STARTED: nothing else outstanding — next admin work follows future API additions

## AREA 3 — WEB wallet — status: NOT STARTED

*Stack (planned): Next.js PWA. Approach: talks only to our API (no chain code in the app); shows fee breakdown before the user signs.*
- ⬜ NOT STARTED: portfolio, receive, send, buy, history screens
- ⬜ Gate: API is frozen; waiting on legal answers for the buy flow before building

## AREA 4 — MOBILE app — status: NOT STARTED (scaffold only)

*Stack (planned): Expo (Android + iOS). Approach: mirrors web; keys in SecureStore; fingerprint/PIN locks the UI, never the keys.*
- ⬜ NOT STARTED: everything past the Expo scaffold
- ⬜ Gate: same as web, plus store accounts (Apple Developer + Google Play) — enrollment takes days, should start now

## AREA 5 — MARKETING site — status: FIRST PAGE LIVE (pre-launch landing)

*Stack: Next.js 16, Tailwind, system fonts. Approach: static page, no backend calls, copy-honest (nothing live promised).*
- ✅ Task 1: landing page live — hero, trust trio, how-it-will-work, fees honesty, FAQ, browser-only notify-me
- ⬜ NOT STARTED: launch-announcement updates, deeper pages (follow later work)

---

## CROSS-CUTTING

**Features live today:** accounts & sessions, wallet registry, swap quotes, redemption requests, KYC/sanctions screening with fiat gates, fee previews + rule table, price recording, portfolio valuation + charts, 9 scheduled jobs, notification queue, full audit trail, idempotent money endpoints, versioned API.

**Security:** private keys never leave the user device (structurally enforced — the signing package cannot import any network code); no key material in config files (CI-scanned); secrets redacted in logs; five roles with tested gates; published threat model; dependency + secret scanning in CI.

**Tools & utilities:** pnpm/turbo monorepo; vitest suites per module; contract registry (client types can't drift); keyset pagination on every list; job framework with distributed leases; explicit dependency injection check.

**Providers / third parties:** Persona for identity checks (chosen, sandbox live) · chain-node RPC vendor (NEEDED NOW — blocks live verification) · metals issuer (IN DISCUSSION: XAUT via existing account, diligence pack issued; $100k minimum makes direct redemption wholesale-only — aggregation question + counsel pending) · fiat on-ramp (open) · price feed (open) · email + push delivery (open) · database/hosting/error-tracking (shapes chosen, accounts open).

**CI/CD:** GitHub Actions with 9 automated guards (tests, types, contracts, injection style, dependencies, secrets, key boundary, DB-write guard, tracker counts). Hosting platform undecided.

**Custody (no vendor by design — nobody holds user funds):** guardian rotation built; attestation freshness sweep built; recovery options and smart-account deployment waiting on recorded decisions.
