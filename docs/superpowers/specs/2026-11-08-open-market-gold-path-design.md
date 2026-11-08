# Open-market gold path

Decisions for the first gold path that works without a contracted issuer, on-ramp, or price vendor. Approved in conversation on 2026-11-08 from the provider map: hold and send need a node; a dollar figure and a crypto-to-gold swap need public contracts on that same node; card checkout, Persona production, and physical bars stay a later plan.

## Intent

A user who already holds USDC on Ethereum can see an honest reference price for PAXG and XAUT, receive a quote for swapping USDC into one of those tokens on a public pool, and sign that swap on their own device. Correnthian relays only the payload it assembled. No vendor is marked contracted. No fee percentage is invented.

## Goals

- Ethereum mainnet reads and broadcasts work when the operator supplies RPC URLs.
- PAXG, XAUT, and USDC exist in the registry as public facts, tier `unverified`, redemption off.
- A reference price is recorded from Chainlink XAU/USD when the feed address is configured, and from nowhere otherwise.
- A swap quote either carries a positive amount from a Uniswap v3 quoter or stays the current honest refusal (`executionQuality: 'none'`, received amount `0`).
- The device can sign the router call. Relay rejects any signed payload that is not the one just assembled.

## Non-goals

- Card or bank buy. `OnRampService` keeps refusing.
- Physical redemption. `redeemSupported` stays false. No courier.
- A metals liquidity-provider rail. `placeholder-metals` stays disabled.
- Gas sponsorship, passkeys, paymasters.
- Silver. No silver contract is verified in this repository, so none is seeded. An XAG feed with no silver asset records nothing.
- Bitcoin, Solana, Base copies of these tokens.
- Rendering. The web and admin are out of this plan. The API grows a `priceImpactMeasured` flag so a later screen does not treat `priceImpactBps: 0` as a measured zero.

## Constraints

- Keys never reach the server. The new path uses `EvmAdapter.buildTransaction` and the existing relay. It does not add a signer.
- RPC URLs never appear in an HTTP body or a log line. Existing chain selects stay without `rpcUrls`.
- `verifiedTier` for these seeded rows is `unverified`. Do not call `issuer_verified`.
- Do not write a storage fee, a creation fee, or a Correnthian fee percentage. Identity fields only.
- Reference price and executable amount stay separate. Chainlink fills `AssetPrice` (reference). The quoter fills `toAmountRaw` (executable). One must not be copied into the other.
- `executionQuality: 'deep'` is not used. A positive quoter answer is `thin`. A failure is `none`.
- `priceImpactBps` is not a measurement here. The response says `priceImpactMeasured: false`.
- Feed and router addresses come from the operator's env after they are checked against the publisher's docs at implementation time. They are not recalled into source.
- Re-seed must not replace RPC URLs an operator already stored.
- Explicit `@Inject` on every Nest constructor. Packages still build to `dist/`.

## Public facts this plan may store

Confirmed in `docs/marketing/VERIFIED_PRODUCT_FACTS.md`. Re-read that file at implementation; if a contract or decimal disagrees, stop and use the file.

| Symbol | Issuer slug | Contract | Decimals | Unit |
|---|---|---|---|---|
| PAXG | `paxos` | `0x45804880De22913dAFE09f4980848ECE6EcbAf78` | 18 | 1 fine troy ounce |
| XAUT | `tg-commodities` | `0x68749665FF8D2d112Fa859AA293F07A622782F38` | 6 | 1 fine troy ounce |

USDC on Ethereum mainnet is the from-asset. At implementation, confirm the contract against Circle's published USDC list. The address to use when that page agrees is `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, 6 decimals, issuer slug `circle`, category `stablecoin`. If the page disagrees, stop. Do not ship a remembered address that the page contradicts.

Issuer display names: Paxos Trust Company, LLC; TG Commodities Limited; Circle. `verifiedTier: unverified` on both the issuer and the asset. `custodyModel: allocated` for the two metals. `custodian` and `vaultLocations` may repeat only the phrases already in the verified-facts file (Brink's London for PAXG, Swiss vaults for XAUT). `redeemSupported: false`. `swapSupported: true`. `rails: ['dex']`.

## How a quote is decided

1. Both assets enabled, on chain `1`, and each lists `dex` in `rails`.
2. `UNISWAP_V3_QUOTER_ETHEREUM` is set. Otherwise the quote stays the current unassigned refusal.
3. Call `quoteExactInputSingle` for fee tiers `500`, `3000`, and `10000`. Keep the largest `amountOut`. A tier that reverts is skipped.
4. All tiers fail or the best amount is `0`: `executionQuality: 'none'`, `toAmountRaw: '0'`, `minReceivedRaw: '0'`, `railId: 'unassigned'`.
5. A positive amount: `railKind: 'dex'`, `railId: 'uniswap-v3'`, `executionQuality: 'thin'`, `toAmountRaw` is the integer base units, `minReceivedRaw` is `amountOut * (10000 - slippageBps) / 10000` in integer arithmetic. Default slippage stays the service's current default.

## How a signature is checked

Preparing a quote files a normal outbound `Transaction` whose destination is the router, not the token contract. Assembly asks the node for nonce and gas, and the calldata is the router call produced for that quote (plus an ERC-20 `approve` of the router for `fromAmountRaw` when allowance is lower). Both unsigned payloads are returned to the device.

Relay keeps today's signer and chain checks. The `to` / `value` / `data` check compares the signed payload to the payload stored at assembly, not to a freshly encoded ERC-20 `transfer`. A signed payload that differs is a 400 and is not broadcast. ERC-20 sends that went through the old assembler still match, because their stored payload is the transfer encoding.

## Config

All optional. Unset means the feature stays on its current refusal. No key material.

| Variable | Meaning |
|---|---|
| `RPC_ETHEREUM_MAINNET` | Comma-separated HTTPS URLs, first is preferred. Same pattern for the existing Base and Sepolia names. |
| `CHAINLINK_XAU_USD_FEED` | Ethereum aggregator proxy for XAU/USD. |
| `CHAINLINK_XAG_USD_FEED` | Ethereum aggregator proxy for XAG/USD. Read only when a silver asset exists. |
| `UNISWAP_V3_QUOTER_ETHEREUM` | QuoterV2 address. |
| `UNISWAP_V3_ROUTER_ETHEREUM` | SwapRouter02 address. Required only to prepare a signature. |

## Acceptance

With the env vars set and a stub or live node:

- `GET /api/v1/chains/1` is enabled and its JSON has no `rpcUrls` key.
- `GET /api/v1/assets` includes the three symbols at `unverified`, metals not redeemable.
- After the price job, PAXG and XAUT have a reference row whose `source` names Chainlink, or the job detail says the feed is unset. USDC is not given the gold price.
- `POST /api/v1/swaps/quotes` from USDC to PAXG returns `thin` and a positive `toAmountRaw` when the quoter answers, and `none` with `0` when every tier fails.
- Preparing that quote returns unsigned transactions. A signed payload with altered `data` is rejected. The server never signs.
