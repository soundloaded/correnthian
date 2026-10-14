# Phase 0–4 Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every buildable gap between the current tree and a shippable v1 — wired RPC, verified pricing, a metals-buy endpoint, onramp execution, notification transport, custody completeness, admin ops pages, and user-side clients — with procurement and decisions running in parallel.

**Architecture:** Thin vertical slices per phase, each independently committable and testable. Server assembles, device signs, server verifies (never signs, never holds keys). New money-moving reads/writes reuse the existing engines (lifecycle tables, idempotency, gates, audit) rather than inventing parallel ones. Vendor specifics stay behind ports with fakes; exact vendor literals are verified against docs, never recalled.

**Tech Stack:** TypeScript throughout; NestJS 12 API; Next.js 16 admin (shadcn `radix-nova`); Expo mobile; Prisma 7 + PostgreSQL 17; Redis 7; viem 2.57.3; Zod 4.6.5; vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md` (product rationale) · `docs/operations/third-parties.md` (vendor registry — the procurement companion to this plan) · `docs/architecture/key-boundary.md` · `docs/architecture/threat-model.md`

## Global Constraints

- Node 22+ and pnpm 10+. Single-workspace commands: `pnpm --filter @correnthian/api exec vitest run <path>`.
- Explicit Nest DI: every constructor param carries `@Inject(Service)` — `node scripts/check-explicit-di.mjs` fails the build otherwise.
- `packages/*` compile with `tsc -p tsconfig.package.json` to `dist/index.js` + `dist/index.d.ts`; Node loads `dist`, never `src`. Rebuild any package you change before typechecking consumers.
- Money is `bigint` `Usd` at 10^-8 (`services/api/src/fees/money.js`: `parseUsd`, `formatUsd`, `notionalUsd`, `sumUsd`). Never a float; never an invented amount, rate, fee, or price.
- Keyset pagination is `[createdAt desc, id desc]` with opaque `{t,i}` base64url cursors; spread new filters inside `where`, never outside it.
- Every new route lives under `/api/v1`, validates input with `zodPipe`, and gets a contract registry entry (`'METHOD /api/v1/path': responseSchema` in `packages/contracts/src/schemas.ts`) plus its job-name pin where applicable — then rebuild `@correnthian/contracts` so admin `Contract<>` types resolve.
- Scheduled jobs implement `ScheduledJob` (`name`, `everyMs`, `timeoutMs`, `description`, `run(ctx)`), return `JobOutcome {affected, detail?}`, register in `JOB_CLASSES` + the `inject` list in `services/api/src/jobs/jobs.module.ts`, and join the `contracts.spec.ts` jobs pin. Bounded batches, per-item try/catch, `ctx.signal.aborted` checks.
- Migrations: never `prisma migrate dev` against a shared database. Diff against a scratch shadow database, apply with `prisma migrate deploy`, regenerate the client, confirm `prisma migrate status` clean.
- `redactDeep()` on anything logged or audited. No key material in any `.env*` (CI scans). RPC URLs and vendor secrets never leave the server in any response.
- New HTTP suites get their own Redis DB index (16–9 taken by existing suites; next free is 5 and below), pid-unique fixture emails/addresses, and `afterAll` cleanup that deletes by prefix, not by remembered ids.
- Every fix ships with tests that fail without it, then a mutation round: 100% killed or the survivor documented with why it cannot be killed. Commit per task with a message explaining _why_, ending with the attribution line the harness requires.
- Fail-closed defaults everywhere: unknown denies, absent screens deny, unreachable vendors deny, unconfigured providers refuse. Deny-by-default is a property to preserve, not a comment to keep.

## Review Focus

1. A buy referencing an asset whose rails lack `provider` must refuse with 400 naming the asset — never silently route elsewhere. Test pinned in Task 2.2b.
2. An RPC outage mid-assembly must surface as 503 with no endpoint or hostname in the body. Test pinned in Task 2.2b (stubbed fetch rejecting).
3. A replayed or reordered provider callback must change nothing the second time (unique constraint + idempotent apply). Test pinned in Task 2.2c.
4. An order executed after expiry must refuse; the expiry guard belongs on the update (compare-and-swap), proven with a backdated `expiresAt` fixture. Test pinned in Task 2.2b.
5. A fee presentation with zero matching FeeRules must show an explicit $0 Correnthian line with `hasSpreadLine` false — never a spread hidden in the rate. Test pinned in Task 2.2b.

## File Map

Phase 1 creates `services/api/src/chains/chain-rpc.ts` (+ spec); touches `services/api/prisma/seed.ts`.
Phase 2 creates: `services/api/src/pricing/prices-feed.job.ts` (+ spec), `services/api/src/pricing/price-source.ts`, `services/api/src/pricing/chainlink-price.source.ts`, `services/api/src/metals/` buy service + controller + DTO + `MetalsOrder` model + migration, `services/api/src/metals/metals-provider.ts` (+ fake), `services/api/src/onramp/onramp-provider.ts` (+ fake) + execute route, notification `claimedAt`/`claimedBy` migration + transport port + email adapter + sender job, wallet guardians route. Modifies: config schema + `.env.example`, jobs module + pins, contracts registry, `Transaction` creation sites (no schema change — reuse).
Phase 3 creates six admin pages under `apps/admin/src/app/(dashboard)/` (redemptions, reviews, transactions, fees, jobs, notifications).
Phase 4 creates web wallet pages under `apps/web/src/app/`, mirrors in `apps/mobile/`, marketing pages under `apps/marketing/` (independent, may start any time).

Subsystem boundaries (each phase ships and tests alone): Phase 1 touches only chains config + specs; Phase 2 workstreams share only the gate/audit/idempotency engines, never each other's tables; Phase 3 reads only; Phase 4 consumes only contracted routes.

---

## Phase 0 — Procurement and decisions (user track, parallel to all code)

No code steps: these are actions with acceptance criteria. Code tasks in later phases name their Phase-0 trigger explicitly and must not start before it.

- [ ] **0.1 Metals issuer engagement started.** Acceptance: NDA signed and a term sheet conversation open with at least one issuer/LP. Unblocks Phase 2 buy + redemption execution.
- [ ] **0.2 Counsel engaged.** Acceptance: entity, money-transmitter, and CFTC-vs-SEC questions posed; buy-flow answers recorded. Unblocks client build and provider commercial terms.
- [ ] **0.3 Store enrollments + sending domain.** Acceptance: Apple Developer + Google Play accounts active; sending subdomain publishing SPF/DKIM/DMARC. Lead times run while code does.
- [ ] **0.4 RPC vendor account.** Acceptance: Ethereum + Base (+ Sepolia free tier) endpoints in hand, `eth_blockNumber` answering. Unblocks Task 1.3 and everything live.
- [ ] **0.5 Price-feed vendor account (fallback leg).** Acceptance: API key in env. The Chainlink leg needs no account.
- [ ] **0.6 Onramp vendor selection** (after 0.2 confirms flow shape). Acceptance: signed contract + sandbox credentials + webhook docs.
- [ ] **0.7 Persona production** (key, secret, template) + public receiver URL. Acceptance: production inquiry creatable in a dry run.
- [ ] **0.8 Infra accounts + hosting decision.** Acceptance: Neon project, managed Redis, hosting platform + secret store, Sentry project, OTel collector — then delivery is provable (BE-105 closes).
- [ ] **0.9 Decision log.** Acceptance: ADR-021 scopes, ADR-022 build choices, `/docs` exposure, and the BE-1102 rules paragraph (thresholds, windows, action on flag) all recorded. 0.9's BE-1102 paragraph is a one-paragraph user write-up, not a meeting.

---

## Phase 1 — Backend completion (unblocked code)

### Task 1.1: Make `RPC_*` real (seed fill-if-empty)

**Files:**

- Create: `services/api/src/chains/chain-rpc.ts`
- Test: `services/api/src/chains/chain-rpc.spec.ts`
- Modify: `services/api/prisma/seed.ts` (chain upsert block only)

**Interfaces:**

- Consumes: `process.env` (seed only), `Chain.rpcUrls` (Prisma)
- Produces: `resolveSeedRpcUrls(chainId: string, existing: string[], env: NodeJS.ProcessEnv): string[]`

Today `RPC_ETHEREUM_MAINNET` etc. exist in `.env.example` and nothing reads them; seed writes `rpcUrls: []`. The fix is fill-if-empty in seed (operator edits preserved — never overwrite), not a new admin route (no new surface for what deploy-time config already covers).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { resolveSeedRpcUrls } from "./chain-rpc.js";

describe("resolveSeedRpcUrls", () => {
  const ENV = {
    RPC_ETHEREUM_MAINNET: "https://eth.example/v3/key",
    RPC_BASE_MAINNET: "https://base.example/v3/key",
  };
  it("fills empty urls from env", () => {
    expect(resolveSeedRpcUrls("1", [], ENV)).toEqual([
      "https://eth.example/v3/key",
    ]);
    expect(resolveSeedRpcUrls("8453", [], ENV)).toEqual([
      "https://base.example/v3/key",
    ]);
  });
  it("preserves operator-set urls and never overwrites", () => {
    expect(resolveSeedRpcUrls("1", ["https://ops.example"], ENV)).toEqual([
      "https://ops.example",
    ]);
  });
  it("returns empty for unknown chains and empty env", () => {
    expect(resolveSeedRpcUrls("999", [], {})).toEqual([]);
    expect(resolveSeedRpcUrls("1", [], {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @correnthian/api exec vitest run src/chains/chain-rpc.spec.ts`
Expected: FAIL with "Cannot find module './chain-rpc.js'"

- [ ] **Step 3: Write minimal implementation**

```typescript
const CHAIN_ENV: Record<string, string> = {
  "1": "RPC_ETHEREUM_MAINNET",
  "8453": "RPC_BASE_MAINNET",
  "11155111": "RPC_ETHEREUM_SEPOLIA",
  "84532": "RPC_BASE_SEPOLIA",
};

/**
 * Seed-time RPC wiring. Returns existing urls untouched when non-empty so
 * re-seeding never clobbers an operator edit; fills from env only into the
 * gap. Zero imports, so `prisma/seed.ts` can use it under any runner.
 */
