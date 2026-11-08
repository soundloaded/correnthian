# Open-market gold path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quote a USDC to PAXG or XAUT swap from a public Uniswap pool, show a Chainlink reference price, and let the device sign the router call, without a contracted issuer or on-ramp.

**Architecture:** Seed fills empty RPC lists from comma-separated env and registers three public Ethereum assets at `unverified`. `PriceProvider` becomes Chainlink when the XAU feed is configured and stays the fake otherwise. `SwapsService.createQuote` asks a quoter port for the best of three fee tiers and still writes the honest zero quote when every tier fails. Preparing a quote files a `Transaction` whose stored payload is the router calldata (and an approve when allowance is short). Relay compares the signed payload to that stored payload.

**Tech Stack:** NestJS API, Prisma, viem inside `@correnthian/blockchain`, existing `EvmAdapter.buildTransaction`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-open-market-gold-path-design.md`

## Global Constraints

- Keys never reach the server. No signer, no paymaster, no wallet-core network dependency.
- RPC URLs never appear in an HTTP response or a log line.
- Seeded PAXG, XAUT, USDC, and their issuers stay `verifiedTier: 'unverified'`. `redeemSupported: false`. No fee percentage is written.
- Chainlink output is a reference `AssetPrice` only. It is never copied into `toAmountRaw`.
- A positive quoter answer is `executionQuality: 'thin'`. Failure is `'none'` with received amount `0`. `'deep'` is not written.
- Quote responses include `priceImpactMeasured: false` on this path. `priceImpactBps: 0` is not a measured impact.
- Feed, quoter, and router addresses are env values checked against the publisher's docs during the task. They are not hardcoded from memory.
- Re-seed does not replace a non-empty `rpcUrls` list.
- Nest constructors use `@Inject`. Packages build to `dist/`.
- Commit messages say why. End them with the attribution trailer `CLAUDE.md` requires. Do not commit `.env` files.

## Review Focus

- An API response or error string that contains an RPC URL — the chain JSON and the 503 body must not. Pinned in Task 1.
- A gold spot number stored as the swap's received amount — Chainlink and the quoter write different columns. Pinned in Task 3 and Task 4.
- A quoter revert or a zero `amountOut` presented as a fillable quote — stays `none` and `0`. Pinned in Task 4.
- Re-seed wiping operator RPC URLs — non-empty lists are returned unchanged. Pinned in Task 1.
- A seeded metal marked `issuer_verified` or `redeemSupported: true` — both forbidden. Pinned in Task 2.
- Relay broadcasting a signed payload whose `data` is not the stored assembly — 400, no broadcast. Pinned in Task 5.

## Fan-out

| Task | Can start | Touches |
|---|---|---|
| 1 RPC lists | immediately | `services/api/src/chains/chain-rpc.ts` |
| 2 Asset catalog | immediately | `services/api/prisma/seed.ts` and a new catalog module |
| 3 Chainlink | after 2 is merged if the seed assets are the mapping fixture; unit tests may insert their own rows, so it can run beside 2 | `services/api/src/pricing/`, `packages/config` |
| 4 Quoter | beside 3 | `packages/blockchain/src/uniswap-v3.ts`, `services/api/src/swaps/` |
| 5 Sign and relay | after 4 | `swaps.service.ts`, `transactions.service.ts` |

Do not start 5 against a quote shape 4 has not merged.

---

### Task 1: Comma-separated RPC seed

**Files:**
- Modify: `services/api/src/chains/chain-rpc.ts`
- Test: `services/api/src/chains/chain-rpc.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `resolveSeedRpcUrls(chainId: string, existing: string[], env: NodeJS.ProcessEnv): string[]` — same signature. A non-empty `existing` is returned as-is. An empty `existing` splits `RPC_ETHEREUM_MAINNET` (and the existing Base and Sepolia names) on commas, trims, and drops empty segments, preserving order.

- [ ] **Step 1: Write the failing test**

Add to `chain-rpc.spec.ts`:

```ts
it('splits a comma-separated list and keeps order', () => {
  expect(resolveSeedRpcUrls('1', [], {
    RPC_ETHEREUM_MAINNET: ' https://a.example , https://b.example, ',
  })).toEqual(['https://a.example', 'https://b.example']);
});

it('does not replace urls an operator already stored', () => {
  expect(resolveSeedRpcUrls('1', ['https://ops.example'], {
    RPC_ETHEREUM_MAINNET: 'https://a.example,https://b.example',
  })).toEqual(['https://ops.example']);
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @correnthian/api exec vitest run src/chains/chain-rpc.spec.ts`

