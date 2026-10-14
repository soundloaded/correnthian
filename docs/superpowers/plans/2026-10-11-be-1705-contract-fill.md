# BE-1705 Contract Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every v1 route with a response body a contract registry entry plus a live-response parse in `contracts.spec.ts`, closing BE-1705 (currently OPEN: ~61 of ~98 routes uncovered).

**Architecture:** Schemas mirror service return shapes field-for-field (read the method, mirror the select); registry keys are `METHOD /api/v1/path`; bare-GET 200s join the ENDPOINTS loop; fixture-creating writes get individual tests that delete what they create by pid-unique key; vendor-absent refusals get ERROR-envelope entries asserting status AND code. No service behavior changes — a parse failure is investigated as a wrong schema first, a bug second, and a bug becomes a ledgered ruling.

**Tech Stack:** TypeScript; Zod 4.6.5; vitest over HTTP with the seeded admin token; Redis DB 0 for the new fixture tests (DBs 16–1 are all taken by existing suites).

**Spec:** `docs/agent/BACKEND_TASKS.md` BE-1705 (the gap) · `docs/superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md` (product rationale)

## Global Constraints

- Node 22+ and pnpm 10+. API suite: `pnpm --filter @correnthian/api exec vitest run <path>`.
- Explicit Nest DI (`@Inject`) everywhere; `node scripts/check-explicit-di.mjs` stays green.
- `packages/*` build to `dist/`; rebuild `@correnthian/contracts` (`pnpm --filter @correnthian/contracts build`) before running any spec that imports it.
- Money is `bigint` Usd at 10^-8 on the wire as decimal strings; Prisma Decimals cross the wire as `z.union([z.string(), z.number()])` — never `z.number()` alone (a Decimal serialises as a string).
- Dates cross as ISO strings (`z.string()`), never `z.date()`.
- Every fixture-creating test deletes by pid-unique key in the test (not `afterAll` only): a mid-test failure must not leak rows into parallel suites on the shared DB.
- Every mutation of shared seed state (chain enabled, provider status, user role/status, fee rules) restores in-test, with an assertion on the restored value.
- No invented amounts, rates, fees, prices, users, or vendors. Seed fixtures (RSPG assets, `placeholder-metals`, chains 1/8453) are read, never assumed — the test looks them up first and skips nothing silently.
- Bodyless 204s (`DELETE /wallets/:id`, `DELETE /devices/:id`, `POST /auth/logout`) get no registry entry — there is no body to pin. They are covered by status assertions in their tests and recorded as the three exceptions in Task 11.
- Commit per task with a why-message + the harness attribution line.

## Review Focus

1. A Decimal field typed `z.number()` passes against one row and breaks on the next — every Prisma Decimal gets the string|number union. Pinned in Task 7's mine schema (notionalUsd, sizeCapUsd).
2. A fixture leaked into the shared DB flakes a parallel suite three files away — every creating test deletes its rows in-test. Pinned in Tasks 2, 4, 6, 7, 8, 9.
3. An ERROR entry asserting only status passes for the wrong refusal — every ERROR test asserts the envelope `code` too. Pinned in Tasks 8 and 10.
4. Volatile fields (uptimeSeconds, latencyMs, lastSeenAt) break exact-value assertions — assert shape/type, never values. Pinned in Task 10.
5. A flipped shared flag left flipped (chain, provider, role) breaks other suites — restore in-test with an assertion on the restored value, never in `afterAll` alone. Pinned in Tasks 3, 5, 9.

---

## File Map

All schemas go in `packages/contracts/src/schemas.ts`; all keys in `CONTRACT_REGISTRY` in the same file. All parse tests go in `services/api/src/contracts.spec.ts` (ENDPOINTS loop for bare GETs, individual `it()` blocks for everything else). No new files except none — every task modifies exactly these two files (plus the contracts rebuild).

Subsystem boundaries: each task is one controller area plus its schemas; tasks share only the registry file (append-only keys, no renames) and the contracts.spec file (append-only tests).

---

## Phase 0 — Fixture audit (do first, once)

No code: run each command, record the values. Later tasks consume these exact values; a task whose fixture is absent stops and records a ruling instead of inventing one.

- [ ] **Step 1: Seed asset identities**

Run: `docker exec correnthian-postgres psql -U correnthian -d correnthian -tAc 'SELECT "assetId", symbol, "chainId", enabled, "transferSupported", "redeemSupported" FROM "Asset" ORDER BY symbol;'`
Expected: at least two enabled rows with `transferSupported = true` on chain `1` (transaction intent fixtures, Task 8) and at least two enabled rows on one chain (swap quote fixtures, Task 7). Record the domain assetIds.

- [ ] **Step 2: Seeded admin**

Run: `docker exec correnthian-postgres psql -U correnthian -d correnthian -tAc "SELECT email, role FROM \"User\" WHERE email='admin@correnthian.local';"`
Expected: one row, role `admin`. The contracts.spec token belongs to this user; admin satisfies `support`, `compliance` and `admin` gates (role hierarchy `user < support < compliance < admin < owner` in `services/api/src/common/roles.ts`) but NOT `owner`.

- [ ] **Step 3: Record both values in the ledger.** No commit (no files changed).

## Task 1: Wallets (8 routes)

**Files:**

- Modify: `packages/contracts/src/schemas.ts` (schemas + 7 keys; DELETE gets none)
- Modify: `services/api/src/contracts.spec.ts` (2 ENDPOINTS rows + 1 individual test)
- Test: same spec file

**Interfaces:**

- Consumes: `walletDetailSchema` (exists), Phase-0 seed assets
- Produces: `walletListRowSchema`, `walletPortfolioSchema`, `walletBalanceSchema`, keys `GET /api/v1/wallets`, `GET /api/v1/wallets/portfolio`, `GET /api/v1/wallets/:id`, `POST /api/v1/wallets`, `PATCH /api/v1/wallets/:id/label`, `PATCH /api/v1/wallets/:id/primary`, `POST /api/v1/wallets/:id/balances/:assetId`

`list()` returns `{id, address, chainId, kind, label, deployed, isPrimary, guardians, createdAt(Date), _count:{accounts, transactions}, display}`. `portfolio()` returns `{wallets, totalWallets, notice}` where `wallets` is the same list shape. `setBalance` returns `{balanceRaw, lastSyncedAt(Date), assetId(surrogate)}`. `findById` (register/label/primary/detail) returns the full row incl `accounts` — extra keys parse fine against `walletDetailSchema`, so those three reuse it.

- [ ] **Step 1: Add schemas + keys**

```typescript
export const walletListRowSchema = z.object({
  id: z.string(),
  address: z.string(),
  chainId: z.string(),
  kind: z.enum(["smart", "seed"]),
  label: z.string().nullable(),
  deployed: z.boolean(),
  isPrimary: z.boolean(),
  guardians: z.array(z.string()),
  createdAt: z.string(),
  display: z.string(),
  _count: z.object({ accounts: z.number(), transactions: z.number() }),
});

export const walletPortfolioSchema = z.object({
  wallets: z.array(walletListRowSchema),
  totalWallets: z.number().int(),
  notice: z.string(),
});

export const walletBalanceSchema = z.object({
  balanceRaw: z.string(),
  lastSyncedAt: z.string(),
  assetId: z.string(),
});
```

