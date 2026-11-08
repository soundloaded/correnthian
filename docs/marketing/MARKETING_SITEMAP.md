# Correnthian — Marketing Sitemap & Page Architecture (Phase 5)

> **Purpose**: Define the complete navigation architecture, page inventory, and section-by-section blueprint for the Correnthian marketing website, mapping our strategic positioning onto the [`habitline-next`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/app) layout system.

---

## 1. Navigation Architecture (Inspired by Goldmoney's Restraint + Paxos's Proof)

One of the clearest lessons from our competitive research is **navigation restraint**:
- **Kinesis** overwhelms visitors with 7 mega-menus and 35+ sub-links.
- **Goldmoney** builds instant institutional calm with 4 focused top-level links (`Why Goldmoney`, `Why Precious Metals`, `Research`, `Investors`) + `Sign in` / `Open an account`.

### 1.1 Recommended Top Floating Pill Navbar (`Navbar.tsx`)
Preserving `habitline-next`'s signature floating pill navbar (`.nav-menu-wrapper` / `.nav-menu`), we structure the top navigation into **6 clean destinations + 1 primary CTA**:

1. **Home** (`/`)
2. **Precious Metals** (`/precious-metals` — *or mapped to `/features#metals` in Phase 1 rollout*)
3. **Self-Custody & Security** (`/security` — *or mapped to `/features`*)
4. **Fees** (`/pricing`)
5. **About** (`/about`)
6. **FAQ** (`/faq`)
- **Primary Navbar CTA Button**: **Open Your Vault** (or **Request Early Access** while client wallet apps are in pre-release)

### 1.2 Footer Sitemap Matrix (`Footer.tsx`)
The footer organizes all 11 strategic pages across 4 clear columns:
- **Platform**: Home (`/`), Precious Metals (`/precious-metals`), Wallet & Self-Custody (`/wallet`), Supported Assets & Networks (`/assets`), How It Works (`/#how-it-works`)
- **Trust & Transparency**: Security & Key Boundary (`/security`), Fees & Zero-Spread Policy (`/pricing`), Issuer Backing & Audits (`/precious-metals#backing`), Redemption Rules (`/precious-metals#redemption`)
- **Company & Help**: About Correnthian (`/about`), FAQ (`/faq`), Contact & Support (`/contact`)
- **Legal & Compliance**: Terms of Service (`/terms`), Privacy Policy (`/privacy`), Risk & Regulatory Disclosures (`/disclosures`), Jurisdiction Availability (`/disclosures#jurisdictions`)

---

## 2. Evaluation of All 11 Strategic Pages & Mapping to `habitline-next`

[`apps/marketing/src/app`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/app) currently contains 8 built routes from `habitline-next`:
- `/` (`src/app/home`)
- `/about` (`src/app/about`)
- `/features` (`src/app/features`)
- `/pricing` (`src/app/pricing`)
- `/faq` (`src/app/faq`)
- `/contact` (`src/app/contact`)
- `/privacy` (`src/app/privacy`)
- `/terms` (`src/app/terms`)

Below is the page-by-page specification for all 11 strategic areas, showing both how they map to the existing 8 `habitline-next` routes and where dedicated routes (`/precious-metals`, `/security`, `/disclosures`) can be added or consolidated.

---

### Page 1: Home (`/`)

- **Page Purpose**: Immediately establish Correnthian as the self-custodial platform for holding allocated tokenized gold, silver, and crypto — answering *"What am I holding, who backs it, and can I take it out?"* within 30 seconds of scrolling.
- **Target Visitor**: First-time visitors (both non-crypto gold savers and self-custody crypto holders).
- **Key Questions Answered**:
  1. What is Correnthian and how is it different from a bullion broker or standard crypto wallet?
  2. Do I actually control my keys, and what backs the gold and silver tokens?
  3. How do fees, vaulting, and physical redemption work?