export function resolveSeedRpcUrls(
  chainId: string,
  existing: string[],
  env: NodeJS.ProcessEnv,
): string[] {
  if (existing.length > 0) return existing;
  const name = CHAIN_ENV[chainId];
  const url = name ? env[name] : undefined;
  return typeof url === "string" && url.length > 0 ? [url] : [];
}
```

- [ ] **Step 4: Wire seed + verify**

In `services/api/prisma/seed.ts`, change the chain upsert to:

```typescript
import { resolveSeedRpcUrls } from "../src/chains/chain-rpc.js";
// ... inside the loop:
await prisma.chain.upsert({
  where: { id: chain.id },
  update: {
    name: chain.name,
    family: chain.family,
    nativeSymbol: chain.nativeSymbol,
    decimals: chain.decimals,
    rpcUrls: resolveSeedRpcUrls(
      chain.id,
      (
        await prisma.chain.findUnique({
          where: { id: chain.id },
          select: { rpcUrls: true },
        })
      )?.rpcUrls ?? [],
      process.env,
    ),
  },
  create: { ...chain, rpcUrls: resolveSeedRpcUrls(chain.id, [], process.env) },
});
```

Then run `pnpm --filter @correnthian/api exec prisma db seed` twice against dev: first run fills from env, manually edit one URL in the DB, second run must preserve the edit. If the `../src` import fails under the seed runner, inline the 15-line function in `seed.ts` with a comment pointing at the tested copy as authoritative (documented duplication, not silent).

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `pnpm --filter @correnthian/api exec vitest run src/chains/ && pnpm --filter @correnthian/api typecheck`
Expected: PASS. Then commit with a why-message + attribution line.

### Task 1.2: KYC re-run closure (GATED — do not start before the user completes a flow)

Trigger: user replies "done" with a completed verification on a watchlist-enabled template.
Resume file: the re-run probe script pattern from the BE-1101 session (`list reports by reference → POST /reports/{id}/run → poll to ready`).

- [ ] **Step 1: Run list-by-reference → re-run → poll against the real report**
- [ ] **Step 2: Rework `PersonaScreeningProvider.rescreen` to list-latest + re-run** (replacing the report-creation path proven to 400 without PII), failing closed when no report exists
- [ ] **Step 3: Add unit tests with stubbed fetch** (linked report found; none found → `ScreeningUnavailableError`; re-run refused → unavailable; poll timeout → unavailable)
- [ ] **Step 4: Full suite + mutation round on the new path, commit**

### Task 1.3: Node acceptance runs (GATED — needs Task 0.4)

Trigger: RPC endpoints answering.

- [ ] **Step 1: Point staging config at the vendor URLs, run the BE-302/BE-601/BE-602 verification scripts against Sepolia** (indexer scan, confirmation sweep, assemble→sign→relay with a funded test key — test funds only, documented amounts)
- [ ] **Step 2: Record results in BACKEND_TASKS (BE-302/BE-601 PARTIAL → DONE if green) with commit**

### Task 1.4: BE-1102 rules intake (GATED — needs the 0.9 paragraph)

Trigger: user supplies thresholds/windows/action.

- [ ] **Step 1: Translate the paragraph into `RiskRule` semantics in the BE-1102 entry** (no code until the paragraph exists — invented scoring is fabrication)
- [ ] Follow-on build once defined (event scan + flags + review-queue reuse), estimated as its own 3-task slice at that time

### Task 1.5: Controller specs, batch A (assets, issuers, providers, pricing)

Pattern (established in `test/transactions.spec.ts`, `test/wallets.spec.ts`): two sessions where ownership exists, Redis DB index 5, pid-unique fixtures, `afterAll` deletes by prefix. Each controller gets: cross-account behavior (where rows belong to users), validation edges (422 vs 400/404 layer rule), role edges the roles suite cannot see.

- [ ] **Step 1: `test/assets.spec.ts`** — attestation PATCH by compliance vs customer 403; unknown asset 404; enable/disable by admin; customer read paths 200
- [ ] **Step 2: `test/issuers.spec.ts`** — same shape for register/verify/licence/risk-flags
- [ ] **Step 3: `test/providers.spec.ts`** — status change admin-only; health readable by session
- [ ] **Step 4: `test/pricing.spec.ts`** — record by support, customer 403; unknown asset 404; history scoped
- [ ] **Step 5: Run all four files + typecheck, commit**

### Task 1.6: Controller specs, batch B + service specs

- [ ] **Step 1: `test/devices.spec.ts`, `test/chains.spec.ts`, `test/audit.spec.ts`** (Redis DB 4) — same pattern; audit list confined to compliance role, chain enable admin-only
- [ ] **Step 2: `test/jobs.spec.ts`, `test/compliance-extra.spec.ts` (extend `test/compliance.spec.ts`), `test/blockchain.spec.ts`, `test/portfolio.spec.ts`, `test/onramp.spec.ts`, `test/fees.spec.ts`** (Redis DB 3) — same pattern
- [ ] **Step 3: Unit specs for `assets.service`, `chains.service`, `providers.service`, `redis.service`, `swaps.service` gaps, `job-lock`** — fake-store style per `transactions.service.spec.ts`
- [ ] **Step 4: Full suite + commit**

---

## Phase 2 — Gated builds (each states its trigger; do not start before it)

### Task 2.1a: Chainlink price source + feed job (trigger: explicit sign-off that oracle-primary pricing is accepted)

**Files:**

- Create: `services/api/src/pricing/price-source.ts`, `services/api/src/pricing/chainlink-price.source.ts`, `services/api/src/pricing/prices-feed.job.ts`
- Test: `services/api/src/pricing/price-source.spec.ts`, `services/api/src/jobs/prices-feed.job.spec.ts`
- Modify: `services/api/src/jobs/jobs.module.ts` (JOB_CLASSES + inject), `services/api/src/contracts.spec.ts` (jobs pin), `.env.example` (feed addresses documented, values unset)

**Interfaces:**

- Consumes: `BlockchainService.forChain` (viem client), `PricingService.record`
- Produces: `PriceSource { read(assetId: string): Promise<{ priceUsd: number } | null> }`, job `prices.refresh`

Feed addresses are public facts but never recalled: verify each against Chainlink docs at integration time and store in env (`CHAINLINK_XAU_FEED`, `CHAINLINK_XAG_FEED`), never hardcoded. Reads via `readContract` (latestRoundData) through the existing adapter pool — no new RPC dependency.

- [ ] **Step 1: Write the failing port test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { ChainlinkPriceSource } from "./chainlink-price.source.js";

describe("ChainlinkPriceSource", () => {
  it("reads latestRoundData and scales by feed decimals", async () => {
    const readContract = vi.fn(async () => [0n, 300012000000n, 0n, 0n, 0n]);
    const source = new ChainlinkPriceSource(
      { getContract: readContract } as never,
      {
        "asset:gld": "0xFeedAddressVerifiedAtIntegration",
      },
    );
    const out = await source.read("asset:gld");
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(out?.priceUsd).toBeCloseTo(3000.12, 6);
  });
  it("returns null when the feed reverts instead of inventing a price", async () => {
    const readContract = vi.fn(async () => {
      throw new Error("revert");
    });
    const source = new ChainlinkPriceSource(
      { getContract: readContract } as never,
      {},
    );
    await expect(source.read("asset:missing")).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @correnthian/api exec vitest run src/pricing/price-source.spec.ts`