Registry additions:

```typescript
'GET /api/v1/wallets': z.array(walletListRowSchema),
'GET /api/v1/wallets/portfolio': walletPortfolioSchema,
'GET /api/v1/wallets/:id': walletDetailSchema,
'POST /api/v1/wallets': walletDetailSchema,
'PATCH /api/v1/wallets/:id/label': walletDetailSchema,
'PATCH /api/v1/wallets/:id/primary': walletDetailSchema,
'POST /api/v1/wallets/:id/balances/:assetId': walletBalanceSchema,
```

- [ ] **Step 2: Rebuild contracts**

Run: `pnpm --filter @correnthian/contracts build`
Expected: exit 0.

- [ ] **Step 3: ENDPOINTS rows for the two bare GETs**

```typescript
['GET /api/v1/wallets', '/api/v1/wallets'],
['GET /api/v1/wallets/portfolio', '/api/v1/wallets/portfolio'],
```

Both answer 200 for the admin token even with zero wallets (arrays, possibly empty) — no fixture needed.

- [ ] **Step 4: Individual wallet lifecycle test**

```typescript
it("wallet register → read → label → balance parses every touched contract", async () => {
  const address = `0x${"c".repeat(32)}${process.pid.toString(16).padStart(8, "0")}`;
  const reg = await request(app.getHttpServer())
    .post("/api/v1/wallets")
    .set("Authorization", `Bearer ${token}`)
    .send({ chainId: "1", address, kind: "smart", label: "contract-fill" });
  expect(reg.status, JSON.stringify(reg.body)).toBe(201);
  expect(
    CONTRACT_REGISTRY["POST /api/v1/wallets"].safeParse(reg.body).success,
  ).toBe(true);
  const id = reg.body.id as string;

  const one = await request(app.getHttpServer())
    .get(`/api/v1/wallets/${id}`)
    .set("Authorization", `Bearer ${token}`);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/wallets/:id"].safeParse(one.body).success,
  ).toBe(true);

  const labelled = await request(app.getHttpServer())
    .patch(`/api/v1/wallets/${id}/label`)
    .set("Authorization", `Bearer ${token}`)
    .send({ label: "renamed" });
  expect(
    CONTRACT_REGISTRY["PATCH /api/v1/wallets/:id/label"].safeParse(
      labelled.body,
    ).success,
  ).toBe(true);

  const seedAssets = await request(app.getHttpServer())
    .get("/api/v1/assets")
    .set("Authorization", `Bearer ${token}`);
  const metal = (seedAssets.body as Array<{ asset: { assetId: string } }>)[0]
    ?.asset.assetId;
  expect(metal).toBeTruthy();
  const bal = await request(app.getHttpServer())
    .post(`/api/v1/wallets/${id}/balances/${encodeURIComponent(metal)}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ balanceRaw: "1000000" });
  expect(bal.status, JSON.stringify(bal.body)).toBe(201);
  expect(
    CONTRACT_REGISTRY["POST /api/v1/wallets/:id/balances/:assetId"].safeParse(
      bal.body,
    ).success,
  ).toBe(true);

  const primary = await request(app.getHttpServer())
    .patch(`/api/v1/wallets/${id}/primary`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  expect(
    CONTRACT_REGISTRY["PATCH /api/v1/wallets/:id/primary"].safeParse(
      primary.body,
    ).success,
  ).toBe(true);

  // Deletion is a bodyless 204 — asserted by status, with cleanup inline so
  // no row survives this test under any outcome above.
  const del = await request(app.getHttpServer())
    .delete(`/api/v1/wallets/${id}`)
    .set("Authorization", `Bearer ${token}`);
  expect(del.status).toBe(200);
});
```

Note: DELETE answers 200 (Nest default, controller returns `Promise<void>`), not 204 — the assertion above states 200. If it answers otherwise, the schema-less assertion is still status-only; adjust the number, never invent a body.

- [ ] **Step 5: Run + commit**

Run: `pnpm --filter @correnthian/api exec vitest run src/contracts.spec.ts`
Expected: PASS (all rows incl. the 2 new ENDPOINTS + lifecycle test).
Then: `pnpm --filter @correnthian/api typecheck` (exit 0), commit with why-message + attribution line.

## Task 2: Devices (3 routes) + auth (4 routes)

**Files:**

- Modify: `packages/contracts/src/schemas.ts`, `services/api/src/contracts.spec.ts`
- Test: same spec file

**Interfaces:**

- Consumes: `deviceRowSchema` (exists)
- Produces: `deviceMineSchema`, `authSessionSchema`, `authMeSchema`, keys for `GET /api/v1/devices`, `POST /api/v1/devices`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me` (`DELETE /devices/:id` and `POST /auth/logout` are bodyless — status-only, no keys)

`list()`/`register()` return `{id, platform, label, trustedAt(Date), lastSeenAt(Date)}` — no `user`, no `revokedAt`. `present()` returns `{user:{id,email,role}, token, expiresAt(ISO)}`. `me` returns `{id, email, role}`.

- [ ] **Step 1: Add schemas + keys**

```typescript
export const deviceMineSchema = deviceRowSchema.omit({
  revokedAt: true,
  user: true,
});

export const authSessionSchema = z.object({
  user: z.object({ id: z.string(), email: z.string(), role: z.string() }),
  token: z.string().min(1),
  expiresAt: z.string(),
});

export const authMeSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
});
```

```typescript
'GET /api/v1/devices': z.array(deviceMineSchema),
'POST /api/v1/devices': deviceMineSchema,
'POST /api/v1/auth/register': authSessionSchema,
'POST /api/v1/auth/login': authSessionSchema,
'GET /api/v1/auth/me': authMeSchema,
```

- [ ] **Step 2: Rebuild contracts** (same command, exit 0).
- [ ] **Step 3: ENDPOINTS row for the bare GET**

```typescript
['GET /api/v1/devices', '/api/v1/devices'],
```

The admin token may own no devices — an empty array still parses.

- [ ] **Step 4: Individual device lifecycle + auth flow tests**

