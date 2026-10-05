# Correnthian v1 — Architecture & Product Design

**Date:** 2026-10-05
**Status:** Approved for implementation
**Supersedes:** the original master specification in [`docs/archive/chat-transcript.txt`](../../archive/chat-transcript.txt)

---

## 1. What Correnthian is

A self-custodial platform for holding and buying **tokenized precious metals**.
Users hold gold and silver, buy with a card or bank account, and the metal is
delivered to an account only they can move.

Correnthian does not issue the tokens, does not hold user assets, and does not
take principal risk.

### The wedge

Tokenized gold already exists and already trades. What does not exist is a way
for a non-crypto buyer to hold it without trusting a broker, and a way for
anyone to know which tokens are actually metal-backed.

> **The product is trust and execution, not token support.**
> Any wallet can list a gold token in an afternoon. What cannot be added to a
> token list is a verifiable answer to "what am I holding, who backs it, and
> can I take it out."

---

## 2. Decision record

| # | Decision | Rationale | Status |
|---|---|---|---|
| 1 | **Thin aggregator** — Correnthian holds no assets, earns stated fees | Keeps us on the software-provider side of the money-transmitter line; no capital requirement | Locked |
| 2 | **Beachhead: the gold-owning non-crypto buyer** | Largest uncontested segment; the refusal to hand custody to a broker is the entire wedge | Locked |
| 3 | **Pattern: Kinesis-style** — app-first, gram/ounce-denominated, fiat-native, redemption path | The pattern that actually serves this user | Locked |
| 4 | **Primary rail: licensed metals provider** delivering tokens directly to the user's smart account | A fiat buyer cannot use a DEX. Deep gold liquidity is custodial. | **Reversed — see §3** |
| 5 | **Secondary rail: DEX aggregator** for users who already hold crypto | Shallow liquidity, so it carries an explicit size cap | Locked |
| 6 | **Keys: ERC-4337 smart accounts + passkeys** (EVM), seed phrase (BTC/SOL only) | Nothing to write down, therefore nothing to phish | Locked |
| 7 | **Recovery: on-chain social recovery** (guardians) | A lost passkey must not mean lost funds. Correnthian holds no share. | Locked |
| 8 | **v1 = gold, plus silver if the same provider issues it** | One provider, one relationship, one compliance surface | Locked |
| 9 | **Chains: Ethereum + Base** | Both EVM → one engine. Base's gas cost makes passkey UX and sponsorship practical. | Locked |
| 10 | **Compliance is load-bearing in v1** | Not deferred. See §7. | Locked |

---

## 3. The reversal, and why it matters

An earlier draft chose **DEX-first, LP partner in parallel**. That was correct
for a crypto-native beachhead and **wrong for this one**.

A person paying by debit card has no USDT, no gas, and no tolerance for
slippage. Routing them through a Uniswap USDT→PAXG trade is the wrong mechanism
for the wrong user.

> **The licensed metals provider is the primary rail and a launch dependency.
> The partner contract has a multi-month lead time and is the project's critical
> path. Nothing else in this project may be late; that may.**

The key boundary is unaffected. The provider delivers tokens **directly to the
user's smart-account address**. The user never holds USDT, never sees a chain,
never sees gas, never signs a swap. The difference from Kinesis, which is
custodial, is precisely the product.

---

## 4. Architecture

### 4.1 The key boundary

```
private key / seed ──► user device ──► local signing ──► signed tx ──► network
        │
        └─ never crosses to Correnthian's servers. Ever.
```

Two things share the word "account" and conflating them is a security bug:

- **Correnthian Account** — server-side profile, devices, preferences,
  notifications. Holds no key material.
- **Key Container** — device-side. Two account *kinds*:
  - `SmartAccount` (EVM) — passkey signer, guardians, session keys. Deferred
    on-chain deployment, created deterministically via CREATE2.
  - `SeedAccount` (BTC/SOL) — BIP-39 derived.

Compromising a Correnthian Account must not yield funds. This is enforced
structurally: `packages/wallet-core` takes no HTTP client, no RPC endpoint and
no provider SDK. If one is ever added to that dependency graph, the boundary is
broken.

### 4.2 Asset identity

