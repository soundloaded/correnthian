# Follow-up Slice Implementation Plan (2026-10-11)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining implementable gaps behind BE-1705: the untested notification service methods, the untested contracts package, and the two deferred review minors — with user-gated follow-ons recorded as triggers, not started.

**Architecture:** Same engines, no new surfaces: fake-store unit specs for the service, pure-Zod specs inside the contracts package, a bounded cursor loop for the sweep, and a pure message builder for admin errors. No route, schema, or status-code changes except additive test files (plus the two small production edits Tasks 3–4 require).

**Tech Stack:** TypeScript; vitest (API + admin + contracts package); Zod 4.6.5; Prisma 7.

**Spec:** `docs/agent/BACKEND_TASKS.md` (BE-1702 gaps, DEF-009, BE-1102) · `docs/superpowers/plans/2026-10-11-be-1705-contract-fill.md` (the slice this follows)

## Global Constraints

- Node 22+ and pnpm 10+. API specs: `pnpm --filter @correnthian/api exec vitest run <path>`; admin: `pnpm --filter @correnthian/admin exec vitest run <path>`; contracts: `pnpm --filter @correnthian/contracts exec vitest run <path>`.
- The contracts package builds to `dist/` and forbids `z.bigint()` anywhere (openapi converts the registry via `z.toJSONSchema` — BigInt has no JSON Schema representation and fails the suite).
- New API HTTP suites get their own Redis DB index — but Tasks 1–4 need no HTTP suites (unit specs only). If one becomes necessary, next free is DB 0 only if unused; check first.
- Money stays decimal strings; dates stay ISO strings; Decimals stay string|number unions.
- Fixture pid-uniqueness and in-test cleanup apply wherever rows are created (Task 1 creates none — fake store only).
- No invented amounts, vendors, prices, or users. No `prisma migrate dev` (no schema changes in this slice).
- Commit per task with a why-message + the harness attribution line.

## Review Focus

1. A fake that returns canned rows without evaluating the query clause blesses any filter — fakes must evaluate `where` for real (the rescreen-job and listAll specs are the pattern). Pinned in Task 1.
2. A schema test that only parses valid payloads proves the schema accepts everything — every schema gets at least one malformed-input rejection. Pinned in Task 2.
3. A cursor loop that ignores the deadline/abort signal runs past its budget — the loop checks both every page. Pinned in Task 3.
4. An error builder that echoes raw server detail leaks internals into the UI — only `path` + `message` of the first validation issue cross, never values or stacks. Pinned in Task 4.
5. A gated task started before its trigger invents the missing input — Tasks 5's triggers are verifiable artifacts (account credentials, a written paragraph, a recorded decision), never assumptions. No test pins this; the ledger does.

---

## File Map

- Task 1 creates `services/api/src/notifications/notifications.service.spec.ts`; touches nothing else.
- Task 2 creates `packages/contracts/src/*.spec.ts` (2–3 files), adds `packages/contracts/tsconfig.tests.json`, extends the `typecheck` script exactly like `packages/blockchain` does.
- Task 3 modifies `services/api/src/jobs/attestation-freshness.job.ts` + its spec.
- Task 4 creates `apps/admin/src/lib/api-error.ts` + spec, modifies `api-server.ts` (one call site).
- Task 5 modifies nothing until triggered (triggers listed inside).

---

## Phase 0 — User track (no code; acceptance criteria only)

Parallel to all code. Code tasks naming these triggers must not start before them.

- [ ] **0.1 BE-1102 rules paragraph.** Acceptance: a written paragraph with thresholds, windows, and action-on-flag. Unblocks risk-rule build (gated Task 5a).
- [ ] **0.2 BE-203b recovery choice.** Acceptance: one of the four options in `key-boundary.md` recorded. Unblocks custody Task 2.5 step 3.
- [ ] **0.3 ADR-022 build choices.** Acceptance: account implementation + EntryPoint recorded. Unblocks Task 2.5 step 4.
- [ ] **0.4 Counsel answers + RPC/issuer/vendor accounts.** Acceptance: buy-flow answers recorded; RPC endpoints answering; issuer term sheet open; price-feed key in env. Unblock sync success pin (gated Task 5b), pricing feed, metals buy.

---

## Task 1: notifications.service unit spec

**Files:**

- Create: `services/api/src/notifications/notifications.service.spec.ts`

**Interfaces:**