```typescript
it("device register → list → revoke parses and leaves nothing behind", async () => {
  const reg = await request(app.getHttpServer())
    .post("/api/v1/devices")
    .set("Authorization", `Bearer ${token}`)
    .send({ platform: "web", label: "contract-fill" });
  expect(reg.status, JSON.stringify(reg.body)).toBe(201);
  expect(
    CONTRACT_REGISTRY["POST /api/v1/devices"].safeParse(reg.body).success,
  ).toBe(true);

  const list = await request(app.getHttpServer())
    .get("/api/v1/devices")
    .set("Authorization", `Bearer ${token}`);
  const mine = (list.body as Array<{ id: string; label: string }>).find(
    (d) => d.label === "contract-fill",
  );
  expect(mine).toBeDefined();

  const del = await request(app.getHttpServer())
    .delete(`/api/v1/devices/${mine!.id}`)
    .set("Authorization", `Bearer ${token}`);
  expect(del.status).toBe(204);

  const after = await request(app.getHttpServer())
    .get("/api/v1/devices")
    .set("Authorization", `Bearer ${token}`);
  expect(
    (after.body as Array<{ id: string }>).some((d) => d.id === mine!.id),
  ).toBe(false);
});

it("auth register → login → me → logout round-trips the session contract", async () => {
  const email = `c-fill-${process.pid}@example.test`;
  const password = "correct-horse-battery-staple-extra";
  const reg = await request(app.getHttpServer())
    .post("/api/v1/auth/register")
    .send({ email, password });
  expect(reg.status, JSON.stringify(reg.body)).toBe(201);
  expect(
    CONTRACT_REGISTRY["POST /api/v1/auth/register"].safeParse(reg.body).success,
  ).toBe(true);

  const login = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password });
  expect(login.status).toBe(200);
  expect(
    CONTRACT_REGISTRY["POST /api/v1/auth/login"].safeParse(login.body).success,
  ).toBe(true);

  const me = await request(app.getHttpServer())
    .get("/api/v1/auth/me")
    .set("Authorization", `Bearer ${login.body.token}`);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/auth/me"].safeParse(me.body).success,
  ).toBe(true);
  expect(me.body.email).toBe(email);

  const out = await request(app.getHttpServer())
    .post("/api/v1/auth/logout")
    .set("Authorization", `Bearer ${login.body.token}`);
  expect(out.status).toBe(204);

  await prisma.user.deleteMany({ where: { email } });
});
```

`prisma` is already in scope in contracts.spec (it seeds/cleans there — verify the variable name before writing; if it is named differently, use that name). If DELETE answers 200 instead of 204, adjust the number status-only.

- [ ] **Step 5: Run + commit** (same two commands + commit).

## Task 3: Chains detail (1 route) + providers (3 routes)

**Files:**

- Modify: `packages/contracts/src/schemas.ts`, `services/api/src/contracts.spec.ts`
- Test: same spec file

**Interfaces:**

- Consumes: `chainSchema`, `providerSchema` (exist)
- Produces: `chainDetailSchema`, `providerHealthSchema`, keys `GET /api/v1/chains/:id`, `PATCH /api/v1/chains/:id/enabled`, `GET /api/v1/providers/health`, `GET /api/v1/providers/:slug`, `PATCH /api/v1/providers/:slug/status`

`findById` selects the chainSchema fields plus `_count:{assets, wallets, transactions}`. `healthSummary()` returns `{counts: Record<string,number>, providers: [{slug, name, category, status, lastCheckedAt(Date|null)}]}`. `findBySlug` includes `_count:{quotes, redemptions}` — identical to `providerSchema`.

- [ ] **Step 1: Add schemas + keys**

```typescript
export const chainDetailSchema = chainSchema.extend({
  _count: z.object({
    assets: z.number(),
    wallets: z.number(),
    transactions: z.number(),
  }),
});

export const providerHealthSchema = z.object({
  counts: z.record(z.string(), z.number()),
  providers: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      category: z.string(),
      status: z.enum(["active", "degraded", "disabled"]),
      lastCheckedAt: z.string().nullable(),
    }),
  ),
});
```

```typescript
'GET /api/v1/chains/:id': chainDetailSchema,
'PATCH /api/v1/chains/:id/enabled': chainDetailSchema,
'GET /api/v1/providers/health': providerHealthSchema,
'GET /api/v1/providers/:slug': providerSchema,
'PATCH /api/v1/providers/:slug/status': providerSchema,
```

- [ ] **Step 2: Rebuild contracts** (exit 0).
- [ ] **Step 3: ENDPOINTS rows**

```typescript
['GET /api/v1/chains/:id', '/api/v1/chains/1'],
['GET /api/v1/providers/health', '/api/v1/providers/health'],
['GET /api/v1/providers/:slug', '/api/v1/providers/placeholder-metals'],
```

Chain `1` and `placeholder-metals` are seed rows — read, not invented. If either is absent the test fails loudly rather than substituting.

- [ ] **Step 4: Individual flip-with-restore tests**

```typescript
it("chain enable flips and restores in-test", async () => {
  const on = await request(app.getHttpServer())
    .patch("/api/v1/chains/11155111/enabled")
    .set("Authorization", `Bearer ${token}`)
    .send({ enabled: true });
  expect(on.status).toBe(200);
  expect(
    CONTRACT_REGISTRY["PATCH /api/v1/chains/:id/enabled"].safeParse(on.body)
      .success,
  ).toBe(true);
  expect(on.body.enabled).toBe(true);

  const off = await request(app.getHttpServer())
    .patch("/api/v1/chains/11155111/enabled")
    .set("Authorization", `Bearer ${token}`)
    .send({ enabled: false });
  expect(off.body.enabled).toBe(false);
});
```

Sepolia (`11155111`) is seeded disabled and used by no suite for enabled-chain behavior — flipping `1` or `8453` would break parallel suites. Same shape for `placeholder-metals` (`degraded` then `disabled`, asserting the restored `disabled`).

- [ ] **Step 5: Run + commit** (same two commands + commit).

## Task 4: Issuers (6 routes)

**Files:**

- Modify: `packages/contracts/src/schemas.ts`, `services/api/src/contracts.spec.ts`
- Test: same spec file

**Interfaces:**

- Consumes: `issuerSchema` (exists, carries `_count`)
- Produces: `issuerWriteSchema`, `issuerDetailSchema`, `issuerStatsSchema`, keys for `GET /api/v1/issuers/stats`, `GET /api/v1/issuers/:slug`, `POST /api/v1/issuers`, three `PATCH` routes

`create`/`setVerifiedTier`/`recordLicences`/`addRiskFlag` return the bare row (no `_count`, no `assets`). `findBySlug` returns the row plus `assets:[{assetId, symbol, name, enabled}]`. `stats()` returns `{total, byTier: Record<string,number>}`.

- [ ] **Step 1: Add schemas + keys**

```typescript
export const issuerWriteSchema = issuerSchema.omit({ _count: true });

export const issuerDetailSchema = issuerSchema.extend({
  assets: z.array(
    z.object({
      assetId: z.string(),
      symbol: z.string(),
      name: z.string(),
      enabled: z.boolean(),
    }),
  ),
});

export const issuerStatsSchema = z.object({
  total: z.number().int(),
  byTier: z.record(z.string(), z.number()),
});
```

```typescript
'GET /api/v1/issuers/stats': issuerStatsSchema,
'GET /api/v1/issuers/:slug': issuerDetailSchema,
'POST /api/v1/issuers': issuerWriteSchema,
'PATCH /api/v1/issuers/:slug/verification': issuerWriteSchema,
'PATCH /api/v1/issuers/:slug/licences': issuerWriteSchema,
'PATCH /api/v1/issuers/:slug/risk-flags': issuerWriteSchema,
```

- [ ] **Step 2: Rebuild contracts** (exit 0).
- [ ] **Step 3: ENDPOINTS row**

```typescript
['GET /api/v1/issuers/stats', '/api/v1/issuers/stats'],
```

- [ ] **Step 4: Individual issuer lifecycle test**