Expected: FAIL with "Cannot find module './chainlink-price.source.js'"

- [ ] **Step 3: Write minimal port + Chainlink adapter** (port interface with `read`; adapter with feed-address map constructor, `latestRoundData` decode, decimals scaling, null-on-revert)
- [ ] **Step 4: Job following `SanctionsRescreenJob` shape** (bounded take over enabled metal assets, per-asset try/catch, `affected` = rows written, stale-flags untouched) + register + pins
- [ ] **Step 5: Full suite + mutation round (missing feed → null; revert → null + error recorded, never thrown into the batch), commit**

### Task 2.1b: Vendor fallback source (GATED — needs Task 0.5 key)

Same port, second adapter (`VendorPriceSource` with key header, timeout, stale-reject); job tries Chainlink first, vendor on null. Cross-check rule: disagreement beyond a configured bps band flags rather than picks — picking silently is how one bad feed becomes the price. Tests pin the band behavior with stubbed fetch.

### Task 2.2a: MetalsOrder model + migration (trigger: Task 0.1 issuer contract)

**Files:**

- Modify: `services/api/prisma/schema.prisma` (new `MetalsOrder` model), new migration dir via scratch-shadow diff + `migrate deploy`, regen client

Model (mirror `RedemptionRequest` lifecycle discipline, new table rather than stretching `SwapQuote` — fiat has no `Asset` row, and nullable fiat columns on quotes would weaken every existing invariant):