- Consumes: `NotificationsService` (enqueue, listForUser, claimBatch, markSent, markFailed, stats)
- Produces: nothing (leaf coverage)

`enqueue` creates `{userId, channel, template, payload}`. `listForUser` filters by user, capped at 200. `claimBatch` returns pending oldest-first, capped — and marks nothing (DEF-009: no claim exists, so two workers receive the same rows; the spec pins the honest behavior, not the missing lease). `markSent` stamps `sentAt`; `markFailed` stamps `failedAt` + truncates `error` at 500 chars. `stats` counts total/pending/sent/failed.

- [ ] **Step 1: Write the failing spec**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotificationsService } from "./notifications.service.js";

type Row = Record<string, unknown>;

function makePrisma() {
  const rows: Row[] = [];
  return {
    rows,
    notification: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = {
          id: `n${rows.length + 1}`,
          sentAt: null,
          failedAt: null,
          error: null,
          createdAt: new Date(),
          ...data,
        };
        rows.push(row);
        return { ...row };
      }),
      findMany: vi.fn(
        async (
          args: { where?: Row; orderBy?: unknown; take?: number } = {},
        ) => {
          // Evaluated for real: claimBatch's pending filter and listForUser's
          // owner filter are the properties under test, and a canned list
          // cannot fail them.
          let out = rows.map((r) => ({ ...r }));
          const where = args.where ?? {};
          if (typeof where["userId"] === "string")
            out = out.filter((r) => r["userId"] === where["userId"]);
          if (where["sentAt"] === null && where["failedAt"] === null) {
            out = out.filter(
              (r) => r["sentAt"] === null && r["failedAt"] === null,
            );
          }
          if (args.take) out = out.slice(0, args.take);
          return out;
        },
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Row }) => {
          const row = rows.find((r) => r["id"] === where.id);
          if (!row)
            throw Object.assign(new Error("record not found"), {
              code: "P2025",
            });
          Object.assign(row, data);
          return { ...row };
        },
      ),
      count: vi.fn(async (args: { where?: Row } = {}) => {
        const where = args.where ?? {};
        if (where["sentAt"] === null && where["failedAt"] === null) {
          return rows.filter(
            (r) => r["sentAt"] === null && r["failedAt"] === null,
          ).length;
        }
        if ((where["sentAt"] as Row | undefined)?.["not"] === null)
          return rows.filter((r) => r["sentAt"] !== null).length;
        if ((where["failedAt"] as Row | undefined)?.["not"] === null)
          return rows.filter((r) => r["failedAt"] !== null).length;
        return rows.length;
      }),
    },
  };
}

const svc = (p: ReturnType<typeof makePrisma>) =>
  new NotificationsService(p as never);