- **Section Order (Mapped 1:1 to `apps/marketing/src/app/home/components/`)**:
  1. **`Hero.tsx`**:
     - Pill badge: `SELF-CUSTODIAL BULLION & CRYPTO WALLET`
     - H1: *"Own physical-backed gold, silver, and crypto under your own keys."*
     - Subheadline explaining passkey self-custody + verified third-party issuer backing (`PAXG`, `XAUT`) + 3-line zero-spread fees.
     - Dual CTA (`Open Your Vault` / `Inspect Backing Model`) + Centerpiece dark-obsidian & gold portfolio showcase (`user_web_dashboard_reference.jpeg` aesthetic) + Marquee strip of verified architectural facts (`Zero Server Keys • Allocated LBMA Bullion Issuers • 3-Line Itemised Fees • Passkey Smart Account • Ethereum & Base`).
  2. **`About.tsx` (The Problem & The Wedge)**:
     - Contrasts the two broken choices in the market today: **Broker Custody** (you own an IOU in a platform database) vs. **Blind Crypto Wallets** (you hold a ticker with zero visibility into physical bar backing or seed-phrase recovery safety).
     - Introduces Correnthian's 3-part answer: **What you hold • Who backs it • How you take it out**.
  3. **`Features.tsx` (Bento Grid of Core Capabilities)**:
     - Card 1: **Allocated Gold & Silver Registry** (`Fine troy oz & gram precision`, `allocated` vs `unallocated` vs `synthetic` badges).
     - Card 2: **Passkey-First Self-Custody** (`ERC-4337 SmartAccount` + optional BIP-39 `SeedAccount` export).
     - Card 3: **Unified Hard-Money Portfolio** (Hold `PAXG`, `XAUT`, `ETH`, `USDC` side by side on Ethereum and Base).
     - Card 4: **Three-Line Pre-Signature Fees** (`Provider`, `Network`, `Correnthian` — zero hidden spread).
  4. **`SmartAssist.tsx` (Interactive Backing & Ownership Inspector)**:
     - Maps Habitline's `SmartAssist` interactive showcase into the **Live Backing & Fee Disclosure Inspector**: shows how every holding card reveals the legal issuer (e.g., Paxos Trust / TG Commodities), vault custodian (Brink's London / Swiss vaults), Proof-of-Reserve attestation link, and redemption rules before you sign.
  5. **`Stats.tsx` (Architectural Verification Metrics — Zero Fabricated Numbers)**:
     - Replaces generic SaaS vanity metrics with verifiable architectural standards:
       - `0` Keys Held by Correnthian (`CI-enforced zero-key boundary`)
       - `1:1` Allocated Fine Troy Ounce Backing (`On verified physical-backed tokens like PAXG & XAUT`)
       - `3-Line` Pre-Signature Fee Itemisation (`0.00% hidden exchange-rate spread`)
       - `24/7` On-Chain Portability (`Ethereum Mainnet & Base`)
  6. **`Customer.tsx` / How It Works & Use Cases**:
     - Replaced with **How Correnthian Works (4 Clear Steps)** + **Who Correnthian Is Built For** (no fabricated testimonials; uses persona case cards: *The Bullion Preservationist*, *The Self-Custody Crypto Holder*, *The Treasury / Family Office*).
  7. **`Download.tsx` (Closing Conversion Section + Non-Custodial Disclosure)**:
     - High-contrast obsidian & bullion-gold callout with passkey onboarding preview and clear legal role disclosure footer.
- **Trust Signals Required**: Zero-key architecture badge, explicit distinction between Correnthian (wallet interface) and regulated token issuers (Paxos, Tether Gold), and 3-line fee preview UI.
- **Primary CTA**: `Request Early Access` / `Open Your Vault`
- **Secondary CTA**: `Explore How Backing Works` -> `/features`

---

### Page 2: Features — Wallet, Self-Custody, Precious Metals & How It Works (`/features`)

> *Note*: In the current 8-route `habitline-next` structure, `/features` serves as the comprehensive deep-dive covering **Precious Metals (`#metals`)**, **Wallet & Passkey Self-Custody (`#wallet`)**, **How It Works (`#how-it-works`)**, and **Supported Assets & Networks (`#networks`)**. Dedicated standalone routes (`/precious-metals`, `/security`) can also alias or split from this page.

- **Page Purpose**: Provide the technical, operational, and legal-chain proof behind Correnthian's four pillars.
- **Target Visitor**: High-intent buyers evaluating *how* passkey self-custody works, *how* `PAXG`/`XAUT` backing is verified, and *how* buying, sending, and redeeming operate step-by-step.
- **Key Questions Answered**:
  1. How does a passkey `SmartAccount` work if there is no 12-word seed phrase on day one, and can I export a seed later?
  2. What is the difference between `allocated`, `unallocated`, and `synthetic` metal tokens in Correnthian's registry?
  3. How does the 4-party chain of integrity work (User Keys -> Correnthian Interface -> Regulated Issuer -> Physical Vault)?
  4. What are the actual rules and minimums for physical bullion redemption?
  5. Which blockchains and assets are supported today vs. on the roadmap?