Expected: FAIL on the split case. The preserve case already passes; keep it.

- [ ] **Step 3: Implement the split**

In `resolveSeedRpcUrls`, when `existing.length === 0`, split the env string on `,`, trim, and drop empties. Return `[]` when the name is absent or the pieces are empty. Do not log the values.

- [ ] **Step 4: Re-run**

Run the same vitest command. Expected: PASS.

- [ ] **Step 5: Pin the leak**

In `services/api/test/chains.spec.ts` the list and detail assertions already require no `rpcUrls` key. Add one assertion that a chain whose row has two URLs still omits them and that `JSON.stringify` of the body does not contain `https://`. Use the suite's existing fixture style. Run `pnpm --filter @correnthian/api exec vitest run test/chains.spec.ts`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/chains/chain-rpc.ts services/api/src/chains/chain-rpc.spec.ts services/api/test/chains.spec.ts
git commit -m "$(cat <<'EOF'
Accept a failover pair of RPC URLs without clobbering an operator list.

EOF
)"
```

---

### Task 2: Public asset catalog

**Files:**
- Create: `services/api/src/assets/public-catalog.ts`
- Create: `services/api/src/assets/public-catalog.spec.ts`
- Modify: `services/api/prisma/seed.ts` (call the catalog after issuers can be upserted)

**Interfaces:**
- Consumes: `deriveAssetId` from `@correnthian/assets`
- Produces: `PUBLIC_CATALOG`, a readonly array of `{ issuer: { slug, name }, asset: CreateAssetDto }` for PAXG, XAUT, and USDC using the table in the spec. `catalogAssetId(entry): string` returns `deriveAssetId` of that entry.

- [ ] **Step 1: Write the failing test**

```ts
import { PUBLIC_CATALOG, catalogAssetId } from './public-catalog';