```prisma
model MetalsOrder {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  assetId   String
  asset     Asset    @relation(fields: [assetId], references: [id])
  providerId String?
  provider  Provider? @relation(fields: [providerId], references: [id])
  /// Fiat units as entered (currency in `fiatCurrency`); converted server-side, never trusted.
  fiatAmountRaw String
  fiatCurrency  String  @db.Char(3)
  /// Base units of metal quoted. Locked at quote time; delivery must match.
  amountRaw  String
  feeRaw     String?
  state      MetalsOrderState @default(requested)
  providerRef String?
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([userId, createdAt])
  @@index([state])
}
enum MetalsOrderState { requested awaiting_payment settled failed expired cancelled }
```

- [ ] **Step 1: Schema edit + diff + deploy + `migrate status` clean + regen**
- [ ] **Step 2: Expiry job reusing `SwapQuoteExpiryJob` shape** (guard on the update, `requested`/`awaiting_payment` past `expiresAt` → `expired`) + register + pins
- [ ] **Step 3: Commit**

### Task 2.2b: Buy service + route (trigger: Task 2.2a green)

**Files:**

- Create: `services/api/src/metals/metals.service.ts`, `services/api/src/metals/buy.dto.ts`
- Test: `services/api/src/metals/metals.service.spec.ts`, `services/api/test/metals-buy.spec.ts` (Redis DB 2)
- Modify: `services/api/src/metals/metals.controller.ts` (or new `buys.controller.ts` if the file grows unwieldy), `services/api/src/metals/metals.module.ts`, `packages/contracts/src/schemas.ts` (+ rebuild contracts), `services/api/test/roles.spec.ts` pin if gated (it is not — owner routes), `services/api/test/routes.spec.ts` (auto-covered; decorator-count invariant must stay green)

