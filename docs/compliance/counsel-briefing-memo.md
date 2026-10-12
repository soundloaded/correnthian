# Counsel Briefing Memo — Correnthian regulatory intake (2026-10-12)

**Prepared for:** first consultation with U.S. fintech / digital-asset regulatory counsel.
**Status of this document:** working paper. Everything attributed below falls
into exactly one bucket — **Established** (in the repository, cited),
**Proposed** (intended behavior, not all of it built), **Assumption**
(requires validation), or **Question** (only counsel can answer). Nothing is
blended.

> **Entity update 2026-10-12:** the owner confirms Correnthian C-Corp is
> registered in Delaware. Formation documents live outside the repository;
> entity *structure review* (classes, governance, licensing posture) remains
> a counsel question (§6.1).

---

## 1. Company and product overview

- **Established:** Correnthian is a self-custodial platform for holding and
  buying tokenized precious metals (`docs/agent/MASTER_CONTEXT.md` §1).
  Beachhead: the gold-owning non-crypto buyer who refuses broker custody.
- **Established:** What it is not — not a token issuer (registers, does not
  mint), not a custodian (holds no user assets or key material), not a
  broker/dealer taking principal risk (earns stated, itemised fees), not a
  DEX aggregator as primary path (`MASTER_CONTEXT.md` §1 table; ADR-003).
- **Proposed:** Users buy gold with a card or bank account; metal is delivered
  to an address only they can move; physical redemption is part of the design.
- **Assumption:** Launch sequencing (which states, which rails first) is
  undecided — counsel's answers reshape it.

## 2. Wallet architecture: what Correnthian controls and does not

- **Established:** Private keys/seeds never leave the user device; the server
  assembles unsigned transactions, the device signs, the server verifies and
  relays (`CLAUDE.md` key boundary; `docs/architecture/key-boundary.md`).
- **Established:** `packages/wallet-core` accepts no HTTP client, RPC
  endpoint, or provider SDK — CI-enforced (`scripts/check-key-boundary.mjs`).
  Server compromise must never yield funds (account ≠ wallet ownership).
- **Established:** Two account kinds only — `SmartAccount` (EVM, passkey) and
  `SeedAccount` (Bitcoin/Solana only); no recovery key material held, recovery
  via on-chain guardians where the chain supports them (`key-boundary.md`).
- **Established:** No key material in any `.env*` (CI-scanned); secrets
  redacted in logs (`@correnthian/security`).
- **Question:** Does this architecture place any regulated activity
  (transmission, custody, brokerage) on Correnthian despite holding no keys?
  (§6.2–6.4).

## 3. End-to-end proposed flows

| Flow | State |
|---|---|
| Fiat → crypto (card/bank via on-ramp vendor) | **Proposed, unbuilt.** `services/api/src/onramp/` refuses without a contracted provider. No vendor selected. |
| Crypto → tokenized gold/silver (buy) | **Proposed, unbuilt.** Blocked on issuer contract (BE-802). Fee preview exists; execution does not. |
| Metals → crypto (sell-back) | **Proposed.** Everyday exit path; market rails, not yet contracted. |
| Withdrawals (crypto to external address) | **Built:** intent → assemble → device signs → relay → confirmation counting, all live-tested on Sepolia. |
| Fees | **Built:** itemised preview + rule table; unknown shown as unknown, never zero. No live rates committed. |
| Physical redemption | **State machine built; execution unbuilt.** Request → approve → produce → ship → deliver transitions exist with allowlists; settlement mechanics await issuer terms. Tether's published terms ($100k minimum lot) make direct redemption wholesale-only — see §6.7. |

## 4. Intended roles of third parties

- **Issuers** (e.g. TG Commodities/XAUT — in discussion via existing owner
  account; diligence pack at `docs/operations/xaut-diligence-pack.md`):
  mint tokens, hold backing, publish attestations, settle redemption. **They
  never hold user keys or move user funds.**
- **Custodians:** the *issuers'* vault operators, disclosed per asset
  (custodian, vaults, proof-of-reserve URL) — not Correnthian vendors.
- **Exchanges/LPs:** secondary-market sell-back rails; none contracted.
- **On/off-ramp providers:** card/bank conversion; none contracted (shortlist:
  MoonPay, Transak, Banxa, Stripe — unevaluated).
- **RPC providers:** Alchemy (primary) + Infura (failover), live for
  Ethereum, Sepolia, Base. Pure infrastructure: they see addresses looked
  up, never keys.
- **Market-data vendors:** Chainlink oracle (primary, engineering) + one
  commercial fallback (open). No vendor chosen.

