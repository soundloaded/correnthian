# Correnthian — Complete Website Copy Draft (Phase 6B)

> **Purpose**: Provide complete, original, compliance-disciplined copy for every page and component of the Correnthian marketing website, mapped directly to the [`habitline-next`](file:///Users/mayaoflagos/correnthian/apps/marketing/src) component architecture.
>
> **Companion Documents**:
> - [`VERIFIED_PRODUCT_FACTS.md`](file:///Users/mayaoflagos/correnthian/docs/marketing/VERIFIED_PRODUCT_FACTS.md)
> - [`MARKETING_SITEMAP.md`](file:///Users/mayaoflagos/correnthian/docs/marketing/MARKETING_SITEMAP.md)
> - [`MARKETING_CONTENT_STRATEGY.md`](file:///Users/mayaoflagos/correnthian/docs/marketing/MARKETING_CONTENT_STRATEGY.md)

---

## Global Navigation & Footer Copy

### Top Floating Pill Navbar ([`Navbar.tsx`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/components/Navbar.tsx))
- **Brand Wordmark**: `CORRENTHIAN` (with subtle subtitle badge: `DIGITAL VAULT`)
- **Nav Links**:
  1. `Home` (`/`)
  2. `Precious Metals & Wallet` (`/features`)
  3. `Fees` (`/pricing`)
  4. `About` (`/about`)
  5. `FAQ` (`/faq`)
  6. `Contact` (`/contact`)
- **Primary CTA Button**: `Open Your Vault` *(or `Request Early Access` `[PRE-RELEASE / EARLY ACCESS CAPABILITY]`)*

### Global Footer ([`Footer.tsx`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/components/Footer.tsx))
- **Brand Statement**:
  > **Correnthian Inc.**
  > The self-custodial platform for holding and buying tokenized precious metals alongside cryptocurrency. You hold the keys. Regulated third-party issuers vault the metal. Every fee is itemised before you sign.
- **Footer Regulatory & Role Disclosure (Mandatory on Every Page)**:
  > **Important Disclosures**: Correnthian Inc. is a non-custodial software platform and is not a bank, depository institution, custodian, broker-dealer, or precious-metals token issuer. Correnthian never holds, controls, or has access to your private keys, passkeys, or recovery phrases. Tokenized precious metals accessible through the Correnthian interface (such as PAX Gold `PAXG` and Tether Gold `XAUT`) are issued, custodied, and audited by independent third-party issuers and their designated vault operators. Fiat payment processing, identity verification (KYC), and physical bullion redemption are provided by independent partners subject to their respective terms, minimums, and jurisdictional availability. Digital assets and precious metals involve risk of loss and are not FDIC or SIPC insured. `[REQUIRES LEGAL COUNSEL APPROVAL]`

---

## Page 1: Homepage (`/`) — Mapped to `src/app/home/components/`

### 1.1 Hero Section ([`Hero.tsx`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/app/home/components/Hero.tsx))
- **Eyebrow Pill Badge**:
  `SELF-CUSTODIAL PRECIOUS METALS & CRYPTO PLATFORM`
- **Primary H1 Headline**:
  **Own physical-backed gold, silver, and crypto under your own keys.**
- **Hero Subheadline**:
  Hold allocated precious-metal tokens alongside core digital assets in a vault only you control. Correnthian pairs passkey self-custody with verified issuer backing disclosures, vault attestation links, and three-line itemised fees — with zero hidden spread and zero broker custody.
- **Primary CTA**: `Open Your Vault` *(or `Request Early Access`)*
- **Secondary CTA**: `Inspect How Backing Works` (links to `/features#metals`)
- **Centerpiece Visual Card Overlay (Matching `user_web_dashboard_reference.jpeg`)**:
  - Header: `CORRENTHIAN DIGITAL VAULT • SELF-CUSTODY PORTFOLIO`
  - Asset Row 1 (Gold): `Allocated Gold (PAXG / XAUT) • 1.000 oz t (31.103g) • Allocated Physical Vault • Brink's London / Switzerland`
  - Asset Row 2 (Silver): `Allocated Silver • 24.113 oz t (750.00g) • Allocated Physical Vault • Insured Custody`
  - Asset Row 3 (Bitcoin / Ethereum): `Ethereum (ETH) & Base Assets • Self-Custodied via Device Passkey`
- **Bottom Hero Marquee Strip**:
  - `ZERO SERVER-SIDE KEYS (CI-ENFORCED)`
  - `1:1 ALLOCATED FINE TROY OUNCE BULLION ISSUERS`
  - `3-LINE PRE-SIGNATURE FEE BREAKDOWN`
  - `0.00% HIDDEN EXCHANGE SPREAD`
  - `PASSKEY SMART ACCOUNT + OPTIONAL SEED EXPORT`
  - `ETHEREUM MAINNET & BASE`

---

### 1.2 The Wedge / Problem-Solution Section ([`About.tsx`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/app/home/components/About.tsx))
- **Section Eyebrow**: `THE OWNERSHIP WEDGE`
- **Section H2**:
  **What am I holding, who backs it, and can I take it out?**
- **Lead Paragraph**:
  Until now, buying digital gold meant choosing between two flawed models: surrendering your holdings to a centralized bullion broker's database, or using a general-purpose crypto wallet that treats a troy ounce of vaulted gold like an anonymous ticker symbol. Correnthian was engineered to eliminate that compromise.
- **Three Comparison Cards**:
  1. **Card 1 — What You Hold**:
     - *Title*: **Allocated Bullion & Core Crypto, Measured Precisely**
     - *Body*: View your holdings in fine troy ounces (`oz t`), grams (`g`), token units, and live USD value. Every precious-metal token is classified upfront as `Allocated`, `Unallocated`, or `Synthetic` — so a paper derivative is never disguised as physical bullion.
  2. **Card 2 — Who Backs It**:
     - *Title*: **Named Issuers, Named Vaults, Direct Attestations**
     - *Body*: Correnthian never mints a house token. Instead, our registry surfaces established third-party issuers — such as Paxos Trust (`PAXG`, Brink's London vaults) and Tether Gold (`XAUT`, Swiss vaults) — complete with custodian names and links to their latest independent Proof-of-Reserve attestations. `[REQUIRES ISSUER / PARTNER APPROVAL]`
  3. **Card 3 — How You Take It Out**:
     - *Title*: **24/7 On-Chain Portability or Issuer Redemption**
     - *Body*: Because you hold the cryptographic keys on open networks (`Ethereum` and `Base`), you can transfer your assets to any external wallet at any hour, sell through integrated liquidity partners, or initiate physical bar redemption under the underlying issuer's verified terms and minimums. `[REQUIRES LEGAL / ISSUER / PRODUCT APPROVAL]`

---

### 1.3 Core Capabilities Bento Grid ([`Features.tsx`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/app/home/components/Features.tsx))
- **Section Eyebrow**: `SOVEREIGN ARCHITECTURE`
- **Section H2**:
  **Built for gold buyers who refuse broker custody.**
- **Section Subheadline**:
  Every layer of Correnthian is designed around strict separation of powers: you control the signing keys, regulated issuers vault the physical bars, and every fee is named before you sign.
- **Bento Card 1 (Large Gold Card)**:
  - *Badge*: `PASSKEY SELF-CUSTODY`
  - *Title*: **Hardware Passkey Security on Day One. Seed Export Whenever You Choose.**
  - *Body*: No 12-word paper phrase required to get started. Create an ERC-4337 `SmartAccount` anchored to your device's biometric secure enclave, and add or export a standard BIP-39 `SeedAccount` at your own pace. `[PRE-RELEASE / EARLY ACCESS CAPABILITY]`
- **Bento Card 2 (Silver Card)**:
  - *Badge*: `ZERO-KEY BOUNDARY`
  - *Title*: **We Cannot Freeze, Lend, or Touch Your Assets.**
  - *Body*: Correnthian's servers are verified at every build never to import, generate, or store private keys, seed phrases, or signing shares (`ADR-002`). Your signatures happen exclusively on your device.
- **Bento Card 3 (Obsidian Card)**:
  - *Badge*: `THREE-LINE FEE HONESTY`
  - *Title*: **Every Cost Itemised Before You Sign. Zero Hidden Spread.**
  - *Body*: Most bullion apps and wallets hide a 1.5%–3% markup inside the exchange rate. Correnthian quotes the raw market rate and itemises `Provider Fee`, `Network Gas`, and `Correnthian Fee` on three separate lines before you authorize any trade.
- **Bento Card 4 (Gold-Rim Card)**:
  - *Badge*: `COMPOSITE ASSET REGISTRY`
  - *Title*: **Protection Against Spoofed Tokens & Opaque Wrappers.**
  - *Body*: Every asset is bound to its canonical `chainId:contractAddress:issuerId` identity (`ADR-004`), clearly distinguishing direct primary bullion claims from multi-layer cross-chain wrappers.

---

### 1.4 Interactive Backing & Quote Inspector ([`SmartAssist.tsx`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/app/home/components/SmartAssist.tsx))
- **Section Eyebrow**: `RADICAL VERIFICATION`
- **Section H2**:
  **Don't trust a logo. Inspect the bar list, the vault, and the quote.**
- **Section Subheadline**:
  Every asset card and transaction screen in Correnthian exposes the exact legal and physical metadata behind your holding.
- **Interactive Panel 1 — Live Backing Disclosure Card (`describeBacking()`)**:
  - `Asset`: PAX Gold (`PAXG`) — `1:0x4580...EbAf78:paxos`
  - `Backing Classification`: **ALLOCATED PHYSICAL GOLD** (`1.000 oz t` / `31.1034768g` per token)
  - `Legal Issuer`: Paxos Trust Company, LLC (NYDFS-Regulated)
  - `Physical Custodian & Vault`: Brink's Vaults — London, United Kingdom (LBMA Good Delivery Bars)
  - `Ongoing Issuer Storage Fee`: `0.00% / year`
  - `Verification`: Direct link to Monthly Independent Auditor Attestation & Ethereum Address Bar Serial Lookup
- **Interactive Panel 2 — Pre-Signature Three-Line Quote Preview**:
  - `Execution Quote`: Buy `1.0000 oz t` (`31.103g`) Allocated Gold Token
  - `Line 1 — Provider / Issuer Fee`: Disclosed at cost from liquidity/on-ramp partner
  - `Line 2 — Network Gas (Ethereum / Base)`: Exact EIP-1559 network fee *(or `$0.00 Sponsored` on eligible SmartAccount operations)*
  - `Line 3 — Correnthian Platform Fee`: Explicit itemised fee (`0.00%` hidden spread markup) `[REQUIRES COMMERCIAL FEE SIGN-OFF]`

---

### 1.5 Architectural Verification Metrics ([`Stats.tsx`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/app/home/components/Stats.tsx))
> *Note*: Per our strict integrity rules, we use zero fabricated user counts or fake trading volumes. Every metric is an architectural or verified product specification.
- **Stat 1**: `0` — **Private Keys Held by Correnthian** (`Enforced by automated CI key-boundary checks on every build`)
- **Stat 2**: `31.103g` — **1 Fine Troy Ounce per Standard Gold Token** (`Displayed in grams, troy ounces, and live USD alongside crypto`)
- **Stat 3**: `3 Lines` — **Itemised Pre-Signature Fee Disclosure** (`Provider Fee, Network Gas, and Correnthian Fee — 0% hidden spread`)
- **Stat 4**: `24/7` — **On-Chain Self-Custody Portability** (`Live on Ethereum Mainnet and Base with multi-RPC failover`)

---

### 1.6 How It Works & Buyer Profiles ([`Customer.tsx`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/app/home/components/Customer.tsx))
- **Section Eyebrow**: `HOW CORRENTHIAN WORKS`
- **Section H2**:
  **From passkey creation to vaulted bullion in four transparent steps.**
- **4-Step Process**:
  1. **Step 01 — Create Your Passkey Vault**: Initialize your self-custody wallet in seconds using your device's built-in passkey. No 12-word paper phrase required on day one, with full BIP-39 seed export available whenever you want it.
  2. **Step 02 — Inspect the Asset & Backing**: Choose from curated tokenized precious metals (`PAXG`, `XAUT`) and core digital assets (`ETH`, `USDC`). Review the issuer entity, vault city, custodian, and latest auditor attestation before committing a dollar.
  3. **Step 03 — Review Your 3-Line Quote & Sign**: Fund via existing on-chain assets or regulated payment partners. Review the exact `Provider`, `Network`, and `Correnthian` fee lines and sign locally on your device.
  4. **Step 04 — Hold, Transfer On-Chain, or Redeem**: Monitor your portfolio in grams, troy ounces, and USD. Transfer freely across Ethereum and Base 24/7, or request physical redemption under the token issuer's verified terms. `[REQUIRES LEGAL / ISSUER / PRODUCT APPROVAL]`

---

### 1.7 Closing Call-to-Action ([`Download.tsx`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/app/home/components/Download.tsx))
- **Eyebrow**: `SOVEREIGN WEALTH, WITHOUT COMPROMISE`
- **Headline**:
  **Your gold. Your crypto. Your keys.**
- **Body**:
  Experience the calm of vaulted physical bullion combined with the mathematical certainty of non-custodial cryptography.
- **Primary CTA**: `Request Early Access`
- **Secondary CTA**: `Read Our Security & Backing Standards` -> `/features`

---

## Page 2: Features — Precious Metals, Self-Custody & Networks (`/features`)

### 2.1 Feature Hero (`FeatureHero.tsx`)
- **Eyebrow**: `PLATFORM ARCHITECTURE & ASSET STANDARDS`
- **H1**: **Every layer of ownership, explained in plain sight.**
- **Subheadline**: How Correnthian verifies precious-metal backing, isolates your private keys on your device, and connects you to Ethereum and Base without custodial middlemen.

### 2.2 Precious Metals & Backing Verification Section
- **Headline**: **Not all "digital gold" is created equal. We show you the difference.**
- **Body**:
  In the digital asset market, some tokens represent direct legal title to serial-numbered London Good Delivery bars in Brink's or Swiss vaults, while others are secondary cross-chain wrappers or unbacked synthetic derivatives. Correnthian's Asset Registry (`packages/assets`) enforces strict disclosure across six dimensions on every holding:
  1. **Backing Classification**: Explicitly badged as `Allocated` (segregated physical bars), `Unallocated` (pool claim), or `Synthetic` (price exposure only — never badged as physical bullion).
  2. **Issuer Legal Entity**: Names the exact regulated trust or corporate issuer (e.g., Paxos Trust Company, LLC in New York; TG Commodities Limited).
  3. **Vault Custodian & Jurisdiction**: Identifies the physical vault operator and location (e.g., Brink's London vaults for `PAXG`; Swiss vaults for `XAUT`).
  4. **Fine Metal Ratio**: Displays exact fine weight per token (`1.000 fine troy oz = 31.1034768g`) alongside gram and USD conversions.
  5. **Proof-of-Reserve & Auditor Attestations**: Direct one-click links to the issuer's independent monthly or bi-annual attestation reports and bar-serial lookup tools.
  6. **Honest Redemption Minimums**: Upfront disclosure of the issuer's direct physical bar withdrawal thresholds (such as LBMA ~400–430 oz Good Delivery bar minimums for direct issuer withdrawal vs. secondary liquidity/partner paths) and KYC requirements. `[REQUIRES LEGAL / ISSUER / PRODUCT APPROVAL]`

### 2.3 Wallet & Progressive Self-Custody Section
- **Headline**: **Self-custody engineered for humans — and verified by code.**
- **Body**:
  - **Tier 1 — Passkey Smart Account (`ERC-4337`)**: Your wallet is controlled by a hardware-bound WebAuthn P-256 passkey inside your phone or computer's secure enclave. No paper seed phrase to lose on day one, and eligible first-party operations benefit from automated gas sponsorship (`ADR-022`). `[PRE-RELEASE / EARLY ACCESS CAPABILITY]`
  - **Tier 2 — Sovereign Seed Account (`BIP-39`)**: Whenever your balance grows or you want cold-storage portability, add or export a standard recovery phrase compatible with external hardware wallets.
  - **CI-Enforced Zero-Key Server Boundary (`ADR-002`)**: Our backend assembles unsigned transactions and verifies cryptographic signatures (`recoverTransactionAddress`), but is blocked at the source-code level from ever importing key-generation libraries or receiving private key material.

### 2.4 Supported Networks & Assets Table
- **Live EVM Networks (Implemented in Repository)**:
  - **Ethereum Mainnet (`Chain ID 1`)**: Primary settlement layer for institutional tokenized gold (`PAXG`, `XAUT`), `ETH`, and `USDC`, with 12-block finality verification and dual Alchemy/Infura RPC failover.
  - **Base (`Chain ID 8453`)**: High-speed, low-cost Ethereum Layer 2 for fast transfers and everyday portfolio operations (`10-block` finality verification).
- **Planned Multi-Chain Expansion (`[PRE-RELEASE / ROADMAP]`)**:
  - Native **Bitcoin (`BTC`)** and **Solana (`SOL`)** adapter interfaces defined in [`packages/blockchain`](file:///Users/mayaoflagos/correnthian/packages/blockchain) for upcoming multi-chain unified portfolio support.

---

## Page 3: Fees & Zero-Spread Policy (`/pricing`)

### 3.1 Pricing Hero (`PricingHero.tsx`)
- **Eyebrow**: `TRANSPARENT COST STRUCTURE`
- **H1**: **Clear costs. Considered decisions. Zero hidden spread.**
- **Subheadline**:
  Whether you are buying a troy ounce of allocated gold or transferring USDC on Base, you see every single fee on three separate lines before you sign.

### 3.2 The Three-Line Fee Standard (`ADR-005` / `ADR-021`)
- **Line 1 — Provider / Issuer Fee**: The exact fee charged by the third-party liquidity provider, fiat payment processor, or token issuer — passed through without hidden markup.
- **Line 2 — Network Gas Fee**: The actual blockchain validator fee on Ethereum or Base (estimated via live EIP-1559 fee data), or `$0.00 (Sponsored by Correnthian)` on qualifying first-party SmartAccount actions (`ADR-022`).
- **Line 3 — Correnthian Platform Fee**: A single, explicit platform fee line shown in both percentage and USD before you sign. If a quote is not accompanied by all three lines, the transaction cannot be signed. `[EXACT % SCHEDULE REQUIRES COMMERCIAL SIGN-OFF]`

### 3.3 Schedule of Platform & Third-Party Costs
| Activity | Correnthian Fee | Issuer / Third-Party Fee | Network Gas |
| :--- | :--- | :--- | :--- |
| **Creating & Holding a Self-Custody Wallet** | **$0.00 / year** | **$0.00 / year** annual storage fee on `PAXG` and `XAUT` from their issuers | None |
| **Receiving Assets On-Chain** | **$0.00** | None (note: Paxos applies a 0.02% on-chain transfer fee on `PAXG` contract transfers) | Paid by sender |
| **Sending Assets On-Chain** | **$0.00** | None (except issuer contract transfer fee if applicable) | Standard Ethereum / Base network gas |
| **Buying / Selling Metals & Crypto** | **Explicit itemised fee** (`0.00%` hidden spread) `[REQUIRES COMMERCIAL SIGN-OFF]` | Disclosed upfront on Line 1 of your pre-signature quote | Disclosed upfront on Line 2 |
| **Physical Bullion Redemption** | **Subject to issuer terms** `[REQUIRES LEGAL / ISSUER APPROVAL]` | Governed by the underlying token issuer's redemption fee, bar fabrication cost, and insured courier shipping | Standard burn/transfer gas |

---

## Page 4: About Correnthian (`/about`)

- **Eyebrow**: `ABOUT CORRENTHIAN`
- **H1**: **You own the metal. You hold the keys. We build the verification layer.**
- **Lead Story**:
  Gold is humanity's oldest bearer asset; public-key cryptography is its newest. Yet when physical bullion moved online, most platforms recreated the exact counterparty risks gold owners were trying to escape — locking customer balances inside closed brokerage databases, bundling metals with complex yield schemes, or burying redemption restrictions in footnotes.
  
  Meanwhile, standard crypto wallets left precious-metal buyers in the dark, displaying a $50,000 tokenized gold position with no indication of whether the bars were allocated, who audited the vault, or which legal entity stood behind the token.

  **Correnthian Inc.** (a Delaware corporation) was founded to unite the permanence of allocated precious metals with the mathematical certainty of non-custodial ownership.

---

## Page 5: Frequently Asked Questions (`/faq`)

1. **Does Correnthian issue its own gold or silver token?**
   No. Correnthian never issues, mints, or custodies its own precious-metal token. Doing so would create a conflict of interest. Instead, Correnthian curates established, third-party-issued tokens (such as PAX Gold `PAXG` and Tether Gold `XAUT`) and surfaces their full legal, vault, and attestation metadata so you can verify what backs every token you hold.
2. **Where is the physical gold and silver stored, and how is it audited?**
   Physical bullion is stored in insured vaults operated by the custodians designated by each token's issuer — for example, Brink's vaults in London for `PAXG` (issued by NYDFS-regulated Paxos Trust Company) and Swiss vaults for `XAUT` (issued by TG Commodities Limited). Each holding screen in Correnthian links directly to the issuer's latest independent auditor attestation and bar allocation lookup tool. `[REQUIRES ISSUER / PARTNER APPROVAL]`
3. **What is the difference between Allocated, Unallocated, and Synthetic tokens?**
   - **Allocated**: Your token represents ownership or direct claim to specific, serial-numbered physical bars held in a named vault.
   - **Unallocated**: Your token represents a general claim against a pool of metal rather than segregated serial-numbered bars.
   - **Synthetic**: A derivative token that tracks the spot price of gold or silver without physical bullion redeemable behind it. Correnthian never badges a synthetic token as vaulted bullion.
4. **What happens if Correnthian goes out of business or its servers go offline?**
   Because Correnthian is strictly non-custodial (`ADR-002`), your tokens live on public blockchains (Ethereum and Base) under keys controlled exclusively by your device passkey and/or exported recovery phrase. Even if Correnthian's website were to disappear tomorrow, your on-chain tokens and your legal claim on the underlying token issuer remain 100% intact and accessible through any compatible wallet or directly with the token issuer.
5. **Can I redeem my tokenized gold or silver for physical bars?**
   Physical redemption is fulfilled by the underlying token issuer (or authorized bullion redemption partners) in accordance with the issuer's terms, identity verification (KYC), jurisdictional rules, and minimum bar sizes. For example, direct physical redemption from primary issuers like Paxos (`PAXG`) or Tether Gold (`XAUT`) requires meeting LBMA Good Delivery bar thresholds (~400–430 fine troy ounces), whereas smaller holdings can be sold for fiat/crypto 24/7 or redeemed via authorized retail bullion partner programs where available. Correnthian displays each token's exact redemption terms before you buy. `[REQUIRES LEGAL / ISSUER / PRODUCT APPROVAL]`
6. **When is identity verification (KYC) required?**
   Holding and transferring assets on-chain in your self-custody wallet does not surrender your keys to Correnthian. Statutory identity verification (KYC/AML) and sanctions screening are required when buying or selling through regulated fiat on-ramp/off-ramp partners, executing partner liquidity quotes, or submitting physical redemption requests. Correnthian does not offer services in OFAC comprehensively sanctioned jurisdictions (`CU`, `IR`, `KP`, `SY`, `RU`, `BY`).