**A symbol is never an identity.** An asset is `(chain, contract, issuer)`.
USDT on Ethereum, BNB, Polygon, Tron and Solana are five distinct assets.

The registry carries `Backing` (custody model, custodian, vault location,
attestation cadence and date, grams/troy-oz per token) and `Trust`
(verified tier, risk flags). These fields exist so the UI can make an honest
claim, and they are the product — not metadata. A registry without them cannot
produce the sentence that is Correnthian's entire differentiation.

`describeBacking()` in `packages/assets` must never present a synthetic or
unallocated token as metal. It is covered by tests.

### 4.3 Swap rails

App code resolves a rail from the registry by capability and never names a
concrete one. That is what allows decision 4 to change without touching a
screen.

```
SwapRail
  supports(from, to): boolean
  quote(req): SwapQuote        // price · slippage · priceImpact · fees[]
                               // minReceived · sizeCap · executionQuality
  status(quoteId): SwapStatus
```

`sizeCap` and `executionQuality` are mandatory. A quote engine that cannot say
"this size is not available at this price" will quote something it cannot fill.
Honest failure is representable in the type so the UI is forced to disclose it,
rather than a marketing promise being trusted for it.

Implementations: `ProviderRail` (primary), `DexAggregatorRail` (secondary),
`CexRail` (reserved; weakens the key boundary and is unlikely to ship).

### 4.4 Fees

Correnthian earns an **explicit, itemised, pre-signature fee** and never earns
by mispricing an asset. Provider fee, network fee and Correnthian fee are
shown as separate lines before the user signs.

This is both an ethics and a commercial decision. Hiding a spread in the gold
price is exactly what would poison the trust model the product is built on.

---

## 5. Product constraints this beachhead imposes

| Becomes required | Why |
|---|---|
| Fiat on-ramp | Without it the beachhead is unreachable |
| Gold-denominated UX | "0.0043 oz" is meaningless to this user |
| Invisible custody | A seed-phrase-phobic user handed a seed phrase will lose it |
| Gas sponsorship | This user will not pay $2.40 to move gold |
| Provenance UI | The reason to choose us over a brokerage |
| Redemption path | They bought gold. If they can never take it out, we broke a promise. |

**Removed from scope:** DApp browser, WalletConnect, DeFi, multi-chain sprawl,
crypto swaps as a headline.

**Marketing frame:** "wallet" is the wrong word. The honest framing is *a gold
savings app that happens to be self-custodial*, with custody as a trust signal
rather than a user task.

---

## 6. Deferred, with the trigger that unblocks each

| Decision | Decide before | Trigger |
|---|---|---|
| Issuer / LP partner identity | Metals GA | **Critical path. Start now.** |
| Redemption mechanics and fees | Metals GA | Depends on partner terms |
| Secondary chains (Polygon, Arbitrum) | After EVM slice | One engine, config only |
| BTC / SOL engines | After EVM slice | Separate adapter implementations |
| Gas sponsorship / paymaster | After smart accounts live | Commercial decision |
| Tokenized treasuries | v1.5 | Same partner structure; broadens "real assets" |
| Fiat off-ramp | v1.5 | Needs its own compliance analysis |
| CEX routing | Probably never | Weakens the key boundary |

---

## 7. What this spec does not decide

**Legal and tax.** Entity structure, the money-transmitter analysis for metals,
and whether tokenized precious metals fall under CFTC or SEC jurisdiction are
questions for crypto/fintech counsel, not an architecture document.

These are load-bearing for v1, not for launch. Selling gold to consumers with
dollars triggers AML and sanctions obligations **regardless of custody posture**,
and offering physical redemption or delivery may make Correnthian a precious
metals dealer — separately licensed in many US states. If delivery is in scope,
jurisdiction selection depends on it.

Counsel is required **before the product design is frozen**, not before launch.

---

## 8. Known trade-offs accepted

- **This audience is harder to serve than crypto users.** They expect banking-grade
  reliability and support, and they blame harder. A harder audience in exchange
  for a larger uncontested one.
- **The partner relationship is a single point of failure.** Mitigated by the
  rail interface, not eliminated.
- **Social recovery needs a user graph.** Guardian flows only work once users
  are connected to each other.
- **A trusted person can lose a user's funds, and vice versa.** Documented,
  disclosed, and inherent to the choice.
