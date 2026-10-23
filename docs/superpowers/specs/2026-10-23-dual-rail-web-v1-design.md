# Dual-rail web v1 — design update

Date: 2026-10-23
Status: Approved in chat by owner. Updates (does not replace) 2026-10-05 v1 design.
Source: owner conversations 2026-10-23 (USDT-only movement, manual delivery future, Trust Wallet style buy, security list, 12-phrase first choice).

## Intent

Serve both buyers from one wallet:
- Fiat buyer who never touches USDT (beachhead).
- Existing USDT holder who swaps into/out of gold.

Both end in the same self-custodial wallet. Correnthian holds no assets, no keys, no fiat.

## Locked decisions

1. No custody: user holds the token. "Correnthian holding tokenized assets" means registry + disclosure, not custody.
2. Physical gold never moves. Custodian holds it. Only the token moves.
3. Path A (fiat → provider → gold token → user smart account). User never sees USDT/gas/swap.
4. Path B (USDT ↔ gold token via liquidity/issuer rail → same wallet). USDT is bridge only for crypto holders.
5. Buy crypto Trust Wallet style via regulated third-party on-ramp adapters. Crypto lands in user wallet. Same adapter shape for off-ramp later.
6. Keys device-first, local signing, account compromise never yields funds.
7. EVM default stays passkey + smart account with guardian recovery. 12-word is explicit advanced option + BTC/SOL model. User choice, not silent default.
8. Physical delivery future-only, provider-fulfilled, threshold-gated, counsel-reviewed. No manual bullion ordering. Out of web v1.
9. Fees explicit, itemised, pre-signature. Zero spread.

## Goals (web v1, real value)

- Portfolio: crypto + metal, grams/ounces, not just token counts.
- Backing disclosure verbatim: custodian, vault, attestation date, custody model.
- Buy fiat, buy with USDT, sell both ways. History, receive, send.
- Anything unexecutable (no provider yet) renders honest unavailability, never a fake rate.

## Non-goals / anti-goals

- No own gold token. No Correnthian custody. No principal risk.
- No manual delivery flow. No fake quotes, fake pricing, fake provider.
- No DApp browser, WalletConnect, DeFi, CEX routing.
- No fee numbers, custody terms, provider names written without verification.

## Constraints

- Key boundary holds. wallet-core takes no HTTP/RPC/SDK.
- Provider-agnostic adapters in packages/integrations. Disabled by default.
- Asset identity is (chain, contract, issuer). Never key on symbol.
- Disclosures rendered verbatim, disclosed before signature.
- Counsel required before design freeze. Provider contract is critical path.

## Left to builder

- Slices in dependency order, adapters stubbed but honest.
- Sequencing, acceptance tests, and what stays disabled until provider signed.