## 5. Compliance posture as built

- **Sanctions/KYC/AML:** Persona screening (inquiry ids + decision codes
  only — documents/biometrics never touch our servers,
  `docs/architecture/threat-model.md`); sanctions hits latch until human
  decision; fiat gates fail closed; rescreening job; review queue.
- **Jurisdiction:** deny-by-default engine (`JurisdictionService`), unmatched
  locations refused (HTTP 451); seeded rules are development placeholders,
  not legal positions; operator console edits audited with reasons.
- **Monitoring:** confirmation/drop/reorg tracking; ambiguous-fee refusal;
  full audit trail (append-only, redacted on write).
- **Privacy holdings:** account PII is email/country/region, device
  labels/push tokens (threat-model asset table). No documents, no biometrics,
  no key material — ever.

## 6. Questions requiring counsel

### 6.1 Entity and licensing
1. Entity structure review for the registered Delaware C-Corp (classes,
   governance, qualified states) for the described activity?
2. State money-transmitter analysis, state by state, for: (a) fiat→crypto via
   a licensed on-ramp vendor where we never touch fiat; (b) crypto→metal-token
   swaps we assemble but never execute; (c) batched physical redemptions (§6.7).
3. Federal digital-asset rules applicable to a non-custodial software
   interface to third-party tokens (FinCEN administrator/exchanger analysis)?

### 6.2 Securities and commodities
4. Are the listed gold tokens securities, commodities, or neither for our
   purposes — and does the answer change if we display yield-like features
   (e.g. Kinesis-style rewards) or market them a particular way?
5. CFTC vs SEC posture for metal tokens sold to non-crypto retail buyers?

### 6.3 Sanctions / KYC / AML
6. Adequacy of the built posture (vendor verdicts + latching + fail-closed
   gates + 24h rescreening) for a pre-launch program; what a BSA/AML program
   must add (officer, training, SAR workflow, record retention)?
7. Transaction-monitoring expectations for on-chain legs we index but do not
   execute (structuring/velocity detection — BE-1102 is unbuilt)?

### 6.4 Consumer disclosures and privacy
8. Required disclosures at buy, fee preview, and redemption (state UDAP risk
   of "gold you own outright" style claims)?
9. Privacy assessment of holdings (email + country + device data; pointer-only
   KYC) — CCPA/state-privacy and data-retention obligations?

### 6.5 Redemption arrangements
10. Does batching many users' metal into one $100k settlement lot need a
    licence wrapper or change the transmitter analysis?
11. Who legally executes each leg (user signs; we relay; issuer settles) and
    where does liability for failed delivery sit?

## 7. Unresolved product questions gated on the above

- Transaction batching model (aggregate vs individual lots).
- Seed-account recovery (guardians have no BTC/SOL equivalent — BE-203b).
- Supported chains beyond Ethereum/Base/Sepolia (ADR-021 open).
- Jurisdictional launch scope and the rule content (placeholders today).
- Fee/rate commitments (none made; fee table empty by default).

## 8. Prioritised questions for the first consultation

1. Money-transmitter exposure of the three flows (§6.1 Q2) — the answer that
   reshapes everything downstream. *(30 min)*
2. Securities/commodities characterisation of listing third-party gold
   tokens to retail (§6.2). *(20 min)*
3. Batching + redemption liability (§6.5). *(15 min)*
4. BSA/AML program gap vs built posture (§6.3). *(15 min)*
5. Entity + engagement shape if the call goes well (retainer vs project,
   fee estimate, deliverables list). *(10 min)*

## 9. Documents for counsel + evidence to collect

- This memo; `docs/agent/MASTER_CONTEXT.md`; `docs/architecture/key-boundary.md`;
  `docs/architecture/threat-model.md`; `docs/operations/third-parties.md`;
  `docs/operations/xaut-diligence-pack.md`; `docs/agent/DECISIONS.md` (ADRs
  003, 021, 022); `docs/agent/BACKEND_TASKS.md` §§20–21 (blockers, counts).
- Evidence to collect: issuer term sheets + attestation samples; on-ramp
  vendor contracts when selected; Alchemy/Infura DPAs; Sentry/data-processor
  terms at hosting decision; formation documents once entity is chosen.

---

*Legend used throughout: **Established** = in-repo, cited. **Proposed** =
intended, gated. **Assumption** = needs validation. **Question** = counsel
only. No company facts, vendor commitments, legal conclusions, licensing
status, or unimplemented features are asserted as fact in this memo.*