describe("notification queue methods", () => {
  it("enqueue stores channel, template and payload", async () => {
    const p = makePrisma();
    const row = await svc(p).enqueue({
      userId: "u1",
      channel: "email",
      template: "t",
      payload: { a: 1 },
    });
    expect(row).toMatchObject({
      userId: "u1",
      channel: "email",
      template: "t",
    });
  });

  it("listForUser sees only the caller rows", async () => {
    const p = makePrisma();
    const s = svc(p);
    await s.enqueue({
      userId: "u1",
      channel: "email",
      template: "a",
      payload: {},
    });
    await s.enqueue({
      userId: "u2",
      channel: "email",
      template: "b",
      payload: {},
    });
    expect((await s.listForUser("u1")).map((r) => r["template"])).toEqual([
      "a",
    ]);
  });

  it("claimBatch returns pending oldest-first and marks nothing", async () => {
    const p = makePrisma();
    const s = svc(p);
    await s.enqueue({
      userId: "u1",
      channel: "email",
      template: "a",
      payload: {},
    });
    await s.markSent(p.rows[0]!["id"] as string);
    await s.enqueue({
      userId: "u1",
      channel: "email",
      template: "b",
      payload: {},
    });
    const batch = await s.claimBatch();
    expect(batch.map((r) => r["template"])).toEqual(["b"]);
    // No claim exists: a second worker receives the same rows (DEF-009).
    expect(await s.claimBatch()).toEqual(batch);
  });

  it("markFailed stamps the error truncated at 500 chars", async () => {
    const p = makePrisma();
    const s = svc(p);
    await s.enqueue({
      userId: "u1",
      channel: "email",
      template: "a",
      payload: {},
    });
    await s.markFailed(p.rows[0]!["id"] as string, "x".repeat(600));
    expect((p.rows[0]!["error"] as string).length).toBe(500);
    expect(p.rows[0]!["failedAt"]).toBeInstanceOf(Date);
  });

  it("stats counts all four buckets", async () => {
    const p = makePrisma();
    const s = svc(p);
    await s.enqueue({
      userId: "u1",
      channel: "email",
      template: "a",
      payload: {},
    });
    await s.enqueue({
      userId: "u1",
      channel: "email",
      template: "b",
      payload: {},
    });
    await s.markSent(p.rows[0]!["id"] as string);
    await s.markFailed(p.rows[1]!["id"] as string, "bounce");
    expect(await s.stats()).toEqual({
      total: 2,
      pending: 0,
      sent: 1,
      failed: 1,
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @correnthian/api exec vitest run src/notifications/notifications.service.spec.ts`
Expected: FAIL with "Cannot find module './notifications.service.js'" — wait, the service exists. This spec pins existing behavior, so it should PASS on first run. That is correct here: these are characterization pins, not bug-driven tests. The RED proof for this task comes from Step 3's mutation round instead (each mutant must fail). Record that substitution in the ledger.

- [ ] **Step 3: Mutation round**

Mutants (apply one at a time with `cp` backup/restore, expecting exactly the named test to fail):

1. `claimBatch` where → `{}` (drops the pending filter): "claimBatch" test must fail (returns the sent row too).
2. `markFailed` error slice `500` → `50`: truncation test must fail.
3. `stats` pending count where → `{}`: stats test must fail.
   Restore after each; final run green.

- [ ] **Step 4: Run + typecheck + commit**

Run: `pnpm --filter @correnthian/api exec vitest run src/notifications/` then `pnpm --filter @correnthian/api typecheck` (direct exit code, never through `tail`).
Expected: PASS, exit 0. Then commit with why-message + attribution line.

## Task 2: Contracts package specs

**Files:**

- Create: `packages/contracts/src/schemas.contract.spec.ts` (new BE-1705 schemas), `packages/contracts/src/envelope.spec.ts` (error + idempotency envelopes)
- Create: `packages/contracts/tsconfig.tests.json` (mirror `packages/blockchain/tsconfig.tests.json`)
- Modify: `packages/contracts/package.json` (`typecheck` gains `&& tsc -p tsconfig.tests.json`, exactly like blockchain)

**Interfaces:**

- Consumes: schemas from `./schemas.js` (note `.js` suffix under vitest, matching the API specs)
- Produces: nothing (leaf coverage)

Scope discipline: only the schemas BE-1705 added (wallet list/portfolio/balance/register, device mine, auth session/me, chain detail, provider health, issuer write/detail/stats, price latest/history/record, eligibility, availability, portfolio set, swap mine row, transaction raw row, notification rows, review queue, decide, start verification, sync result, health live/ready) plus the two envelopes. Pre-existing schemas (quote detail, fee breakdown) already have indirect coverage; re-pinning the world is out of scope.

- [ ] **Step 1: Write the spec files**

```typescript
// schemas.contract.spec.ts
import { describe, expect, it } from "vitest";
import {
  priceLatestSchema,
  eligibilitySchema,
  walletRegisterSchema,
  issuerWriteSchema,
  transactionRawRowSchema,
  startVerificationSchema,
  healthReadySchema,
} from "./schemas.js";

describe("BE-1705 schemas accept the documented shape", () => {
  it("price latest accepts both union arms", () => {
    expect(
      priceLatestSchema.safeParse({ found: false, assetId: "a", reason: "r" })
        .success,
    ).toBe(true);
    expect(
      priceLatestSchema.safeParse({
        found: true,
        assetId: "a",
        priceUsd: 1.5,
        source: "s",
        capturedAt: new Date().toISOString(),
        ageSeconds: 3,
        stale: false,
      }).success,
    ).toBe(true);
  });

  it("wallet registration rejects the detail shape it does not answer", () => {
    // The split exists because the create select lacks deployed/createdAt/
    // display — this test is the split. If the service ever returns the full
    // row here, this fails and the schemas reunite deliberately, not by drift.
    expect(
      walletRegisterSchema.safeParse({
        id: "w",
        address: "0x0",
        chainId: "1",
        kind: "smart",
        label: null,
        guardians: [],
        isPrimary: true,
      }).success,
    ).toBe(true);
    expect(
      walletRegisterSchema.safeParse({
        id: "w",
        address: "0x0",
        chainId: "1",
        kind: "seedling",
        label: null,
        guardians: [],
        isPrimary: true,
      }).success,
    ).toBe(false);
  });

  it("issuer writes reject the counts only reads carry", () => {
    const row = {
      id: "i",
      slug: "s",
      name: "n",
      jurisdiction: "US",
      licenseTypes: [],
      licenseRefs: [],
      website: null,
      verifiedTier: "unverified",
      riskFlags: [],
      notes: null,
      createdAt: new Date().toISOString(),
    };
    expect(issuerWriteSchema.safeParse(row).success).toBe(true);
    expect(
      issuerWriteSchema.safeParse({ ...row, verifiedTier: "issuer-blessed" })
        .success,
    ).toBe(false);
  });

  it("raw transaction rows accept string-or-number Decimals and ISO dates", () => {
    const base = {
      id: "t",
      userId: "u",
      walletId: "w",
      assetId: "s",
      chainId: "1",
      providerId: null,
      destination: null,
      txHash: null,
      direction: "out",
      state: "created",
      amountRaw: "1",
      amountUsd: null,
      feeRaw: null,
      feeUsd: null,
      blockNumber: "12345",
      confirmations: 0,
      requiredConfirmations: 12,
      droppedAt: null,
      dropCount: 0,
      lastSeenAt: null,
      errorCode: null,
      errorMessage: null,
      expiresAt: null,
      signedAt: null,
      broadcastAt: null,
      confirmedAt: null,
      failedAt: null,
      blockTime: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(transactionRawRowSchema.safeParse(base).success).toBe(true);
    expect(
      transactionRawRowSchema.safeParse({ ...base, direction: "sideways" })
        .success,
    ).toBe(false);
  });

  it("start verification and readiness accept their shapes", () => {
    expect(
      startVerificationSchema.safeParse({
        status: "pending",
        inquiryId: "i",
        sessionToken: "s",
      }).success,
    ).toBe(true);
    expect(
      healthReadySchema.safeParse({
        status: "ok",
        dependencies: {
          database: { status: "up", latencyMs: 3 },
          redis: { status: "up", latencyMs: 1 },
        },
      }).success,
    ).toBe(true);
    expect(
      healthReadySchema.safeParse({ status: "ok", dependencies: {} }).success,
    ).toBe(false);
  });

  it("eligibility mirrors the engine field for field", () => {
    expect(
      eligibilitySchema.safeParse({
        allowed: false,
        canBuyCrypto: false,
        canSellCrypto: false,
        canUseMetals: false,
        canRedeem: false,
        kycRequired: true,
        blockedProviders: [],
        matchedRule: null,
        unmatched: true,
      }).success,
    ).toBe(true);
  });
});
```

```typescript
// envelope.spec.ts
import { describe, expect, it } from "vitest";
import { errorSchema, idempotencyConflictSchema } from "./schemas.js";

describe("error envelopes", () => {
  it("the shared envelope requires code, message, path and timestamp", () => {
    const base = {
      error: { code: "not_found", message: "nope" },
      path: "/x",
      timestamp: new Date().toISOString(),
    };
    expect(errorSchema.safeParse(base).success).toBe(true);
    expect(
      errorSchema.safeParse({ ...base, error: { code: "not_found" } }).success,
    ).toBe(false);
  });

  it("idempotency conflicts name a reason from the closed set", () => {
    expect(
      idempotencyConflictSchema.safeParse({
        error: {
          code: "conflict",
          message: "m",
          detail: { reason: "in_progress" },
        },
        path: "/x",
        timestamp: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });
});
```

(Review Focus 2: every schema gets its malformed twin. If a field name in the plan mismatches the source, read `schemas.ts` — the file wins, and the ledger records the correction.)

- [ ] **Step 2: Wire tsconfig + script**

`tsconfig.tests.json` (byte-identical shape to blockchain's):

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

`package.json` typecheck becomes `tsc -p tsconfig.package.json --noEmit && tsc -p tsconfig.tests.json`.

- [ ] **Step 3: Run + commit**

Run: `pnpm --filter @correnthian/contracts exec vitest run src` then `pnpm --filter @correnthian/contracts typecheck` (direct exit codes).
Expected: PASS, exit 0. Then commit with why-message + attribution line.

## Task 3: Attestation sweep pagination (deferred minor 1)

**Files:**

- Modify: `services/api/src/jobs/attestation-freshness.job.ts`, `services/api/src/jobs/attestation-freshness.job.spec.ts`

**Interfaces:**

- Consumes: `ctx.now`, `ctx.signal`, `ctx.deadline` (check `JobContext` in `services/api/src/jobs/job.ts` for exact fields before writing — the rescreen spec builds `{now, deadline, signal, trigger}`)
- Produces: same `JobOutcome` shape (`{affected, detail:{checked, stale}}`)

Today: `take: 500`, no `orderBy`, no loop — past 500 enabled assets the remainder are never checked, nondeterministically.

- [ ] **Step 1: Failing test first — two pages, deterministic order**

Add to the spec (fake evaluates `orderBy` + `where.assetId.gt` cursor; 3 rows, batch constant small — the constant is module-private, so the test drives pagination by row count? No: batch is 500. A test with 501 rows is silly. Instead restructure: extract the page size as a constructor default? Minimal seam: `new AttestationFreshnessJob(prisma, batchSize = FRESHNESS_BATCH)`? Constructor injection changes DI registration (explicit `@Inject` only for services; a defaulted scalar second param breaks Nest DI — `check-explicit-di` may flag it). Safer seam: keep the constant, test determinism (orderBy passed to findMany — assert on the fake's seen args) + deadline/abort breaks. Reframe the task: (a) add `orderBy: [{assetId:'asc'}]` (deterministic page), (b) loop with `{assetId: {gt: lastId}}` cursor until a short page, abort, or deadline within 5s. Test the loop with a fake that serves 3 rows and asserts two differently-cursored calls happened... but batch=500 means one call returns all 3 (short page → stop). The loop is then untestable without shrinking the batch. Decision: shrink `FRESHNESS_BATCH` to 200 (still ample; rescreen uses 100) AND test via fake that slices per `take` — with 3 rows and take 200 the loop still runs once. The loop only matters past the batch size; testing it needs >batch rows. 201 fake rows is cheap to generate (`Array.from({length: 201})`)! Do that: 201 rows, take 200 → two calls, second call's `where` carries `assetId: {gt: <200th id>}`, stale collected across both, `checked: 201`.

- [ ] **Step 2: Implement**

```typescript
const out = { checked: 0, stale: [] as string[] };
let cursor: string | undefined;
for (;;) {
  if (ctx.signal.aborted) break;
  if (ctx.deadline.getTime() - Date.now() < 5_000) break;
  const rows = await this.prisma.asset.findMany({
    where: {
      enabled: true,
      attestationCadence: { not: "none" },
      ...(cursor ? { assetId: { gt: cursor } } : {}),
    },
    orderBy: [{ assetId: "asc" }],
    take: FRESHNESS_BATCH,
    select: { assetId: true, attestationCadence: true, lastAttestedAt: true },
  });
  if (rows.length === 0) break;
  // ... existing per-row staleness check, pushing into out.stale, out.checked += rows.length
  if (rows.length < FRESHNESS_BATCH) break;
  cursor = rows[rows.length - 1]!.assetId;
}
```

Careful: existing code takes `limit+1`-style or exact take? Current: `take: FRESHNESS_BATCH` and iterates all rows (no hasMore logic — it processes whatever returns). Preserve the per-row logic verbatim; only add ordering, cursor, loop, and guards. `stale.slice(0, 50)` in detail stays.

- [ ] **Step 3: Mutation round** — drop the `gt` cursor (infinite same-page loop? No — without cursor the second call repeats; with `rows.length < take` break it terminates but rechecks page one forever? It breaks after short page... full pages repeat forever until deadline. Test with 201 rows: without cursor, checked would exceed 201 / stale duplicated. Assert `checked === 201` kills it. Second mutant: drop `orderBy` — fake asserts its presence in seen args.
- [ ] **Step 4: Run + typecheck + commit** (direct exit codes).

## Task 4: Admin validation-error guidance (deferred minor 2)

**Files:**

- Create: `apps/admin/src/lib/api-error.ts`, `apps/admin/src/lib/api-error.spec.ts`
- Modify: `apps/admin/src/lib/api-server.ts` (one call site in the `!response.ok` branch)

**Interfaces:**

- Consumes: `{error?: {message?: string; code?: string; detail?: unknown}}` (the `safeJson` shape already there)
- Produces: `string` message

Today a crafted `?state=bogus` answers `Request validation failed` with no hint which value is bad — the per-field issues sit in `detail` and never reach the UI.

- [ ] **Step 1: Failing test first**

```typescript
import { describe, expect, it } from "vitest";
import { describeApiError } from "./api-error.js";

describe("describeApiError", () => {
  it("appends the first validation issue path and message", () => {
    expect(
      describeApiError(
        {
          error: {
            message: "Request validation failed",
            code: "validation_failed",
            detail: [{ path: "state", message: "Invalid option" }],
          },
        },
        422,
      ),
    ).toBe("Request validation failed: state — Invalid option");
  });

  it("ignores malformed detail and falls back to the message", () => {
    expect(
      describeApiError(
        {
          error: {
            message: "Request validation failed",
            code: "validation_failed",
            detail: [{ nope: 1 }],
          },
        },
        422,
      ),
    ).toBe("Request validation failed");
    expect(describeApiError({ error: { message: "Nope" } }, 400)).toBe("Nope");
    expect(describeApiError(null, 503)).toBe("Request failed (503)");
  });

  it("never echoes values, only path and message", () => {
    const msg = describeApiError(
      {
        error: {
          message: "Request validation failed",
          code: "x",
          detail: [{ path: "a", message: "m", value: "SECRET" }],
        },
      },
      422,
    );
    expect(msg).not.toContain("SECRET");
  });
});
```

- [ ] **Step 2: Implement**

```typescript
/** Human guidance for API failures. Only path + message of the first
 * validation issue ever cross — values, stacks and bodies stay server-side. */
export function describeApiError(
  body: {
    error?: { message?: string; code?: string; detail?: unknown };
  } | null,
  status: number,
): string {
  const fallback = body?.error?.message ?? `Request failed (${status})`;
  const detail = body?.error?.detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { path?: unknown; message?: unknown };
    if (typeof first?.path === "string" && typeof first?.message === "string") {
      return `${fallback}: ${first.path} — ${first.message}`;
    }
  }
  return fallback;
}
```

Wire into `api-server.ts`: replace `message: body?.error?.message ?? \`Request failed (${response.status})\``with`message: describeApiError(body, response.status)`.

- [ ] **Step 3: Run + typecheck + browser-verify + commit**

Run admin spec + typecheck (direct exit codes). Browser-verify: `/redemptions?state=bogus` shows the guided message (needs API+admin boot like Phase 3 tasks). Commit with why-message + attribution.

## Task 5: Gated follow-ons (do not start before triggers)

- [ ] **5a. Risk-rule build — trigger: Phase 0.1 paragraph.** Translate thresholds/windows/action into `RiskRule` semantics; event scan + flags + review-queue reuse. Estimated own 3-task slice at that time; not planned here because the paragraph shapes it.
- [ ] **5b. Sync success-shape pin — trigger: Phase 0.4 RPC endpoints.** Replace the dual-outcome assertion with the success shape once an endpoint exists in CI/dev; keep the ERROR key for outages. One task, no plan needed.
- [ ] **5c. Custody steps 3–4 — triggers: Phase 0.2/0.3.** As recorded in Task 2.5.

---

## Self-review

**1. Spec coverage:** BE-1702's named gaps close via Tasks 1 (notifications.service) and 2 (contracts package; types/ui/api-client/integrations/transactions hold no runtime — verified by read, so no tasks). Deferred minors close via Tasks 3–4. Gated work is recorded with triggers in Phase 0/Task 5, not started. ui/api-client/integrations/transactions 1-line stubs and types interfaces need no tests — stated, not skipped silently.

**2. Placeholder scan:** no TBD/TODO/later; every code block complete; Task 3's seam decision is made inline (201-row fake, no constructor change, with the DI reason stated); Task 5 has no code by design (gated), with exact triggers instead.

**3. Type consistency:** `describeApiError(body, status)` signature matches call site; fake shapes mirror Tasks 1's service reads (`where.userId`, `where.sentAt/failedAt`, `take`); `JobContext` field names flagged for verification against `job.ts` before writing; contracts spec import suffix `./schemas.js` matches API-spec precedent.

**4. Review Focus:** all five lines name owning tasks (1, 2, 3, 4, ledger). No empty section.