- **Section Order**:
  1. **Hero (`FeatureHero.tsx`)**: *"Engineered for Sovereign Ownership of Bullion and Crypto."*
  2. **Section A — Precious Metals & The Backing Registry (`#metals`)**:
     - Detailed breakdown of `BackingDisclosure`: `allocated` vs `unallocated` vs `synthetic`, fine troy oz (`31.1034768g`) & gram display, issuer attestation links, and comparison of registered tokens (`PAXG` by Paxos Trust in Brink's London vaults; `XAUT` by TG Commodities in Swiss vaults).
  3. **Section B — Progressive Self-Custody & Key Boundary (`#wallet`)**:
     - Explains Tier 1 (`SmartAccount` via device passkey + ERC-4337 P-256 verification + gas sponsorship on eligible ops) and Tier 2 (`SeedAccount` BIP-39 export for advanced users).
     - Explains `ADR-002`: why Correnthian's backend literally cannot sign or freeze your on-chain tokens.
  4. **Section C — How It Works (`#how-it-works`)**:
     - Step 1: Create your passkey vault in seconds (no seed phrase required to start).
     - Step 2: Inspect the asset's `BackingDisclosure` and 3-line fee quote (`Provider`, `Network`, `Correnthian`).
     - Step 3: Fund via existing crypto or regulated third-party fiat on-ramp partners (who complete statutory KYC).
     - Step 4: Hold in self-custody, transfer 24/7 on Ethereum/Base, or initiate issuer redemption (`[REQUIRES LEGAL / ISSUER / PRODUCT APPROVAL]`).
  5. **Section D — Supported Assets & Networks (`#networks`)**:
     - Honest status table distinguishing **Live EVM Networks (`Ethereum Mainnet`, `Base`)**, **Curated Precious Metal & Crypto Tokens (`PAXG`, `XAUT`, `ETH`, `USDC`)**, and **Planned Roadmap (`Bitcoin`, `Solana`, expanded silver tokens)**.
- **Trust Signals Required**: Code-level `BackingDisclosure` schema preview, issuer vs. wrapper comparison (lesson from KMS Labs), and honest redemption minimum disclosures.
- **Primary CTA**: `Inspect Fee Schedule` -> `/pricing`
- **Secondary CTA**: `Read FAQ` -> `/faq`

---

### Page 3: Fees & Pricing (`/pricing`)

- **Page Purpose**: Eliminate the #1 source of distrust in both retail bullion apps and crypto wallets — hidden spreads and surprise storage/withdrawal fees.
- **Target Visitor**: Cost-conscious gold and crypto buyers comparing Correnthian against BullionVault, OneGold, Goldmoney, Kinesis, and MetaMask/Trust Wallet swaps.
- **Key Questions Answered**:
  1. Does Correnthian charge an ongoing annual storage or custody fee?
  2. How are transaction costs broken down before I sign?
  3. Does Correnthian mark up the exchange rate or hide profit in the bid/ask spread?
  4. What fees are charged by third-party issuers, on-ramp providers, or blockchain networks?
- **Section Order (Mapped to `apps/marketing/src/app/pricing/components/`)**:
  1. **`PricingHero.tsx`**:
     - H1: *"Three fee lines before you sign. Zero hidden spread."*
     - Subheadline: Explains `ADR-005` and `ADR-021` — Correnthian never hides revenue inside an inflated exchange rate.
  2. **The Three-Line Pre-Signature Breakdown Card**:
     - Visual interactive breakdown of a sample quote showing:
       1. `Provider / Issuer Fee` (paid to the liquidity provider, on-ramp, or token issuer)
       2. `Network Fee` (actual blockchain gas on Ethereum or Base — or `$0.00 Sponsored` on eligible first-party SmartAccount ops per `ADR-022`)
       3. `Correnthian Platform Fee` (explicit, flat percentage disclosed before signing — `[EXACT % SCHEDULE REQUIRES COMMERCIAL / PRODUCT SIGN-OFF]`)
  3. **Fee Category Matrix (Holding vs. Buying/Selling vs. Sending vs. Issuer Redemption)**:
     - **Holding & Self-Custody**: `$0 / 0.00%` charged by Correnthian (`PAXG` and `XAUT` also charge `0.00%` annual storage fee from their issuers; note Paxos's 0.02% on-chain transfer fee where applicable).
     - **On-Chain Receiving**: `$0` from Correnthian.
     - **On-Chain Sending**: Standard Ethereum/Base network gas (no Correnthian markup on gas).
     - **Buying & Selling via Partners**: Itemised `Provider` + `Network` + `Correnthian` fee shown on every quote before signature.
     - **Physical Redemption**: Subject to the underlying issuer's published redemption schedule, fabrication/withdrawal fees, and minimums (`[REQUIRES LEGAL / ISSUER / PRODUCT APPROVAL]`).
  4. **`PricingFaq.tsx`**: Focused FAQ on spreads, gas sponsorship, issuer storage fees, and tax/reporting records.
- **Trust Signals Required**: Side-by-side contrast of "Hidden Spread Model (Typical Apps)" vs. "Correnthian 3-Line Itemised Quote."
- **Primary CTA**: `Request Early Access`
- **Secondary CTA**: `Explore Supported Assets` -> `/features#networks`

---

### Page 4: About Correnthian (`/about`)

- **Page Purpose**: Explain *why* Correnthian exists, our architectural philosophy, and our strict separation of duties as a Delaware C-Corp software platform.
- **Target Visitor**: Due-diligence researchers, HNW buyers, institutional partners, and prospective team members.
- **Key Questions Answered**:
  1. Why did Correnthian build a self-custody wallet specifically for precious metals and crypto?
  2. What is Correnthian's legal and operational role — and what does Correnthian explicitly *refuse* to do?
  3. What engineering principles govern the platform?
- **Section Order (Mapped to `apps/marketing/src/app/about/components/`)**:
  1. **`AboutHero.tsx`**: *"Built for buyers who want real gold and silver — without surrendering custody."*
  2. **`Vision.tsx` (The Three Non-Negotiable Boundaries)**:
     - **We Are Not a Custodian**: We never hold your keys or pool your assets.
     - **We Are Not a Token Issuer**: We curate and verify established third-party tokens (`PAXG`, `XAUT`) rather than minting an unverified house token.
     - **We Are Not a Hidden-Spread Broker**: We surface every counterparty, vault, and fee line before you sign.
  3. **`Values.tsx` (Engineering & Security Principles)**:
     - Zero-Key CI Enforcement (`ADR-002`), Composite Asset Verification (`ADR-004`), Fail-Closed Compliance & Privacy Redaction (`ADR-008`, `ADR-012`), Multi-Provider RPC Resilience (`ADR-017`).
  4. **Corporate & Compliance Transparency**:
     - Identifies Correnthian Inc. (Delaware C-Corp) and explains our collaboration with regulated third-party token issuers, KYC/identity providers, and liquidity partners (`[REQUIRES LEGAL COUNSEL REVIEW]`).
- **Primary CTA**: `Inspect Security & Architecture` -> `/features#wallet`
- **Secondary CTA**: `Contact Our Team` -> `/contact`

---

### Page 5: Frequently Asked Questions (`/faq`)

- **Page Purpose**: Answer the hardest, most skeptical questions across Ownership, Precious Metal Backing, Self-Custody & Recovery, Fees, Redemption, and Regulation/Jurisdictions.
- **Target Visitor**: Careful buyers performing final due diligence before onboarding.
- **Key Questions Answered (Organized into 5 Clear Categories)**:
  1. **Ownership & Backing**: Does Correnthian issue its own gold token? How do I know the gold actually exists? What is the difference between allocated, unallocated, and synthetic? What happens if Correnthian goes out of business?
  2. **Wallet, Passkeys & Recovery**: How does a passkey wallet work without a 12-word seed phrase? Can I still export a standard seed phrase? Can Correnthian freeze my on-chain wallet?
  3. **Buying, Selling & Fees**: Why are there three lines on every fee quote? Does Correnthian charge annual vault storage fees? Who processes my bank transfer or card payment?
  4. **Physical Redemption**: Can I redeem my tokens for physical gold or silver bars? Why do issuers like Paxos and Tether Gold have high direct bar minimums, and how do smaller redemptions work?
  5. **Compliance, KYC & Jurisdictions**: When is identity verification (KYC) required? Which countries and jurisdictions are restricted?
- **Primary CTA**: `Still Have Questions? Contact Support` -> `/contact`

---

### Page 6: Contact & Support (`/contact`)

- **Page Purpose**: Provide clear channels for customer support, institutional/issuer partnership inquiries, and security/compliance reporting.
- **Target Visitor**: Prospective users, liquidity/issuer partners, and support seekers.
- **Section Order**:
  1. **Support & Inquiry Routing Cards**:
     - Client & Early Access Inquiries
     - Issuer, Liquidity & Institutional Partnerships
     - Security & Compliance Disclosures
  2. **Direct Contact Form (`ContactForm.tsx`)** with clear security notice: *"Correnthian Support will never ask for your passkey, device biometrics, or 12-word recovery phrase."*
  3. **Quick FAQ & Documentation Links**.

---

### Pages 7 & 8: Legal, Privacy, Terms & Risk Disclosures (`/terms`, `/privacy`)

- **Page Purpose**: Present plain-English summaries paired with structured legal disclosures covering non-custodial software terms, third-party issuer risks, physical redemption terms, privacy/PII redaction (`ADR-012`), and sanctioned-jurisdiction restrictions (`ADR-013`).
- **Mandatory Banner**: All legal and regulatory language on `/terms` and `/privacy` is flagged with `[REQUIRES LEGAL COUNSEL APPROVAL BEFORE PRODUCTION LAUNCH]` per [`docs/compliance/counsel-briefing-memo.md`](file:///Users/mayaoflagos/correnthian/docs/compliance/counsel-briefing-memo.md).