it('registers the three public assets as unverified and not redeemable', () => {
  const symbols = PUBLIC_CATALOG.map((e) => e.asset.symbol).sort();
  expect(symbols).toEqual(['PAXG', 'USDC', 'XAUT']);
  for (const entry of PUBLIC_CATALOG) {
    expect(entry.asset.verifiedTier).toBe('unverified');
    expect(entry.issuer.slug).toMatch(/^[a-z0-9-]+$/);
    expect(entry.asset.redeemSupported).toBe(false);
    expect(entry.asset.chainId).toBe('1');
    expect(catalogAssetId(entry)).toBe(
      `1:${entry.asset.contractAddress!.toLowerCase()}:${entry.issuer.slug}`,
    );
  }
  const metals = PUBLIC_CATALOG.filter((e) => e.asset.category === 'metal');
  expect(metals).toHaveLength(2);
  for (const metal of metals) {
    expect(metal.asset.custodyModel).toBe('allocated');
    expect(metal.asset.ouncesPerToken).toBe(1);
    expect(metal.asset.swapSupported).toBe(true);
    expect(metal.asset.rails).toEqual(['dex']);
  }
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @correnthian/api exec vitest run src/assets/public-catalog.spec.ts`

Expected: FAIL with cannot find module.

- [ ] **Step 3: Implement the catalog**

Export the constant and `catalogAssetId`. Copy contract, decimals, and issuer names from the spec table. Before writing the USDC address, open Circle's published USDC contract list. If it disagrees with the spec, stop and report the page's address. Do not put fee percentages, proof URLs, or `issuer_verified` on any row. `gramsPerToken` for the metals is `31.1034768`.

- [ ] **Step 4: Seed it**

In `prisma/seed.ts`, upsert each issuer by slug with `verifiedTier: 'unverified'`, then upsert each asset by `catalogAssetId`. Upsert must not upgrade an existing row's `verifiedTier` or turn `redeemSupported` on. A second seed run changes nothing about those two fields.

- [ ] **Step 5: Re-run the unit test**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/assets/public-catalog.ts services/api/src/assets/public-catalog.spec.ts services/api/prisma/seed.ts
git commit -m "$(cat <<'EOF'
Register public PAXG, XAUT, and USDC without claiming they are verified.

EOF
)"
```

---

### Task 3: Chainlink reference prices

**Files:**
- Create: `services/api/src/pricing/chainlink-price.provider.ts`
- Create: `services/api/src/pricing/chainlink-price.provider.spec.ts`
- Modify: `packages/config/src/index.ts` (optional feed addresses on the config object)
- Modify: `services/api/src/pricing/pricing.module.ts` (factory chooses the implementation)
- Test: `packages/config` existing config test file, one new case

**Interfaces:**
- Consumes: `PriceProvider`, `SpotPrice`, `PriceUnavailableError` from `services/api/src/pricing/price-provider.ts`. `PricingService.MAX_AGE_SECONDS` (300).
- Produces:

```ts
export interface FeedReader {
  latestRound(feed: `0x${string}`): Promise<{
    answer: bigint;
    updatedAt: bigint;
    decimals: number;
  } | null>;
}

export interface PricedAsset {
  assetId: string;
  symbol: string;
  category: string;
  ouncesPerToken: number | null;
}

export interface PricedAssetSource {
  listEnabled(): Promise<readonly PricedAsset[]>;
}

export class ChainlinkPriceProvider extends PriceProvider {
  readonly name = 'chainlink';
  constructor(
    feeds: { xauUsd?: `0x${string}`; xagUsd?: `0x${string}` },
    read: FeedReader,
    assets: PricedAssetSource,
    now?: () => Date,
  );
}
```

`spotPrices()` keeps the no-argument signature from `PriceProvider`. It asks `assets.listEnabled()` and returns one `SpotPrice` per `category: 'metal'` asset with `ouncesPerToken === 1`, using the XAU feed. `source` is `chainlink:xau-usd`. The XAG feed is read only for an enabled metal whose `symbol` is `XAG`. This catalog has none, so the test asserts `latestRound` is not called with the XAG address. `isAvailable()` is true only when `xauUsd` is set.

`priceProvider(config)` in `pricing.module.ts` returns `ChainlinkPriceProvider` when `config.chainlink.xauUsd` is set, otherwise `new FakePriceProvider()`. The production `PricedAssetSource` reads enabled assets from Prisma. The recording job keeps calling `spotPrices()` with no arguments.

- [ ] **Step 1: Write the failing test**

Cover four cases in `chainlink-price.provider.spec.ts`:

- A round with `answer` `4100_00000000n`, `decimals` 8, `updatedAt` now, and one 1-ounce metal asset yields `priceUsd` `4100` and `source` `'chainlink:xau-usd'`.
- `updatedAt` older than 300 seconds yields no row for that asset and does not throw.
- `answer` `0n` or negative yields no row.
- USDC (`category: 'stablecoin'`) is not in the result.
- No `xauUsd` feed: `isAvailable()` is false and `spotPrices()` throws `PriceUnavailableError`.

The test stubs `PricedAssetSource`. Do not add a parameter to `spotPrices()`.

- [ ] **Step 2: Run it**

Run: `pnpm --filter @correnthian/api exec vitest run src/pricing/chainlink-price.provider.spec.ts`

Expected: FAIL, module missing.

- [ ] **Step 3: Implement the provider and the config fields**

`CHAINLINK_XAU_USD_FEED` and `CHAINLINK_XAG_USD_FEED` are optional. A value that is not a `0x` plus 40 hex chars fails config parse. The feed reader used in production calls `EvmAdapter` on chain `1` via `readContract` for `latestRoundData` and `decimals`. ABI stays in the provider file. On RPC failure the reader returns `null`, and the job records nothing for that asset.

Confirm the proxy address against Chainlink's Ethereum XAU/USD feed page while filling `.env`, not the source file.

- [ ] **Step 4: Wire the factory**

`pricing.module.ts` `priceProvider` follows the spec. The recording job calls `spotPrices(assets)` with enabled assets. An asset the provider omits is skipped by name, which the job already does.

- [ ] **Step 5: Re-run**

Provider spec and `src/pricing/price-recording.job.spec.ts`. Expected: PASS. Add one config test that a malformed feed address fails parse and an absent address leaves `chainlink.xauUsd` undefined.

- [ ] **Step 6: Commit**

```bash
git add packages/config/src services/api/src/pricing packages/config
git commit -m "$(cat <<'EOF'
Record a Chainlink gold reference without treating it as a buy price.

EOF
)"
```

---

### Task 4: Uniswap v3 quote

**Files:**
- Create: `packages/blockchain/src/uniswap-v3.ts`
- Create: `packages/blockchain/src/__tests__/uniswap-v3.test.ts`
- Create: `services/api/src/swaps/uniswap-v3-quoter.ts`
- Create: `services/api/src/swaps/uniswap-v3-quoter.spec.ts`
- Modify: `services/api/src/swaps/swaps.service.ts` (`createQuote`, `present`)
- Modify: `services/api/src/swaps/swaps.module.ts` (provide the quoter)
- Modify: the quote contract in `packages/contracts` so the response includes `priceImpactMeasured`

**Interfaces:**
- Consumes: asset `rails` including `'dex'`, chain `1`, `fromAmountRaw` as an integer base-unit string
- Produces:

```ts
export const UNISWAP_V3_FEE_TIERS = [500, 3000, 10000] as const;

export function encodeQuoteExactInputSingle(args: {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  fee: number;
  amountIn: bigint;
  sqrtPriceLimitX96: 0n;
}): `0x${string}`;

export interface QuoteExactInput {
  quote(input: {
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
    amountIn: bigint;
    fee: number;
  }): Promise<bigint | null>;
}

export async function bestAmountOut(
  quoter: QuoteExactInput,
  input: { tokenIn: `0x${string}`; tokenOut: `0x${string}`; amountIn: bigint },
): Promise<bigint | null>;
```

`bestAmountOut` tries the three tiers and returns the max positive `amountOut`. A null or `0n` tier is skipped. All skipped returns `null`.

`present()` adds `priceImpactMeasured: boolean`. Dex quotes and the unassigned refusal set it `false`.

The winning fee tier is stored on the quote. Add nullable `SwapQuote.poolFee Int?` in a Prisma migration in this task. `none` quotes leave it null. A `thin` quote sets it to `500`, `3000`, or `10000`. Task 5 reads it and does not rediscover the tier.

- [ ] **Step 1: Write the failing encoder and chooser tests**

Encoder test: `encodeQuoteExactInputSingle` for two fixed addresses, fee `3000`, amount `1000000n` starts with the selector for `quoteExactInputSingle` and is stable across two calls. Do not assert a remembered selector literal until the test prints viem's; then pin that selector in the assertion.

Chooser test:

```ts
it('picks the largest tier and ignores reverts', async () => {
  const quoter: QuoteExactInput = {
    quote: async ({ fee }) => (fee === 500 ? null : fee === 3000 ? 10n : 4n),
  };
  expect(await bestAmountOut(quoter, INPUT)).toBe(10n);
});

it('returns null when every tier fails', async () => {
  const quoter: QuoteExactInput = { quote: async () => null };
  expect(await bestAmountOut(quoter, INPUT)).toBe(null);
});
```

- [ ] **Step 2: Run them**

`pnpm --filter @correnthian/blockchain test` and the new api spec. Expected: FAIL, missing exports.

- [ ] **Step 3: Implement encoding and bestAmountOut**

Encoding uses viem `encodeFunctionData` against the QuoterV2 `quoteExactInputSingle` ABI. The production `QuoteExactInput` performs `eth_call` to `UNISWAP_V3_QUOTER_ETHEREUM` through `EvmAdapter`'s read path and decodes `amountOut`. A revert returns `null`. Confirm the quoter address against Uniswap's Ethereum deployments page when setting env. The address is config, optional, `0x` plus 40 hex. Unset means `createQuote` keeps today's unassigned quote.

- [ ] **Step 4: Use it in createQuote**

Only when both assets include `dex`, both are on chain `1`, the quoter is configured, and `fromAmountRaw` matches `^[1-9]\d*$` (base units). Otherwise keep the current refusal.

On `null`: current refusal (`railId: 'unassigned'`, `executionQuality: 'none'`, amounts `0`, `poolFee: null`).

On a positive bigint: `railKind: 'dex'`, `railId: 'uniswap-v3'`, `executionQuality: 'thin'`, `poolFee` the winning tier, `toAmountRaw` that integer as a decimal string, `minReceivedRaw = amountOut * BigInt(10000 - slippageBps) / 10000n` as a decimal string. `priceImpactBps` stored `0` and `priceImpactMeasured: false`.

A `fromAmountRaw` that contains a decimal point does not call the quoter. It takes the unassigned refusal. The quoter speaks integer base units only.

- [ ] **Step 5: Service spec**

In `swaps.service.spec.ts`, add: quoter returns `null` → `none`, `toAmountRaw` `'0'`, `poolFee` null; quoter returns `50n` at fee `3000` with slippage 50 → `thin`, `poolFee` `3000`, `toAmountRaw` `'50'`, `minReceivedRaw` `'49'` (`50 * 9950 / 10000`), `priceImpactMeasured` false; `fromAmountRaw` `'1.5'` does not call the quoter.

- [ ] **Step 6: Re-run blockchain and swaps tests**

Expected: PASS. Update the contracts registry entry for `POST /api/v1/swaps/quotes` so the body parses with `priceImpactMeasured`.

- [ ] **Step 7: Commit**

```bash
git add packages/blockchain/src/uniswap-v3.ts packages/blockchain/src/__tests__/uniswap-v3.test.ts services/api/src/swaps packages/contracts
git commit -m "$(cat <<'EOF'
Quote USDC to gold on Uniswap, and refuse when every fee tier fails.

EOF
)"
```

---

### Task 5: Device-signed swap, checked against the stored payload

**Files:**
- Modify: `packages/blockchain/src/uniswap-v3.ts` (add the router and approve encoders)
- Modify: `services/api/src/swaps/swaps.service.ts`
- Modify: `services/api/src/swaps/swaps.controller.ts`
- Modify: `services/api/src/transactions/transactions.service.ts` (`assemble`, `relay`)
- Test: `services/api/src/transactions/transactions.service.spec.ts` and a swaps prepare spec

**Interfaces:**
- Consumes: Task 4 quote (`railId: 'uniswap-v3'`, positive `toAmountRaw`). `EvmAdapter.buildTransaction` and `decodeSignedTransaction`. `UNISWAP_V3_ROUTER_ETHEREUM` from config, same address shape as the quoter.
- Produces:

```ts
export function encodeExactInputSingle(args: {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  fee: 500 | 3000 | 10000;
  recipient: `0x${string}`;
  amountIn: bigint;
  amountOutMinimum: bigint;
  sqrtPriceLimitX96: 0n;
}): `0x${string}`;

export function encodeErc20Approve(spender: `0x${string}`, amount: bigint): `0x${string}`;

prepare(quoteId: string, actorId: string, walletId: string): Promise<{
  quoteId: string;
  transactions: Array<{ id: string; kind: 'approve' | 'swap'; unsigned: UnsignedTransaction }>;
}>;
```

The fee on the router call is `quote.poolFee` from Task 4. Do not add a second migration for it.

- [ ] **Step 1: Write the failing relay test**

Extend the transactions service spec. Assemble stores `metadata.build.payload = { to, value, data }`. Relay rejects when the decoded `data` differs from that payload, and does not call broadcast. A matching payload passes the identity check (broadcast may use the suite's existing stub). An ERC-20 transfer intent still stores the transfer encoding `assemblePayload` already produces, and a matching signature passes.

- [ ] **Step 2: Run it**

Expected: FAIL because payload is not stored and relay still re-derives.

- [ ] **Step 3: Store the payload and compare against it**

`assemble` writes `metadata.build.payload` from the unsigned transaction it returns (`to`, `value`, `data`). `relay` uses that stored payload for the `to` / `value` / `data` check when it is present. When it is absent (rows assembled before this task), keep the current `assemblePayload(intentRequest)` check. Signer and chain checks stay as they are.

If `metadata.preparedCall` is `{ to, value, data }`, `assemble` builds that call instead of an ERC-20 transfer. `value` is `'0'`.

- [ ] **Step 4: Write the failing prepare test**

`prepare` on a `thin` uniswap quote with allowance `0n` returns two transactions, `approve` then `swap`. The swap `data` decodes to the router `exactInputSingle` for the quote's `poolFee`, `amountIn`, and `amountOutMinimum` equal to `minReceivedRaw`. The approve spender is the router. A quote with `executionQuality: 'none'` throws the existing not-executable error and writes no transaction. The service does not sign.

Allowance read is a port `allowance(token, owner, spender): Promise<bigint>`. The test stubs it.

- [ ] **Step 5: Implement prepare**

`POST /api/v1/swaps/quotes/:id/prepare` body `{ walletId }`, authenticated, owner of the quote and of the wallet. Router env missing → 503 `provider_unavailable` with a message that does not contain a URL. Recipient of the swap is the wallet address.

- [ ] **Step 6: Re-run**

`transactions.service.spec.ts`, the new prepare spec, and `packages/blockchain` uniswap tests. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/blockchain/src/uniswap-v3.ts services/api/src/swaps services/api/src/transactions services/api/prisma
git commit -m "$(cat <<'EOF'
Relay a swap only when the signed payload is the one the server assembled.

EOF
)"
```

Add a short changelog entry under today's date in `docs/agent/CHANGELOG.md` in this commit: reference prices come from Chainlink when configured, dex quotes come from Uniswap v3, relay now checks the stored payload, and on-ramp plus redemption are unchanged.

---

## Self-review

Spec coverage: RPC failover (Task 1), catalog and tier (Task 2), Chainlink reference separated from executable (Task 3), quoter decision including the zero path (Task 4), device signature and relay identity (Task 5). On-ramp, redemption, paymaster, and silver are named non-goals and have no task.

Review focus: each of the six lines has a test in the owning task.

Out of scope for the implementers: editing `services/api/.env` with real keys, flipping `placeholder-onramp` or `placeholder-metals`, and any web or admin screen.