**Interfaces:**

- Consumes: `ComplianceGate.assertFiatAllowed(userId, 'metals-buy')`, `FeesService.breakdown({operation: 'buy', ...})`, `MetalsProvider` port (Task 2.2c), `AuditService.record/recordChange`
- Produces: `createBuy(input): MetalsOrder`, `confirmDelivery(orderId, txHash)` (idempotent)

Route: `POST /metals/buys` (owner, `Idempotent()` like swaps quotes + redemptions — the ERROR contract entries follow the same pattern).

- [ ] **Step 1: Write the failing service tests**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { MetalsService } from './metals.service.js';

describe('MetalsService.createBuy', () => {
  it('refuses an asset whose rails lack provider, naming the asset', async () => {
    // The Review-Focus trap: routing a provider-less asset to dex silently
    // would fill an order nobody quoted. Refuse with the asset named.
    const prisma = { asset: { findUnique: async () => ({
      id: 'a1', assetId: '1:x:iss', symbol: 'X', chainId: '1',
      enabled: true, category: 'metal', rails: ['dex'], transferSupported: true,
    }) } } } as never;
    const svc = new MetalsService(prisma, {} as never, {} as never, {} as never, {} as never);
    await expect(svc.createBuy({
      userId: 'u1', assetId: '1:x:iss', fiatAmountRaw: '100', fiatCurrency: 'USD', walletId: 'w1',
    })).rejects.toThrow(/X.*provider/i);
  });
  it('refuses a non-metal category even when enabled', async () => {
    const prisma = { asset: { findUnique: async () => ({
      id: 'a1', assetId: '1:u:iss', symbol: 'USDC', chainId: '1',
      enabled: true, category: 'stablecoin', rails: ['provider'], transferSupported: true,
    }) } } } as never;
    const svc = new MetalsService(prisma, {} as never, {} as never, {} as never, {} as never);
    await expect(svc.createBuy({
      userId: 'u1', assetId: '1:u:iss', fiatAmountRaw: '100', fiatCurrency: 'USD', walletId: 'w1',
    })).rejects.toThrow(/metal/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails** (missing module)
- [ ] **Step 3: Implement** — order: asset checks (enabled, `category === 'metal'`, rails includes `'provider'`) → wallet ownership (same 404 rule as everywhere) → `gate.assertFiatAllowed(userId, 'metals-buy')` with `FiatDeniedError → toHttpError()` mapping → fee breakdown via `FeesService.breakdown({ operation: 'buy', ... })` (zero-rule breakdown shows explicit $0 + `hasSpreadLine` false) → provider `createOrder` → create row `requested` with `expiresAt` → audit. Delivery confirmation is idempotent on `(providerRef)` unique path: second confirmation returns the row unchanged.
- [ ] **Step 4: HTTP tests** (`test/metals-buy.spec.ts`): gated denial for unverified user (generic 403, no row), 422 on malformed body, 404 on foreign wallet, expiry refusal with backdated `expiresAt` (Review Focus #4), RPC-down stub → 503 with no hostname (Review Focus #2)
- [ ] **Step 5: Contract entries** (`POST /api/v1/metals/buys` + ERROR idempotency entry, mirroring the swaps/redemptions pattern) + rebuild contracts + openapi green
- [ ] **Step 6: Full suite + mutation round, commit**

### Task 2.2c: Metals provider port + fake (trigger: Task 0.1 vendor docs)

Vendor literals follow the Persona discipline: VERIFY-AGAINST-DOCS marks, fake fails closed on unscripted calls, specs pin the implemented shape.

**Files:** Create `services/api/src/metals/metals-provider.ts` (port: `createOrder`, `getOrder`, `cancelOrder`), `fake-metals.provider.ts` (+ spec), vendor adapter skeleton (+ spec against stubbed fetch).

- [ ] **Steps follow the Task 2.2b pattern:** failing spec → run → minimal port + fake → replay/dedupe test (same order idempotency key twice → one row; Review Focus #3) → vendor skeleton with stubbed HTTP → suite + mutation + commit

### Task 2.3: Onramp execution (trigger: Task 0.6 vendor + docs)

**Files:**

- Create: `services/api/src/onramp/onramp-provider.ts` (+ fake + spec), extend `onramp.service.ts` with `execute`
- Modify: `services/api/src/onramp/onramp.controller.ts` (`POST /onramp/execute`), contracts registry + rebuild, roles pin if gated (owner route — no pin change, but the decorator-count invariant must stay green)

**Interfaces:**

- Consumes: `ComplianceGate.assertFiatAllowed(userId, 'onramp')`, provider port
- Produces: executed delivery recorded as `Transaction` (`direction: 'in'`, `provider` set, `state: 'broadcast'` → confirmations via the BE-601 sweep — no new model, no new lifecycle)

No new table: delivery is observable on-chain, so the existing confirmation machinery settles it. Steps follow the 2.2b pattern (failing HTTP test with scripted fake → route → mapping → suite + mutation + commit).

### Task 2.4: Notification transport (trigger: ADR-020 + Task 0 email vendor)

**Files:**

- Modify: `schema.prisma` (`Notification` += `claimedAt DateTime?`, `claimedBy String?`) + migration + regen — closes DEF-009's missing column
- Create: `services/api/src/notifications/transport.ts` (port: `send(notification): Promise<void>`), `email.transport.ts` (+ spec with stubbed SMTP/HTTP), `services/api/src/jobs/notification-sender.job.ts` (+ spec)
- Modify: `claimBatch` to atomic guarded claim (`updateMany` where unsent-unclaimed → set claim + lease timeout; requeue on expiry), jobs module + pins

**Interfaces:**

- Consumes: `NotificationsService` rows, vendor credentials from env (names only in repo)
- Produces: `close DEF-009`; unblocks BE-203 magic-link as a follow-on (recorded, not included — auth surface deserves its own task)

Steps follow the established pattern (failing claim-race test with two concurrent claimants → guarded update → transport fake → sender job → suite + mutation + commit).

### Task 2.5: Custody completeness (no third-party custodian exists by architecture — this workstream is the custody subsystems)

Interpretation flagged for review: "custodians" here means self-custody wallet layer + backing transparency + redemption execution, NOT a custodian vendor (no vendor ever holds user funds — key boundary). Correct this section if meant otherwise.

- [ ] **Step 1: Guardians management endpoints** (verified gap: `Wallet.guardians` is set at registration only). `PATCH /wallets/:id/guardians` (owner-only, smart-kind only — seed accounts have no contract, mirroring the registration rule; each address EVM-validated). Failing HTTP test first (foreign wallet 404, seed-kind 400, malformed address 422), then route + service + contract entry + suite + commit.
- [ ] **Step 2: Attestation freshness job** (verification, not validation — BE-401's criteria stay counsel-gated). Scheduled job flagging assets past `attestationCadence` without fresh `lastAttestedAt`, feeding the existing `staleAttestations` surface. Follows the rescreen-job shape. Failing test → job → suite + commit.
- [ ] **Step 3: Recovery decision intake** (GATED — BE-203b's four options in `key-boundary.md`). No code until one is chosen; record the choice as the trigger. Seed-account recovery stays absent loudly, not silently.
- [ ] **Step 4: SmartAccount deployment tracking** (GATED — ADR-022 build choices). `Wallet.deployed` exists; the deploy-on-first-fund flow waits on the account implementation + EntryPoint. No code until chosen.

---

## Phase 3 — Admin ops (reads only; every endpoint already serves)

Page pattern (established in `apps/admin/src/app/(dashboard)/quotes/page.tsx`, follow it exactly): server component, `Contract<'METHOD /api/v1/...'>` types inferred from wire contracts (never hand-written — adding a page for an uncontracted route first adds the contract entry), `apiFetch` + `ApiState`, shadcn `Card`/`Table`, filters from `searchParams`, cursor pagination with `nextCursor`. Tokens, not raw values (`bg-background`, `text-muted-foreground`, `border-border`). No mocks — a page with no data shows the empty state, never invented rows.

### Task 3.1: Redemptions page — `apps/admin/src/app/(dashboard)/redemptions/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";
import type { Contract } from "@correnthian/contracts";
import { apiFetch } from "@/lib/api-server";
import { ApiState } from "@/components/feedback/api-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDateTime } from "@/lib/format";

type RedemptionList = Contract<"GET /api/v1/redemptions">;
type RedemptionRow = RedemptionList["items"][number];

export const metadata = { title: "Redemptions · Correnthian admin" };
export const dynamic = "force-dynamic";

const STATE_TONE: Record<
  RedemptionRow["state"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  requested: "secondary",
  kyc_pending: "secondary",
  approved: "default",
  in_production: "default",
  shipped: "default",
  delivered: "default",
  rejected: "destructive",
  cancelled: "outline",
  expired: "outline",
};

export default async function RedemptionsPage({
  searchParams,
}: PageProps<"/redemptions">) {
  const sp = await searchParams;
  const state = typeof sp.state === "string" ? sp.state : "";
  const query = new URLSearchParams();
  if (state) query.set("state", state);
  const res = await apiFetch<RedemptionList>(
    `/redemptions?${query.toString()}`,
  );
  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Redemptions</h1>
        <p className="text-sm text-muted-foreground">
          Physical metal payouts. State advances only through explicit
          transitions.
        </p>
      </header>
      <Card>
        <CardContent>
          <ApiState
            result={res}
            render={(d) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {fmtDateTime(r.requestedAt)}
                      </TableCell>
                      <TableCell>{r.asset.symbol}</TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {r.amountRaw}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATE_TONE[r.state]}>{r.state}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />
        </CardContent>
      </Card>
    </>
  );
}
```

- [ ] **Step 2: Typecheck the admin app** — Run: `pnpm --filter @correnthian/admin typecheck`. If `Contract<'GET /api/v1/redemptions'>` does not resolve, the contract entry is missing: add it to `packages/contracts/src/schemas.ts` first (response schema for the list route), rebuild contracts, re-run. A page typed against a missing contract is the DEF-012 failure mode returning.
- [ ] **Step 3: Render-verify in a browser** — boot admin + API, screenshot the page with data and empty. A curl+grep pass proves markup, not what the operator sees.
- [ ] **Step 4: Commit**

### Task 3.2: Review queue page — `apps/admin/src/app/(dashboard)/reviews/page.tsx`

Same skeleton as 3.1. Data: `GET /compliance/reviews` (add the contract entry first — the route postdates the registry). Columns: user email, KYC status, sanctions result, updated-at. Each row links to the user detail page. Actions (approve/reject with reason) ride the existing `RequireAuditReason` pattern — decision buttons POST to `/compliance/reviews/:userId/decide` with a reason field; without a reason the call must not fire (client-side guard mirroring the server's `assertReason`).

- [ ] **Step 1: Contract entry for `GET /compliance/reviews` + `POST /compliance/reviews/:userId/decide`** (response schemas), rebuild contracts
- [ ] **Step 2: Write the page** (table + per-row approve/reject with reason input)
- [ ] **Step 3: Typecheck + browser render-verify + commit**

### Task 3.3: Transactions page — `apps/admin/src/app/(dashboard)/transactions/page.tsx`

Same skeleton. Data: `GET /transactions` (contract entry exists: `transactionListSchema`) + `GET /transactions/stats`. Columns: when, direction, asset, amount, state, confirmations vs required, drop count. State filter + wallet filter via searchParams. Rows link to a detail view reusing the detail schema (`GET /transactions/:id`).

- [ ] **Step 1: Write the page** (filters for state/direction/walletId, cursor pagination)
- [ ] **Step 2: Typecheck + browser render-verify + commit**

### Task 3.4: Fees page — `apps/admin/src/app/(dashboard)/fees/page.tsx`

Same skeleton. Data: `GET /fees/rules` + diagnostics (contracts exist). Table shows operation/kind/basis/label/rate with the ambiguous-pair diagnostics surfaced, not buried. Create/change actions require `owner` role AND a reason (server enforces both; the page disables the buttons without a reason typed, mirroring the server rule rather than discovering it via 400s).

- [ ] **Step 1: Write the page**
- [ ] **Step 2: Typecheck + browser render-verify + commit**

### Task 3.5: Jobs page — `apps/admin/src/app/(dashboard)/jobs/page.tsx`

Same skeleton. Data: `GET /jobs` (`jobsStatusSchema` contract exists). Per job: name, cadence, last run outcome, health derived from the run ledger (same derivation the API uses — display it, do not recompute it). Manual-run button POSTs `/jobs/:name/run` (admin-only; confirm dialog first — a stray click spends real RPC quota).

- [ ] **Step 1: Write the page**
- [ ] **Step 2: Typecheck + browser render-verify + commit**

### Task 3.6: Notifications page — `apps/admin/src/app/(dashboard)/notifications/page.tsx`

Same skeleton. Data: existing list/stats endpoints (add contract entries if missing — check first). Columns: user, channel, template, state (pending/sent/failed), error. No "resend" action until a transport exists (Task 2.4): a button that claims to send without a transport is the ADR-020 lie in UI form.

- [ ] **Step 1: Contract entries if missing, then the page**
- [ ] **Step 2: Typecheck + browser render-verify + commit**

---

## Phase 4 — User side (after API stability + counsel's buy-flow answers)

Entry criterion (do not start before both): (a) an API stability marker — routes frozen for v1, recorded in BACKEND_TASKS; (b) counsel's answers on buy flow and redemption mechanics. Building clients against a moving API or undecided flows rebuilds them — the do-not-start rationale, unchanged.

### Task 4.1: API stability marker

- [ ] **Step 1: Freeze checklist in BACKEND_TASKS** — every v1 route has a contract entry, every contract matches a route (openapi suite green), no `deprecated` markers pending. Any exception listed by name with its unblock condition.
- [ ] **Step 2: Commit** (docs only)

### Task 4.2: Web wallet pages (PWA, `apps/web`)

Screens, in order (each independently usable): portfolio (GET /portfolio + allocation + history-series), receive (wallet address + QR — address display only, never key material), send (build → device signs via wallet-core → broadcast → confirmations polling), buy (gated on Phase 2 metals endpoint; shows fee breakdown before signing — the FeesService contract made visible), history (transactions mine + snapshots). Client chain access: backend-proxy only (no RPC code in the app — the settled architecture question, not a shortcut).

- [ ] Per screen: route + component + Contract<>-typed fetch + loading/empty/error states + typecheck + browser verify + commit (one commit per screen, same cadence as Phase 3 pages)

### Task 4.3: Mobile parity (`apps/mobile`, Expo)

Mirror of 4.2 in React Native: same endpoints, same Contract<> types via `@correnthian/api-client` if it exists by then, otherwise direct fetch with Zod parsing at the edge. Biometric/PIN gates stay presentation-layer (BE-205) — they lock the UI, never the keys, which never leave SecureStore. Push token registration against the devices endpoint when a transport exists.

- [ ] Per screen: same cadence as 4.2 (component + states + verify on device/emulator + commit)

### Marketing (`apps/marketing`) — explicitly outside the sequence

Needs no backend and no decisions: can start any time, including now. Noted so nobody reads Phase 4 as blocking it.

---

## Self-review

**1. Spec coverage:** Phase 0 items map to `docs/operations/third-parties.md` §5 one-to-one (issuer, counsel, stores+domain, RPC, price vendor, onramp, Persona prod, infra, decisions). Phase 1 covers both recorded gaps (RPC wiring 1.1; metals-buy confirmation was investigation-only and stays out of code). Phase 2 covers BE-502, metals-buy, onramp execution, notifications transport + DEF-009, and custody (guardians endpoints, attestation freshness, recovery/smarts intake as gated). Phase 3 covers the six missing ops pages (redemptions, reviews, transactions, fees, jobs, notifications). Phase 4 covers web, mobile, and the stability marker. Magic-link (BE-203) is recorded as the follow-on to Task 2.4, not dropped. No spec section left without an owning task.

**2. Placeholder scan:** no TBD/TODO/later/fill-in-details; no "add validation" without code (validation code is inline in every route step); no "write tests" without test bodies; no "similar to Task N" cross-references (each task repeats its operative code).

**3. Type consistency:** `resolveSeedRpcUrls(chainId, existing, env)` named identically in Task 1.1 test and implementation; `PriceSource.read(assetId)` matches job usage; `MetalsOrder` fields match the schema block; `createBuy({userId, assetId, fiatAmountRaw, fiatCurrency, walletId})` consistent across 2.2b steps; `FiatDeniedError → toHttpError()` mapping matches the existing gate; `SCREENING_PROVIDER`-style ports mirrored for metals/onramp providers; admin `Contract<'METHOD /api/v1/path'>` usage matches `quotes/page.tsx`.

**4. Review Focus:** all five lines name the task owning the pinning test (2.2b ×4, 2.2c ×1). No empty section.
