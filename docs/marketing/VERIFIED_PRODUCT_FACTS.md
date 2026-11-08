# Correnthian — Verified Product Facts (Phase 1 Ground Truth)

> **Purpose**: Establish the authoritative, code-and-documentation-verified baseline for Correnthian's marketing strategy, competitive positioning, and website copy. Every public marketing claim must trace back to this document and obey the classification below.
>
> **Audit Date**: 2026-10-31
> **Primary Repository Sources**:
> - [`docs/agent/MASTER_CONTEXT.md`](file:///Users/mayaoflagos/correnthian/docs/agent/MASTER_CONTEXT.md)
> - [`docs/agent/ARCHITECTURE.md`](file:///Users/mayaoflagos/correnthian/docs/agent/ARCHITECTURE.md)
> - [`docs/agent/SECURITY_RULES.md`](file:///Users/mayaoflagos/correnthian/docs/agent/SECURITY_RULES.md)
> - [`docs/agent/DECISIONS.md`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md) (ADR-001 through ADR-023)
> - [`docs/agent/CURRENT_SPRINT.md`](file:///Users/mayaoflagos/correnthian/docs/agent/CURRENT_SPRINT.md)
> - [`docs/agent/PROVIDERS.md`](file:///Users/mayaoflagos/correnthian/docs/agent/PROVIDERS.md)
> - [`docs/agent/BLOCKCHAINS.md`](file:///Users/mayaoflagos/correnthian/docs/agent/BLOCKCHAINS.md)
> - [`docs/agent/DESIGN_SYSTEM.md`](file:///Users/mayaoflagos/correnthian/docs/agent/DESIGN_SYSTEM.md)
> - [`docs/product/vision.md`](file:///Users/mayaoflagos/correnthian/docs/product/vision.md)
> - [`docs/compliance/overview.md`](file:///Users/mayaoflagos/correnthian/docs/compliance/overview.md)
> - [`docs/compliance/counsel-briefing-memo.md`](file:///Users/mayaoflagos/correnthian/docs/compliance/counsel-briefing-memo.md)
> - [`docs/operations/third-parties.md`](file:///Users/mayaoflagos/correnthian/docs/operations/third-parties.md)
> - [`docs/operations/xaut-diligence-pack.md`](file:///Users/mayaoflagos/correnthian/docs/operations/xaut-diligence-pack.md)
> - [`docs/architecture/key-boundary.md`](file:///Users/mayaoflagos/correnthian/docs/architecture/key-boundary.md)
> - [`docs/architecture/asset-registry.md`](file:///Users/mayaoflagos/correnthian/docs/architecture/asset-registry.md)

---

## 1. Core Identity & Product Wedge

### 1.1 What Correnthian Is
Correnthian is a **self-custodial platform for holding and buying tokenized precious metals alongside cryptocurrency** ([`docs/agent/MASTER_CONTEXT.md`](file:///Users/mayaoflagos/correnthian/docs/agent/MASTER_CONTEXT.md)).

### 1.2 Beachhead Customer
- **Primary persona**: The gold-owning, non-crypto buyer who wants real precious-metal exposure without surrendering custody to a broker or vault platform, and who refuses to manage a 12-word recovery phrase on day one ([`docs/product/vision.md`](file:///Users/mayaoflagos/correnthian/docs/product/vision.md)).
- **Secondary persona**: The self-custody crypto holder who wants physical-backed gold and silver in the same wallet alongside BTC, ETH, and USDC with verifiable issuer backing and zero hidden spread.

### 1.3 The Product Wedge
> **"What am I holding, who backs it, and can I take it out."**

Every precious-metal token surfaced in Correnthian is registered in [`packages/assets`](file:///Users/mayaoflagos/correnthian/packages/assets) with a canonical composite identifier (`<chainId>:<contractAddress|native>:<issuerId>`) and a structured [`BackingDisclosure`](file:///Users/mayaoflagos/correnthian/docs/architecture/asset-registry.md) that surfaces on every holding screen, quote card, and marketing asset page:
1. **Backing Type**: `allocated` (specific physical bars held in a named vault), `unallocated` (claim on a pool of metal), or `synthetic` (price-tracking derivative — never badged as physical metal).
2. **Issuer & Legal Entity**: The regulated or corporate issuer of the token (e.g., Paxos Trust Company for PAXG, TG Commodities Limited for XAUT). Correnthian never issues tokens.
3. **Custodian & Vault Location**: The vault operator and jurisdiction(s) disclosed by the issuer (e.g., Brink's vaults in London for PAXG; Swiss vaults for XAUT).
4. **Proof-of-Reserve & Last Attestation**: Direct link to the issuer's latest independent auditor attestation report and date.
5. **Unit Ratio & Redemption Terms**: Exact fine-troy-ounce or gram ratio per token (`ouncesPerToken`, `gramsPerToken`) and the issuer's minimum physical redemption threshold and fees.

### 1.4 The Three "Never" Boundaries (Hard Architectural & Legal Rules)
Per [`docs/agent/MASTER_CONTEXT.md`](file:///Users/mayaoflagos/correnthian/docs/agent/MASTER_CONTEXT.md) and [`docs/compliance/overview.md`](file:///Users/mayaoflagos/correnthian/docs/compliance/overview.md):
1. **Not a Token Issuer**: Correnthian registers existing, third-party-issued precious-metal tokens. Correnthian never mints, issues, or represents any token as "Correnthian Gold" or "Correnthian Silver."
2. **Not a Custodian**: Correnthian never holds user assets, private keys, seed phrases, passkey private keys, or signing shares. Enforced at CI build time by [`scripts/check-key-boundary.mjs`](file:///Users/mayaoflagos/correnthian/scripts/check-key-boundary.mjs) ([`ADR-002`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md)).
3. **Not a Broker/Dealer Taking Principal Risk**: Correnthian routes user-signed orders to contracted third-party liquidity providers/issuers and charges an explicit, itemised platform fee with **zero hidden spread**.

---

## 2. Capability Classification Matrix

To prevent marketing overreach or regulatory exposure, every product capability is classified into one of four states:
- **STATE A — Implemented in Repository Today**: Built, tested, and verifiable in the codebase.
- **STATE B — Planned / In-Architecture (Not Yet Live in End-User App)**: Defined in ADRs, domain packages, or backend state machines, but client-side UI or on-chain contract deployment is still in progress.
- **STATE C — Externally Dependent (Partner / Provider Contract Pending)**: Backend interfaces and refusal guards exist, but live execution awaits commercial contracts and production credentials.
- **STATE D — Legally Unverified / Requires Counsel or Issuer Sign-Off**: Cannot be promised as a live, unconditional capability until legal counsel ([`docs/compliance/counsel-briefing-memo.md`](file:///Users/mayaoflagos/correnthian/docs/compliance/counsel-briefing-memo.md)) or the token issuer approves.

| Capability Domain | Specific Feature / Claim | Classification | Code / Doc Reference | Marketing Guidance |
| :--- | :--- | :--- | :--- | :--- |
| **Custody & Key Boundary** | Server-side zero-key architecture (backend never imports or stores private keys/mnemonics/signing shares) | **STATE A — Implemented** | [`scripts/check-key-boundary.mjs`](file:///Users/mayaoflagos/correnthian/scripts/check-key-boundary.mjs), [`ADR-002`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md) | Safe to claim as a core architectural guarantee. |
| **Asset Registry & Backing** | Composite asset ID (`chainId:contract:issuerId`) + structured `BackingDisclosure` (`allocated` / `unallocated` / `synthetic`, custodian, vault, PoR URL, attestation date) | **STATE A — Implemented** | [`packages/assets`](file:///Users/mayaoflagos/correnthian/packages/assets), [`ADR-004`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md) | Safe to feature prominently as Correnthian's signature transparency model. |
| **Fee Transparency** | Three-line itemised fee disclosure (`provider`, `network`, `correnthian`) shown before signature; zero hidden spread | **STATE A — Implemented** | [`packages/domain`](file:///Users/mayaoflagos/correnthian/packages/domain), [`ADR-005`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md), [`ADR-021`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md) | Safe to claim the **structure** (3-line itemisation, zero hidden spread). Exact % rates must be flagged until commercial fee schedule is locked. |
| **EVM Chain Connectivity** | Live JSON-RPC connectivity, multi-provider failover (`RpcPool` with Alchemy + Infura), ERC-20 & native balance indexing, unsigned tx assembly, and EIP-1559 fee estimation on **Ethereum Mainnet (`1`)**, **Base (`8453`)**, and **Sepolia (`11155111`)** | **STATE A — Implemented** | [`packages/blockchain`](file:///Users/mayaoflagos/correnthian/packages/blockchain), [`services/api/src/blockchain`](file:///Users/mayaoflagos/correnthian/services/api/src/blockchain), [`ADR-017`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md) | Safe to state Ethereum and Base support for ERC-20 tokenized metals and crypto. |
| **Send / Receive Verification** | Backend assembles unsigned tx, verifies client signature recovers the sender address (`recoverTransactionAddress`), broadcasts, and sweeps block confirmations (`12` blocks on Ethereum, `10` on Base) | **STATE A — Implemented** | `BE-601`, `BE-602` in [`docs/agent/CURRENT_SPRINT.md`](file:///Users/mayaoflagos/correnthian/docs/agent/CURRENT_SPRINT.md), [`ADR-023`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md) | Safe to describe how non-custodial transaction signing and finality verification work. |
| **Jurisdiction & Sanctions Enforcement** | Deny-by-default `JurisdictionService` returning HTTP 451 for OFAC comprehensively sanctioned regions (`CU`, `IR`, `KP`, `SY`, `RU`, `BY`) and unknown regions | **STATE A — Implemented** | [`services/api/src/compliance`](file:///Users/mayaoflagos/correnthian/services/api/src/compliance), [`ADR-008`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md), [`ADR-013`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md) | Safe and required to disclose geographic availability restrictions in FAQ and Legal pages. |
| **Privacy & Audit Redaction** | Recursive PII/secret stripping (`redactDeep`) on audit logs and append-only audit trail | **STATE A — Implemented** | [`services/api/src/audit`](file:///Users/mayaoflagos/correnthian/services/api/src/audit), [`ADR-012`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md) | Safe to describe in Security & Privacy architecture. |
| **Passkey Smart Account (ERC-4337) & Optional Seed Export** | Progressive self-custody: start with device passkey (`SmartAccount` via ERC-4337 + P-256 verifier) and optionally add/export a BIP-39 `SeedAccount`; gas sponsorship on first-party operations (`ADR-022`) | **STATE B — Planned / In-Architecture** | [`packages/wallet-core`](file:///Users/mayaoflagos/correnthian/packages/wallet-core), [`ADR-003`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md), [`ADR-022`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md) | Present as Correnthian's dual-mode self-custody wallet architecture; note that device client apps (`apps/web`, `apps/mobile`) are in pre-release / early access. |
| **Bitcoin & Solana Support** | Native Bitcoin (`BtcAdapter`) and Solana (`SolAdapter`) support | **STATE B — Planned (Post-v1 / Deferred)** | [`docs/agent/BLOCKCHAINS.md`](file:///Users/mayaoflagos/correnthian/docs/agent/BLOCKCHAINS.md), [`docs/agent/CURRENT_SPRINT.md`](file:///Users/mayaoflagos/correnthian/docs/agent/CURRENT_SPRINT.md) | Present EVM (Ethereum + Base) as primary launch networks; label Bitcoin and Solana as roadmap / expanding multi-chain support where listed. |
| **Fiat On-Ramp / Off-Ramp** | Buying via bank transfer or card through a regulated third-party on-ramp provider (`OnRampService`) | **STATE C — Externally Dependent** | [`docs/agent/PROVIDERS.md`](file:///Users/mayaoflagos/correnthian/docs/agent/PROVIDERS.md), [`ADR-015`](file:///Users/mayaoflagos/correnthian/docs/agent/DECISIONS.md) | Explain clearly that fiat-to-crypto/metal settlement is processed by regulated third-party payment partners (who perform KYC and appear on the user's bank statement). Do not name an uncontracted on-ramp partner as signed. |
| **Precious Metal Quote & Trade Execution** | Live binding quotes and buy/sell execution for tokenized gold (e.g. XAUT, PAXG) and silver | **STATE C — Externally Dependent** | [`docs/operations/xaut-diligence-pack.md`](file:///Users/mayaoflagos/correnthian/docs/operations/xaut-diligence-pack.md), `BE-802` | Reference PAXG and XAUT accurately as third-party tokenized gold examples with verified public specs, while noting that live liquidity-provider execution is subject to issuer/LP onboarding. |
| **Physical Bullion Redemption** | Requesting physical bar delivery from the token issuer (`MetalsService` state machine: `requested -> kyc_verified -> burn_pending -> burned -> shipped -> delivered`) | **STATE D — Legally & Partner Gated** | [`docs/compliance/counsel-briefing-memo.md`](file:///Users/mayaoflagos/correnthian/docs/compliance/counsel-briefing-memo.md), [`docs/operations/xaut-diligence-pack.md`](file:///Users/mayaoflagos/correnthian/docs/operations/xaut-diligence-pack.md) | **Critical**: Never claim Correnthian ships gold bars from a "Correnthian vault" or guarantees retail gram-level physical delivery. Always state that physical redemption is governed by the underlying token issuer's terms, minimums (e.g., LBMA 400 oz Good Delivery bar for PAXG/XAUT), KYC, and jurisdiction rules. Flag all redemption copy with `[REQUIRES LEGAL / ISSUER / PRODUCT APPROVAL]`. |

---

## 3. Verified Facts on Referenced Tokenized Metals (From Repository Diligence)

From [`docs/operations/xaut-diligence-pack.md`](file:///Users/mayaoflagos/correnthian/docs/operations/xaut-diligence-pack.md) and [`packages/assets`](file:///Users/mayaoflagos/correnthian/packages/assets):
- **Tether Gold (`XAUT`)**:
  - **Issuer**: TG Commodities Limited (El Salvador, DASP-regulated since Jan 2025; formerly UK).
  - **Contract (Ethereum Mainnet)**: `0x68749665FF8D2d112Fa859AA293F07A622782F38` (6 decimals).
  - **Unit**: 1 XAUT = 1 fine troy ounce (`31.1034768g`) of London Good Delivery gold.
  - **Backing & Vault**: Allocated specific serial-numbered bars in Swiss vaults; lookup tool at `gold.tether.to`.
  - **Storage Fee**: 0% ongoing custody fee charged by issuer; 0.25% issuer fee on direct creation/redemption.
  - **Direct Issuer Minimums**: $100,000 USD minimum for direct primary purchase; full LBMA bar (~430 troy oz) required for direct physical redemption in Switzerland.
- **PAX Gold (`PAXG`)**:
  - **Issuer**: Paxos Trust Company, LLC (regulated by the New York State Department of Financial Services — NYDFS).
  - **Contract (Ethereum Mainnet)**: `0x45804880De22913dAFE09f4980848ECE6EcbAf78` (18 decimals).
  - **Unit**: 1 PAXG = 1 fine troy ounce of a 400 oz London Good Delivery gold bar.
  - **Backing & Vault**: Allocated physical gold held in Brink's vaults in London; monthly third-party attestation reports.
  - **Storage Fee**: 0% ongoing storage fee from Paxos; small on-chain transfer/creation/redemption fee tiers per Paxos schedule.

---

## 4. Non-Negotiable Copy & Compliance Prohibitions

In accordance with [`docs/compliance/overview.md`](file:///Users/mayaoflagos/correnthian/docs/compliance/overview.md) and [`docs/agent/SECURITY_RULES.md`](file:///Users/mayaoflagos/correnthian/docs/agent/SECURITY_RULES.md), Correnthian marketing materials must **NEVER**:
1. Claim or imply that Correnthian is a bank, depository institution, custodian, or FDIC/SIPC-insured account.
2. Claim that Correnthian issues its own gold or silver tokens or operates its own physical vaults.
3. Promise "yield," "interest," "APY," "metalback," or fee-sharing dividends on gold, silver, or crypto holdings (which would create securities/investment-contract exposure).
4. Use "guaranteed return," "risk-free," "inflation-proof guarantee," or personalized investment advice.
5. Hide or obscure the distinction between **token ownership on-chain**, **underlying vault custody by the third-party issuer**, and **physical bar redemption minimums**.
6. Invent fake customer reviews, fake Trustpilot ratings, fake trading volumes, or unsigned auditor/partner logos.