```typescript
it("issuer register → licence → verify → flag parses every write contract", async () => {
  const slug = `c-fill-${process.pid}`;
  const created = await request(app.getHttpServer())
    .post("/api/v1/issuers")
    .set("Authorization", `Bearer ${token}`)
    .send({ slug, name: "Contract Fill", jurisdiction: "US" });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  expect(
    CONTRACT_REGISTRY["POST /api/v1/issuers"].safeParse(created.body).success,
  ).toBe(true);

  const detail = await request(app.getHttpServer())
    .get(`/api/v1/issuers/${slug}`)
    .set("Authorization", `Bearer ${token}`);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/issuers/:slug"].safeParse(detail.body)
      .success,
  ).toBe(true);
  expect(detail.body.assets).toEqual([]);

  const lic = await request(app.getHttpServer())
    .patch(`/api/v1/issuers/${slug}/licences`)
    .set("Authorization", `Bearer ${token}`)
    .send({ licenseTypes: ["trust-charter"], licenseRefs: ["ref-1"] });
  expect(
    CONTRACT_REGISTRY["PATCH /api/v1/issuers/:slug/licences"].safeParse(
      lic.body,
    ).success,
  ).toBe(true);

  const tier = await request(app.getHttpServer())
    .patch(`/api/v1/issuers/${slug}/verification`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      tier: "issuer_verified",
      custodian: "Fill Vault",
      proofOfReserves: "https://example.test/por.pdf",
    });
  expect(
    CONTRACT_REGISTRY["PATCH /api/v1/issuers/:slug/verification"].safeParse(
      tier.body,
    ).success,
  ).toBe(true);

  const flag = await request(app.getHttpServer())
    .patch(`/api/v1/issuers/${slug}/risk-flags`)
    .set("Authorization", `Bearer ${token}`)
    .send({ flag: "contract-fill" });
  expect(
    CONTRACT_REGISTRY["PATCH /api/v1/issuers/:slug/risk-flags"].safeParse(
      flag.body,
    ).success,
  ).toBe(true);

  await prisma.issuer.deleteMany({ where: { slug } });
});
```

- [ ] **Step 5: Run + commit** (same two commands + commit).

## Task 5: Pricing (3 routes) + public GETs (eligibility, availability)

**Files:**

- Modify: `packages/contracts/src/schemas.ts`, `services/api/src/contracts.spec.ts`
- Test: same spec file

**Interfaces:**

- Produces: `priceLatestSchema`, `priceHistorySchema`, `priceRecordSchema`, `eligibilitySchema`, `availabilitySchema`, keys for `GET /api/v1/pricing/assets/:assetId`, `GET /api/v1/pricing/assets/:assetId/history`, `POST /api/v1/pricing/record`, `GET /api/v1/compliance/eligibility`, `GET /api/v1/onramp/availability`

`latest()` returns `{found:false, assetId, reason}` or `{found:true, assetId, priceUsd(number), source, capturedAt(ISO), ageSeconds, stale}`. `history()` returns `[{priceUsd(Decimal→string|number), source, capturedAt(ISO)}]`. `record()` returns `{assetId(surrogate id), priceUsd, source, capturedAt}`. `evaluate()` returns `{allowed, canBuyCrypto, canSellCrypto, canUseMetals, canRedeem, kycRequired, blockedProviders[], matchedRule({country, region|null})|null, unmatched}`. `unavailability()` returns `{available, reason(string|null)}`.

- [ ] **Step 1: Add schemas + keys**

```typescript
export const priceLatestSchema = z.union([
  z.object({
    found: z.literal(false),
    assetId: z.string(),
    reason: z.string(),
  }),
  z.object({
    found: z.literal(true),
    assetId: z.string(),
    priceUsd: z.number(),
    source: z.string(),
    capturedAt: z.string(),
    ageSeconds: z.number(),
    stale: z.boolean(),
  }),
]);

export const priceHistorySchema = z.array(
  z.object({
    priceUsd: z.union([z.string(), z.number()]),
    source: z.string(),
    capturedAt: z.string(),
  }),
);

export const priceRecordSchema = z.object({
  assetId: z.string(),
  priceUsd: z.union([z.string(), z.number()]),
  source: z.string(),
  capturedAt: z.string(),
});

export const eligibilitySchema = z.object({
  allowed: z.boolean(),
  canBuyCrypto: z.boolean(),
  canSellCrypto: z.boolean(),
  canUseMetals: z.boolean(),
  canRedeem: z.boolean(),
  kycRequired: z.boolean(),
  blockedProviders: z.array(z.string()),
  matchedRule: z
    .object({ country: z.string(), region: z.string().nullable() })
    .nullable(),
  unmatched: z.boolean(),
});

export const availabilitySchema = z.object({
  available: z.boolean(),
  reason: z.string().nullable(),
});
```

```typescript
'GET /api/v1/pricing/assets/:assetId': priceLatestSchema,
'GET /api/v1/pricing/assets/:assetId/history': priceHistorySchema,
'POST /api/v1/pricing/record': priceRecordSchema,
'GET /api/v1/compliance/eligibility': eligibilitySchema,
'GET /api/v1/onramp/availability': availabilitySchema,
```

- [ ] **Step 2: Rebuild contracts** (exit 0).
- [ ] **Step 3: ENDPOINTS rows (public routes ride the authed loop fine)**

```typescript
['GET /api/v1/compliance/eligibility', '/api/v1/compliance/eligibility?country=US'],
['GET /api/v1/onramp/availability', '/api/v1/onramp/availability?direction=buy&country=US'],
```

- [ ] **Step 4: Individual pricing round-trip test**

```typescript
it("pricing record → latest → history parses all three contracts", async () => {
  const assets = await request(app.getHttpServer())
    .get("/api/v1/assets")
    .set("Authorization", `Bearer ${token}`);
  const assetId = (assets.body as Array<{ asset: { assetId: string } }>)[0]
    ?.asset.assetId;
  expect(assetId).toBeTruthy();

  const rec = await request(app.getHttpServer())
    .post("/api/v1/pricing/record")
    .set("Authorization", `Bearer ${token}`)
    .send({
      assetId,
      priceUsd: 3125.5,
      source: `contract-fill-${process.pid}`,
    });
  expect(rec.status, JSON.stringify(rec.body)).toBe(201);
  expect(
    CONTRACT_REGISTRY["POST /api/v1/pricing/record"].safeParse(rec.body)
      .success,
  ).toBe(true);

  const latest = await request(app.getHttpServer())
    .get(`/api/v1/pricing/assets/${encodeURIComponent(assetId)}`)
    .set("Authorization", `Bearer ${token}`);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/pricing/assets/:assetId"].safeParse(
      latest.body,
    ).success,
  ).toBe(true);

  const hist = await request(app.getHttpServer())
    .get(
      `/api/v1/pricing/assets/${encodeURIComponent(assetId)}/history?limit=5`,
    )
    .set("Authorization", `Bearer ${token}`);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/pricing/assets/:assetId/history"].safeParse(
      hist.body,
    ).success,
  ).toBe(true);

  await prisma.assetPrice.deleteMany({
    where: { source: `contract-fill-${process.pid}` },
  });
});
```

- [ ] **Step 5: Run + commit** (same two commands + commit).

## Task 6: Portfolio (6 routes)

**Files:**

- Modify: `packages/contracts/src/schemas.ts`, `services/api/src/contracts.spec.ts`
- Test: same spec file

**Interfaces:**

- Produces: `portfolioSchema`, `allocationSchema`, `snapshotSchema`, keys for all six portfolio routes (`history`/`history-series` return arrays of one shared point shape)

`forWallet` returns `{totalUsd, pricedValueUsd, unpricedCount, holdings:[{assetId, symbol, name, category, balanceRaw, priceUsd|null, valueUsd|null, unpriced}], generatedAt, caveat}`. `forUser` returns `{wallets:[portfolio...], combinedUsd, unpricedCount}`. `allocation` returns `{pricedValueUsd, unpricedCount, byCategory:[{category, valueUsd, shareBps, assets:[{assetId, symbol, valueUsd, shareBps}]}], generatedAt}`. `capture` returns `{id, totalUsd(Decimal→string|number), capturedAt}`. `history` returns raw snapshot rows `[{totalUsd, breakdown(unknown), capturedAt}]`. `historySeries` returns `[{bucketStart, totalUsd, unpricedCount}]`.

- [ ] **Step 1: Add schemas + keys**

```typescript
export const portfolioHoldingSchema = z.object({
  assetId: z.string(),
  symbol: z.string(),
  name: z.string(),
  category: z.string(),
  balanceRaw: z.string(),
  priceUsd: z.string().nullable(),
  valueUsd: z.string().nullable(),
  unpriced: z.boolean(),
});

export const portfolioSchema = z.object({
  totalUsd: z.string(),
  pricedValueUsd: z.string(),
  unpricedCount: z.number().int(),
  holdings: z.array(portfolioHoldingSchema),
  generatedAt: z.string(),
  caveat: z.string(),
});

export const portfolioUserSchema = z.object({
  wallets: z.array(portfolioSchema),
  combinedUsd: z.string(),
  unpricedCount: z.number().int(),
});

export const allocationSchema = z.object({
  pricedValueUsd: z.string(),
  unpricedCount: z.number().int(),
  byCategory: z.array(
    z.object({
      category: z.string(),
      valueUsd: z.string(),
      shareBps: z.number().int(),
      assets: z.array(
        z.object({
          assetId: z.string(),
          symbol: z.string(),
          valueUsd: z.string(),
          shareBps: z.number().int(),
        }),
      ),
    }),
  ),
  generatedAt: z.string(),
});

export const snapshotSchema = z.object({
  id: z.string(),
  totalUsd: z.union([z.string(), z.number()]),
  capturedAt: z.string(),
});

export const historyPointSchema = z.object({
  bucketStart: z.string(),
  totalUsd: z.union([z.string(), z.number()]),
  unpricedCount: z.number().int(),
});

export const snapshotHistorySchema = z.array(
  z.object({
    totalUsd: z.union([z.string(), z.number()]),
    breakdown: z.unknown(),
    capturedAt: z.string(),
  }),
);
```

```typescript
'GET /api/v1/portfolio': portfolioUserSchema,
'GET /api/v1/portfolio/allocation': allocationSchema,
'GET /api/v1/portfolio/wallets/:walletId': portfolioSchema,
'GET /api/v1/portfolio/wallets/:walletId/history': snapshotHistorySchema,
'GET /api/v1/portfolio/wallets/:walletId/history-series': z.array(historyPointSchema),
'POST /api/v1/portfolio/wallets/:walletId/snapshot': snapshotSchema,
```

- [ ] **Step 2: Rebuild contracts** (exit 0).
- [ ] **Step 3: Individual portfolio flow test**

```typescript
it("portfolio aggregate → wallet → snapshot → history parses every contract", async () => {
  const address = `0x${"d".repeat(32)}${process.pid.toString(16).padStart(8, "0")}`;
  const reg = await request(app.getHttpServer())
    .post("/api/v1/wallets")
    .set("Authorization", `Bearer ${token}`)
    .send({
      chainId: "1",
      address,
      kind: "smart",
      label: "contract-fill-portfolio",
    });
  expect(reg.status).toBe(201);
  const walletId = reg.body.id as string;

  const agg = await request(app.getHttpServer())
    .get("/api/v1/portfolio")
    .set("Authorization", `Bearer ${token}`);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/portfolio"].safeParse(agg.body).success,
  ).toBe(true);

  const alloc = await request(app.getHttpServer())
    .get("/api/v1/portfolio/allocation")
    .set("Authorization", `Bearer ${token}`);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/portfolio/allocation"].safeParse(alloc.body)
      .success,
  ).toBe(true);

  const one = await request(app.getHttpServer())
    .get(`/api/v1/portfolio/wallets/${walletId}`)
    .set("Authorization", `Bearer ${token}`);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/portfolio/wallets/:walletId"].safeParse(
      one.body,
    ).success,
  ).toBe(true);

  const snap = await request(app.getHttpServer())
    .post(`/api/v1/portfolio/wallets/${walletId}/snapshot`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  expect(snap.status, JSON.stringify(snap.body)).toBe(201);
  expect(
    CONTRACT_REGISTRY[
      "POST /api/v1/portfolio/wallets/:walletId/snapshot"
    ].safeParse(snap.body).success,
  ).toBe(true);

  const hist = await request(app.getHttpServer())
    .get(`/api/v1/portfolio/wallets/${walletId}/history`)
    .set("Authorization", `Bearer ${token}`);
  expect(
    CONTRACT_REGISTRY[
      "GET /api/v1/portfolio/wallets/:walletId/history"
    ].safeParse(hist.body).success,
  ).toBe(true);

  const series = await request(app.getHttpServer())
    .get(`/api/v1/portfolio/wallets/${walletId}/history-series?bucket=day`)
    .set("Authorization", `Bearer ${token}`);
  expect(
    CONTRACT_REGISTRY[
      "GET /api/v1/portfolio/wallets/:walletId/history-series"
    ].safeParse(series.body).success,
  ).toBe(true);

  await prisma.portfolioSnapshot.deleteMany({ where: { walletId } });
  await prisma.wallet.deleteMany({ where: { id: walletId } });
});
```

- [ ] **Step 4: Run + commit** (same two commands + commit).

## Task 7: Swaps create + mine (2 routes)

**Files:**

- Modify: `packages/contracts/src/schemas.ts`, `services/api/src/contracts.spec.ts`
- Test: same spec file

**Interfaces:**

- Consumes: `quoteDetailSchema` (exists — `present()` output matches it exactly), Phase-0 seed assets
- Produces: `swapMineRowSchema`, keys `POST /api/v1/swaps/quotes`, `GET /api/v1/swaps/quotes/mine`

`list()` returns raw rows with includes: `{id, userId|null, railKind, railId, fromAsset{assetId,symbol,name}, toAsset(same), provider{slug,name,status}|null, fromAmountRaw, toAmountRaw, notionalUsd(Decimal), priceImpactBps, slippageBps, minReceivedRaw, fees(Json), executionQuality, sizeCapUsd(Decimal|null), state, expiresAt(Date), createdAt(Date), updatedAt(Date)}`. `createQuote` returns `present()` → `quoteDetailSchema`.

- [ ] **Step 1: Add schema + keys**

```typescript
export const swapMineRowSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  railKind: z.string(),
  railId: z.string(),
  fromAsset: z.object({
    assetId: z.string(),
    symbol: z.string(),
    name: z.string(),
  }),
  toAsset: z.object({
    assetId: z.string(),
    symbol: z.string(),
    name: z.string(),
  }),
  provider: z
    .object({ slug: z.string(), name: z.string(), status: z.string() })
    .nullable(),
  fromAmountRaw: z.string(),
  toAmountRaw: z.string(),
  notionalUsd: z.union([z.string(), z.number()]).nullable(),
  priceImpactBps: z.number().int(),
  slippageBps: z.number().int(),
  minReceivedRaw: z.string(),
  fees: z.unknown(),
  executionQuality: z.string(),
  sizeCapUsd: z.union([z.string(), z.number()]).nullable(),
  state: quoteStateSchema,
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

```typescript
'POST /api/v1/swaps/quotes': quoteDetailSchema,
'GET /api/v1/swaps/quotes/mine': z.array(swapMineRowSchema),
```

If `parse` fails on `walletId`/`txHash`/`settledAt` presence or absence, extend the schema with the observed optional fields — the schema follows the row, not the reverse. (Review Focus 1: Decimals stay union-typed.)

- [ ] **Step 2: Rebuild contracts** (exit 0).
- [ ] **Step 3: Individual quote test with seed assets**

```typescript
it("swap quote create → mine parses both contracts", async () => {
  const assets = await request(app.getHttpServer())
    .get("/api/v1/assets")
    .set("Authorization", `Bearer ${token}`);
  const ids = (assets.body as Array<{ asset: { assetId: string } }>).map(
    (a) => a.asset.assetId,
  );
  expect(ids.length).toBeGreaterThanOrEqual(2);
  const [from, to] = [ids[0]!, ids[1]!];

  const q = await request(app.getHttpServer())
    .post("/api/v1/swaps/quotes")
    .set("Authorization", `Bearer ${token}`)
    .send({ fromAssetId: from, toAssetId: to, fromAmountRaw: "1000000" });
  expect(q.status, JSON.stringify(q.body)).toBe(201);
  expect(
    CONTRACT_REGISTRY["POST /api/v1/swaps/quotes"].safeParse(q.body).success,
  ).toBe(true);

  const mine = await request(app.getHttpServer())
    .get("/api/v1/swaps/quotes/mine")
    .set("Authorization", `Bearer ${token}`);
  const found = (mine.body as Array<{ id: string }>).find(
    (r) => r.id === q.body.id,
  );
  expect(found).toBeDefined();
  expect(
    CONTRACT_REGISTRY["GET /api/v1/swaps/quotes/mine"].safeParse(mine.body)
      .success,
  ).toBe(true);

  await prisma.swapQuote.deleteMany({ where: { id: q.body.id } });
});
```

If the two seed assets share a chain-disabled state or either is disabled, `createQuote` refuses with 400 — read the refusal, and if the seed cannot serve, create two pid-unique assets on chain `1` through the compliance-satisfying admin token (pattern from Task 4) and delete them after. Record whichever path was taken.

- [ ] **Step 4: Run + commit** (same two commands + commit).

## Task 8: Transactions intent flow (3 routes) + build/broadcast ERROR (2 routes)

**Files:**

- Modify: `packages/contracts/src/schemas.ts`, `services/api/src/contracts.spec.ts`
- Test: same spec file

**Interfaces:**

- Consumes: `transactionRowSchema` (exists — `create` returns the presented row; verify at runtime), Phase-0 seed transferable asset
- Produces: key `POST /api/v1/transactions` (= `transactionRowSchema` — confirm by parse, add alias only if it diverges), `ERROR POST /api/v1/transactions/:id/build`, `ERROR POST /api/v1/transactions/:id/broadcast`, keys `POST /api/v1/transactions/:id/transitions`, `POST /api/v1/transactions/:id/observations`

`create` returns the row `present()`ed like list rows — parse against `transactionRowSchema` first; only add a new schema if it diverges. `observe` returns the updated row — same treatment. `transition` returns the updated row — same treatment. `assemble` without RPC fails with `assemblyFailure` (503) or 400 — pin the actual envelope with an ERROR entry asserting status AND `code`. `relay` with a non-hex payload fails the shape pipe (422 `validation_failed`).

- [ ] **Step 1: Add ERROR entries (+ alias only on divergence)**

```typescript
'ERROR POST /api/v1/transactions/:id/build': errorSchema,
'ERROR POST /api/v1/transactions/:id/broadcast': errorSchema,
```

(`errorSchema` exists — `{error: {code, message, detail?}}`. If its exact shape differs, read it and mirror it here before writing.)

- [ ] **Step 2: Rebuild contracts** (exit 0).
- [ ] **Step 3: Individual intent flow test**

```typescript
it("transaction intent → transition → observe parses rows; build/broadcast pin their refusals", async () => {
  const address = `0x${"e".repeat(32)}${process.pid.toString(16).padStart(8, "0")}`;
  const reg = await request(app.getHttpServer())
    .post("/api/v1/wallets")
    .set("Authorization", `Bearer ${token}`)
    .send({ chainId: "1", address, kind: "smart", label: "contract-fill-tx" });
  expect(reg.status).toBe(201);

  const assets = await request(app.getHttpServer())
    .get("/api/v1/assets?chainId=1")
    .set("Authorization", `Bearer ${token}`);
  const assetId = (assets.body as Array<{ asset: { assetId: string } }>)[0]
    ?.asset.assetId;
  expect(assetId).toBeTruthy();

  const created = await request(app.getHttpServer())
    .post("/api/v1/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      walletId: reg.body.id,
      assetId,
      amountRaw: "1000",
      destination: `0x${"f".repeat(40)}`,
    });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/transactions/:id"].safeParse(created.body)
      .success,
  ).toBe(true);
  const txId = created.body.id as string;

  // `created: ['pending', 'failed']` is the lifecycle table's word (transaction-lifecycle.ts),
  // not a guess — an illegal edge would 400 here.
  const moved = await request(app.getHttpServer())
    .post(`/api/v1/transactions/${txId}/transitions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      to: "failed",
      errorCode: "contract-fill",
      errorMessage: "fixture, never broadcast",
    });
  expect(moved.status, JSON.stringify(moved.body)).toBe(200);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/transactions/:id"].safeParse(moved.body)
      .success,
  ).toBe(true);

  const build = await request(app.getHttpServer())
    .post(`/api/v1/transactions/${txId}/build`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  expect(build.status).toBe(503);
  const buildParsed = CONTRACT_REGISTRY[
    "ERROR POST /api/v1/transactions/:id/build"
  ].safeParse(build.body);
  expect(buildParsed.success).toBe(true);
  expect(build.body.error.code).not.toBe("internal");

  const badBroadcast = await request(app.getHttpServer())
    .post(`/api/v1/transactions/${txId}/broadcast`)
    .set("Authorization", `Bearer ${token}`)
    .send({ signed: "not-hex" });
  expect(badBroadcast.status).toBe(422);
  expect(badBroadcast.body.error.code).toBe("validation_failed");

  await prisma.transaction.deleteMany({ where: { id: txId } });
  await prisma.wallet.deleteMany({ where: { id: reg.body.id } });
});
```

If `build` answers 400 instead of 503 (the `assemblyFailure` 503/400 split), pin the observed status and code — the test asserts what the service does, and the ERROR entry covers both via the shared envelope. If `observe` is exercised instead of `transition`, it needs operator role (admin satisfies) plus `{txHash (hex), confirmations}` — keep `transition` as the row-update pin; observations already have dedicated specs.

- [ ] **Step 4: Run + commit** (same two commands + commit).

## Task 9: Notifications mine/enqueue (2 routes) + users PATCH (2) + audit actor (1)

**Files:**

- Modify: `packages/contracts/src/schemas.ts`, `services/api/src/contracts.spec.ts`
- Test: same spec file

**Interfaces:**

- Consumes: `userDetailSchema`, `auditListSchema` (exist — PATCH role/status return `findById`; `forActor` returns presented rows)
- Produces: `notificationMineRowSchema`, keys `GET /api/v1/notifications/mine`, `POST /api/v1/notifications`

`listForUser`/`enqueue` return the raw row: `{id, userId, channel, template, payload(Json), sentAt(Date|null), failedAt(Date|null), error(string|null), createdAt(Date)}`.

- [ ] **Step 1: Add schema + keys**

```typescript
export const notificationMineRowSchema = z.object({
  id: z.string(),
  userId: z.string(),
  channel: z.string(),
  template: z.string(),
  payload: z.record(z.string(), z.unknown()),
  sentAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
});
```

```typescript
'GET /api/v1/notifications/mine': z.array(notificationMineRowSchema),
'POST /api/v1/notifications': notificationMineRowSchema,
```

- [ ] **Step 2: Rebuild contracts** (exit 0).
- [ ] **Step 3: Individual tests (enqueue → mine → delete; role flip with restore; actor view)**

```typescript
it("notification enqueue → mine parses, then the row is deleted", async () => {
  const template = `c-fill-${process.pid}`;
  const enq = await request(app.getHttpServer())
    .post("/api/v1/notifications")
    .set("Authorization", `Bearer ${token}`)
    .send({ channel: "email", template, payload: {} });
  expect(enq.status, JSON.stringify(enq.body)).toBe(201);
  expect(
    CONTRACT_REGISTRY["POST /api/v1/notifications"].safeParse(enq.body).success,
  ).toBe(true);

  const mine = await request(app.getHttpServer())
    .get("/api/v1/notifications/mine")
    .set("Authorization", `Bearer ${token}`);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/notifications/mine"].safeParse(mine.body)
      .success,
  ).toBe(true);
  expect(
    (mine.body as Array<{ template: string }>).some(
      (n) => n.template === template,
    ),
  ).toBe(true);

  await prisma.notification.deleteMany({ where: { template } });
});

it("user role and status flip and restore in-test", async () => {
  const email = `c-fill-u-${process.pid}@example.test`;
  const reg = await request(app.getHttpServer())
    .post("/api/v1/auth/register")
    .send({ email, password: "correct-horse-battery-staple-extra" });
  expect(reg.status).toBe(201);
  const id = reg.body.user.id as string;

  const role = await request(app.getHttpServer())
    .patch(`/api/v1/users/${id}/role`)
    .set("Authorization", `Bearer ${token}`)
    .send({ role: "support" });
  expect(role.status).toBe(200);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/users/:id"].safeParse(role.body).success,
  ).toBe(true);

  const back = await request(app.getHttpServer())
    .patch(`/api/v1/users/${id}/role`)
    .set("Authorization", `Bearer ${token}`)
    .send({ role: "user" });
  expect(back.body.role).toBe("user");

  const actor = await request(app.getHttpServer())
    .get(`/api/v1/audit/actor/${id}`)
    .set("Authorization", `Bearer ${token}`);
  expect(actor.status).toBe(200);
  expect(
    CONTRACT_REGISTRY["GET /api/v1/audit"].safeParse(actor.body).success,
  ).toBe(true);

  await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.user.deleteMany({ where: { id } });
});
```

The actor view returns presented rows — the same array shape as `GET /audit`, so no new schema. (If `forActor` ever diverges, add one then.)

- [ ] **Step 4: Run + commit** (same two commands + commit).

## Task 10: Vendor-dependent, probes, and refusals

**Files:**

- Modify: `packages/contracts/src/schemas.ts`, `services/api/src/contracts.spec.ts`
- Test: same spec file

**Interfaces:**

- Consumes: `jobRunSchema` (exists — `runNow` returns the run view), `SCREENING_PROVIDER` token + `FakeScreeningProvider` (for scripting, not for asserting vendor behavior)
- Produces: `startVerificationSchema`, `syncResultSchema`, `healthLiveSchema`, `healthReadySchema`, keys `POST /api/v1/compliance/verification/start`, `ERROR POST /api/v1/compliance/webhooks/persona`, `POST /api/v1/blockchain/wallets/:walletId/sync`, `POST /api/v1/jobs/:name/run` (= `jobRunSchema`), `GET /api/v1/health/live`, `GET /api/v1/health/ready`, `ERROR POST /api/v1/onramp/quote`

`startVerification` returns `{status:'pending', inquiryId, sessionToken}`. `syncWallet` returns `{walletId, chainId, assetsChecked(number), updated:[{assetId, balanceRaw, formatted}], errors:string[], syncedAt(ISO)}` — RPC failures land in `errors`, not in the status code. `live()` returns `{status:'ok', uptimeSeconds(number)}`. `ready()` returns `{status:'ok'|'degraded', dependencies:{database:{status:'up'|'down',latencyMs}, redis:{...}}}`.

- [ ] **Step 1: Add schemas + keys**

```typescript
export const startVerificationSchema = z.object({
  status: z.string(),
  inquiryId: z.string(),
  sessionToken: z.string(),
});

export const syncResultSchema = z.object({
  walletId: z.string(),
  chainId: z.string(),
  assetsChecked: z.number().int(),
  updated: z.array(
    z.object({
      assetId: z.string(),
      balanceRaw: z.string(),
      formatted: z.string(),
    }),
  ),
  errors: z.array(z.string()),
  syncedAt: z.string(),
});

export const healthLiveSchema = z.object({
  status: z.literal("ok"),
  uptimeSeconds: z.number(),
});

export const healthReadySchema = z.object({
  status: z.enum(["ok", "degraded"]),
  dependencies: z.object({
    database: z.object({
      status: z.enum(["up", "down"]),
      latencyMs: z.number(),
    }),
    redis: z.object({ status: z.enum(["up", "down"]), latencyMs: z.number() }),
  }),
});
```

```typescript
'POST /api/v1/compliance/verification/start': startVerificationSchema,
'ERROR POST /api/v1/compliance/webhooks/persona': errorSchema,
'POST /api/v1/blockchain/wallets/:walletId/sync': syncResultSchema,
'POST /api/v1/jobs/:name/run': jobRunSchema,
'GET /api/v1/health/live': healthLiveSchema,
'GET /api/v1/health/ready': healthReadySchema,
'ERROR POST /api/v1/onramp/quote': errorSchema,
```

- [ ] **Step 2: Rebuild contracts** (exit 0).
- [ ] **Step 3: ENDPOINTS rows**

```typescript
['GET /api/v1/health/live', '/api/v1/health/live'],
['GET /api/v1/health/ready', '/api/v1/health/ready'],
```

(Review Focus 4: `uptimeSeconds`/`latencyMs` are `z.number()`, never exact values.)

- [ ] **Step 4: Individual tests**

```typescript
it("verification start parses when the fake is scripted for the admin", async () => {
  const { SCREENING_PROVIDER } =
    await import("../compliance/screening/screening-provider.js");
  const { FakeScreeningProvider } =
    await import("../compliance/screening/fake-screening.provider.js");
  const screening = app.get<FakeScreeningProvider>(SCREENING_PROVIDER);
  if (screening instanceof FakeScreeningProvider) {
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);
    screening.scriptCreate(me.body.id, {
      inquiryId: `inq-c-${process.pid}`,
      sessionToken: "sess-contract",
    });
  }
  const start = await request(app.getHttpServer())
    .post("/api/v1/compliance/verification/start")
    .set("Authorization", `Bearer ${token}`)
    .send({});
  expect(start.status, JSON.stringify(start.body)).toBe(201);
  expect(
    CONTRACT_REGISTRY["POST /api/v1/compliance/verification/start"].safeParse(
      start.body,
    ).success,
  ).toBe(true);
  await prisma.kycProfile.deleteMany({
    where: { providerRef: `inq-c-${process.pid}` },
  });
});
```

If the provider resolves to Persona (vendor configured) instead of the fake, this test fails on a live vendor call — that failure is a finding, not a flake: record a ruling and pin the ERROR 503 envelope instead. Do not script Persona.

```typescript
it("unsigned webhook and provider-less quote pin their refusal envelopes", async () => {
  const hook = await request(app.getHttpServer())
    .post("/api/v1/compliance/webhooks/persona")
    .send({ data: {} });
  expect(hook.status).toBe(401);
  expect(
    CONTRACT_REGISTRY[
      "ERROR POST /api/v1/compliance/webhooks/persona"
    ].safeParse(hook.body).success,
  ).toBe(true);

  const quote = await request(app.getHttpServer())
    .post("/api/v1/onramp/quote")
    .set("Authorization", `Bearer ${token}`)
    .send({ assetId: "1:0x0:gold", amountUsd: 100, country: "US" });
  expect(quote.status).toBe(503);
  expect(quote.body.error.code).toBe("provider_unavailable");
  expect(
    CONTRACT_REGISTRY["ERROR POST /api/v1/onramp/quote"].safeParse(quote.body)
      .success,
  ).toBe(true);
});
```

If the webhook answers a different 4xx, pin the observed status — the test asserts what the route does. The `code` assertion is the point (Review Focus 3).

```typescript
it("chain sync and the safe job run parse", async () => {
  const address = `0x${"a".repeat(32)}${process.pid.toString(16).padStart(8, "0")}`;
  const reg = await request(app.getHttpServer())
    .post("/api/v1/wallets")
    .set("Authorization", `Bearer ${token}`)
    .send({
      chainId: "1",
      address,
      kind: "smart",
      label: "contract-fill-sync",
    });
  expect(reg.status).toBe(201);

  const sync = await request(app.getHttpServer())
    .post(`/api/v1/blockchain/wallets/${reg.body.id}/sync`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  expect(sync.status, JSON.stringify(sync.body)).toBe(200);
  expect(
    CONTRACT_REGISTRY[
      "POST /api/v1/blockchain/wallets/:walletId/sync"
    ].safeParse(sync.body).success,
  ).toBe(true);

  // `idempotency.purge` touches only expired idempotency rows: the one job
  // safe to fire from a contract suite. Never substitute a chain-scanning
  // or vendor-calling job here.
  const run = await request(app.getHttpServer())
    .post("/api/v1/jobs/idempotency.purge/run")
    .set("Authorization", `Bearer ${token}`)
    .send({});
  expect(run.status, JSON.stringify(run.body)).toBe(200);
  expect(
    CONTRACT_REGISTRY["POST /api/v1/jobs/:name/run"].safeParse(run.body)
      .success,
  ).toBe(true);

  await prisma.wallet.deleteMany({ where: { id: reg.body.id } });
});
```

- [ ] **Step 5: Run + commit** (same two commands + commit).

## Task 11: Flip BE-1705 shut

- [ ] **Step 1: Re-derive the gap**

Run the route dump from Task 0 (adapted: compare `*.controller.ts` routes against `CONTRACT_REGISTRY` keys, treating bodyless 204s and `:param` renames as covered).
Expected: zero uncovered routes with a response body, plus the three recorded 204 exceptions.

- [ ] **Step 2: Update the tracker**

In `docs/agent/BACKEND_TASKS.md` BE-1705: replace the missing-list with the completion note (counts per task, ERROR-envelope exceptions named), set `**Status:** \`DONE\``, and recompute §21 with `node scripts/check-task-counts.mjs` until it exits 0.

- [ ] **Step 3: Full verification + commit**

Run: `pnpm test` (whole monorepo, exit 0), `pnpm --filter @correnthian/api typecheck` (exit 0), `node scripts/check-task-counts.mjs` (exit 0). Commit trackers (docs-only commit).

---

## Self-review

**1. Spec coverage:** BE-1705's unblock condition (one entry per route + live parse) is owned per route: Tasks 1–9 cover all body-carrying routes except the vendor-dependent five in Task 10 (start, webhook, sync, run, quote) plus probes/eligibility/availability; Task 10 covers those; Task 11 verifies zero remain. The three bodyless 204s are recorded exceptions, not gaps. No spec section without an owning task.

**2. Placeholder scan:** no TBD/TODO/later; every schema block is complete code; every test block is complete code; no "similar to Task N" (the repeated run/commit commands are commands, not code). Two conditional branches are specified with exact fallbacks (Task 7 disabled-seed path; Task 10 Persona-instead-of-fake ruling) — decisions with recorded outcomes, not placeholders.

**3. Type consistency:** `CONTRACT_REGISTRY['METHOD /path']` keys match the `Contract<>` type param style used by admin pages; `safeParse(...).success` assertions match the existing ENDPOINTS loop; `prisma`/`token`/`app` variable names match contracts.spec's existing scope (executor verifies the names in Step 4 of Task 1 and reuses them); `process.pid` fixture-suffixing matches every HTTP suite; Redis DB 0 is the next free index per the plan constraints (16–1 taken).

**4. Review Focus:** all five lines name their owning task (7, tasks 2/4/6/7/8/9, 8+10, 10, 3/5/9). No empty section.
