# Correnthian — Competitive Research & Reference Website Analysis (Phase 2)

> **Purpose**: Deep, structured teardown of the 8 reference websites across Group A (Precious Metals & Digital Wealth), Group B (Wallets & Crypto Infrastructure), and Group C (Visual & Motion Design References).
>
> **Research Date**: 2026-10-31
> **Methodology**: Live HTTP DOM/navigation inspection (`task-536`) combined with targeted page-level investigation of homepage hierarchy, inner product pages, trust/audit pages, fee schedules, redemption disclosures, and onboarding conversion flows.

---

## Executive Overview of Reference Groups

| Group | Company / Site | Primary Role in Our Research | Core Takeaway for Correnthian |
| :--- | :--- | :--- | :--- |
| **Group A** | **Kinesis Money** (`kinesis.money`) | Primary ecosystem comparison (gold, silver, crypto, trading, payments, vaulting) | High feature ambition, but severe cognitive overload (6 yields, KVT, Currency One, cards, minting, 2-layer KMS Labs structure) and custodial reliance. |
| **Group A** | **OneGold** (`onegold.com`) | Best precious-metals retail buying/vaulting UX | Clean retail onboarding (APMEX + Sprott pedigree), clear jurisdictional vault choice (US, Canada, UK, Switzerland), transparent storage rates, and retail redemption via APMEX. |
| **Group A** | **BullionVault** (`bullionvault.com`) | Best physical bullion ownership & audit verification reference | Industry gold standard for radical proof of ownership (Daily Audit matching user nicknames to physical bar lists + live orderbook calculator above the fold). |
| **Group A** | **Paxos / PAX Gold** (`paxos.com/pax-gold`) | Best tokenized-gold issuer & institutional trust reference | Crystal-clear regulatory framing (NYDFS trust, bankruptcy-remote segregation, monthly attestations) + interactive Ethereum address -> physical bar serial lookup tool. |
| **Group A+** | **Goldmoney** (`goldmoney.com`) | Best restrained, sovereign-grade wealth & ownership copy | Masterclass in calm, high-net-worth editorial tone (*"You own the metal. We look after it."*, *"Clear costs. Considered decisions."*). |
| **Group B** | **Trust Wallet** (`trustwallet.com`) | Best self-custody wallet UX & security framing | Strong "True ownership / Zero personal tracking" messaging, ISO certifications, and approachable multi-chain UX — though geared toward retail DeFi rather than bullion buyers. |
| **Group B** | **KMS Labs** (`kmslabs.money`) | Crucial blockchain token-wrapper & legal disclosure reference | Exposes the critical distinction between an ERC-20 token wrapper (KMS Labs S.A., Panama) and the underlying bullion issuer (Kinesis Cayman / ABX vaults). |
| **Group C** | **Crypt Template & MetaMask** (`crypt.tophivetheme.com`, `metamask.io`) | Visual foundation & GSAP + Framer Motion choreography benchmark | Dark obsidian crypto dashboard hierarchy paired with tactile 3D/scroll-pinned card storytelling — which we adapt onto `habitline-next` using our Obsidian/Gold/Silver palette. |

---

## 1. Kinesis Money (`https://kinesis.money`)

### 1.1 Company & Category Overview
- **Category**: All-in-one monetary system combining vaulted digital gold (`KAU`, 1 gram) and silver (`KAG`, 1 oz) with a crypto exchange, virtual card, merchant payments, and fee-sharing yield system.
- **Corporate Structure**: Issued by Kinesis Cayman (Cayman Islands), vaulting via Allocated Bullion Exchange (ABX) network, and ERC-20 bridged tokens issued separately by KMS Labs S.A. (Panama).

### 1.2 Target Audience
- Retail gold/silver bugs seeking yield on bullion, crypto users wanting metal-backed spending cards, and businesses looking for gold-denominated payments/payroll.

### 1.3 Primary Value Proposition & Homepage Analysis
- **Live Homepage H1 / Promo Hook**: *"Pre-register for up to 12% APY*"* alongside *"Choose better money today. Protect your money. Own, spend and earn gold, anywhere in the world."*
- **Section Order**:
  1. Promotional yield/earn hero banner + primary CTA (*"Open Account"* / *"Learn how it works"*).
  2. Ecosystem switcher (Personal Finance vs. Business Solutions vs. Kinesis Exchange).
  3. Asset overview (`KAU` 1g gold, `KAG` 1oz silver, `KVT` velocity token, `C1USD` stablecoins).
  4. Six-yields breakdown (*"Our users have earned $20M+ of gold and silver"*).
  5. Virtual Card & Metalback rewards.
  6. Trust, security, and independent audits section.
  7. FAQ and multi-language footer.

### 1.4 Navigation & Sitemap Structure
- **Mega-menu with 7 top-level pillars**:
  - `Personal` / `Business`
  - `Products` (Buy gold & crypto with card, Kinesis platform, Mobile App, Virtual Card, Kinesis Pay, KAU, KAG, KVT, Currency One, Minting, Exchange)
  - `Rewards` (Yields overview, Hold and earn, Spend or trade and earn, Refer and earn, Mint and earn, KVT yield, Partner yield, Earn APY program, Metalback)
  - `About` (About Kinesis, The Team, Fees, Contact, KMS Labs, Kinesis Mint, Merchant Directory, Deposit Bullion, Case Studies, Trust & Security, Audits, Attestations)
  - `Store` (Kinesis Bullion store: bars, rounds, Gold Bills, Hardware device)
  - `Media` (Media Centre, Live from the Vault, Kinesis Explained videos, Gold/Silver News, Price Charts)
  - `Support` (Support Centre, User Guides, Getting Started, CoinTracking reporting)

### 1.5 How Precious Metals, Custody & Blockchain Are Explained
- **Units**: `1 KAU = 1 gram` of fine gold; `1 KAG = 1 troy ounce` of fine silver.
- **Custody & Title**: Kinesis states legal title to underlying bullion is allocated to the holder, stored across 13 vaults in 10+ cities (Brisbane, Dubai, Frankfurt, Hong Kong, Istanbul, Liechtenstein, London, New York, Panama, Singapore, Sydney, Toronto, Zurich) via ABX partners (Brink's, Loomis, Malca-Amit) with **zero storage fees**.
- **Audits**: Bi-annual independent physical audits by **Inspectorate International ( a Bureau Veritas company)** plus monthly attestation reports (`kinesis.money/audits/`).
- **Blockchain**: KAU and KAG run natively on a custom Stellar-forked Kinesis Blockchain Network; Ethereum ERC-20 compatibility requires bridging through a separate entity (**KMS Labs**).

### 1.6 How Pricing, Fees & Redemption Are Communicated
- **Fee Page (`kinesis.money/about-us/fees/`)**:
  - Storage fee: **0%**.
  - Exchange execution fee: **0.22%** (Buy/Sell trade execution).
  - Transfer fee (wallet-to-wallet): **0.45%**.
  - Physical redemption (`kinesis.money/redemption/`): Minimum **100g of gold (100 KAU)** or **200 oz of silver (200 KAG)**; **0.45% + $100 USD** withdrawal fee plus insured courier shipping costs.

### 1.7 Strengths, Weaknesses & Lessons for Correnthian
- **What Works Well**:
  - Dedicated `/audits/`, `/trust-security/`, and `/fees/` pages with downloadable Bureau Veritas PDFs.
  - Clear explanation of why `0% storage fee` is attractive vs. traditional ETFs.
- **What Creates Confusion or Distrust**:
  - **Severe product sprawl**: Visitors are hit simultaneously with 6 different yield types, KVT tokens, Currency One stablecoins, Gold Bills, a bullion e-commerce shop, and an "up to 12% APY" earn promo.
  - **Custodial & structural opacity**: Most users do not realize that holding KAU inside the Kinesis platform is a platform account on a custom Stellar fork, and that holding ERC-20 KAU on Ethereum actually makes them a creditor/claimant of KMS Labs S.A. (Panama), which in turn holds Kinesis Cayman tokens.
- **Lesson for Correnthian**:
  - **Never copy Kinesis's yield/APY/reward sprawl or custom-token issuance.** Position Correnthian as the clean, self-custodial antithesis: **you hold industry-standard tokens directly in your own wallet, with every layer of issuer, vault, and fee disclosed up front.**

---

## 2. OneGold (`https://www.onegold.com`)

> *Note on Inspection*: Direct automated script access to `onegold.com` returned a Cloudflare challenge (`HTTP 403 Just a moment...` in `task-536`). Findings below are verified from indexed OneGold public pages (`onegold.com/how-it-works`, `onegold.com/storage`, `onegold.com/redeem`, and Help Center documentation).

### 2.1 Company & Category Overview
- **Category**: Digital precious-metals investment platform allowing retail and IRA investors to buy, sell, vault, and redeem vaulted physical gold, silver, and platinum.
- **Institutional Pedigree**: Created as a joint venture between **APMEX** (one of the largest online bullion dealers in the US) and **Sprott** (institutional precious-metals asset manager).

### 2.2 Target Audience
- North American and international precious-metals investors who want lower premiums than retail coins, insured vault storage in selectable countries, and easy physical redemption into coins/bars via APMEX.

### 2.3 Primary Value Proposition & Messaging
- **Core Hook**: Institutional pricing on vaulted physical gold, silver, and platinum with 24/7 trading, AutoInvest dollar-cost averaging, and 1-click physical redemption through APMEX.
- **Trust Anchors**: Immediately leads with the **APMEX + Sprott** partnership, **Lloyd's of London** 100% theft/loss insurance, and top-tier vault operators (**Brink's, Loomis International, Royal Canadian Mint, CNT Depository**).

### 2.4 How Precious Metals, Vaulting, Fees & Redemption Are Explained
- **Jurisdictional Vault Selection**: Unlike opaque "global pool" platforms, OneGold lets the customer explicitly choose the country/vault when buying: **United States, Canada (Royal Canadian Mint), United Kingdom, or Switzerland**.
- **Pricing & Storage Fees**:
  - Transparent annual storage fees: **0.12% per year for Gold** and **0.30% per year for Silver** (minimum $5/quarter), billed quarterly.
  - Tight bid/ask spread compared to physical coin retail premiums.
- **Redemption Journey**:
  - Customers can convert their vaulted metal balance directly into a credit toward any physical gold, silver, or platinum coin, round, or bar in the **APMEX** catalog and have it shipped to their door within 1–2 business days.

### 2.5 Strengths, Weaknesses & Lessons for Correnthian
- **What Works Well**:
  - **Explicit vault jurisdiction clarity**: Showing *where* the metal sits (Switzerland vs. London vs. US vs. Canada) and *who* guards it (Brink's, Loomis, RCM) builds instant credibility with gold buyers.
  - **Simple 4-step "How It Works"**: Fund -> Buy -> Store -> Sell or Redeem.
- **What Creates Confusion or Distrust**:
  - **Purely centralized platform custody**: Users have a database account at OneGold; they cannot hold their assets in a self-custody wallet, move them on-chain 24/7 without platform permission, or hold BTC/ETH/USDC alongside their metals.
- **Lesson for Correnthian**:
  - Adopt OneGold's **clear vault-jurisdiction and custodian badges** on every asset card, while highlighting Correnthian's advantage: **true on-chain self-custody alongside your crypto portfolio.**

---

## 3. BullionVault (`https://www.bullionvault.com`)

### 3.1 Company & Category Overview
- **Category**: The world's largest online investment gold service, caring for **$8.2+ billion** in physical gold, silver, platinum, and palladium for **125,000+ users** across 175 countries (founded 2005; minority backing from Augmentum Fintech and GBI).

### 3.2 Target Audience
- Serious wealth preservationists, HNW individuals, and cost-conscious bullion buyers who prioritize wholesale LBMA bar pricing, legal bailment ownership, and verifiable daily audits over flashy UI.

### 3.3 Primary Value Proposition & Homepage Analysis
- **Live Homepage H1 (`task-536`)**: *"Buy gold, silver and platinum bullion online at the lowest possible price."*
- **Live Homepage H2s**:
  - *"Buy gold, silver, platinum and palladium at these live prices"*
  - *"World's largest online investment gold service"*
  - *"Why choose BullionVault for buying gold?"*
  - *"Cut the cost of buying gold and silver"*
  - *"Buying gold and silver: rates and costs"*
- **Above-the-Fold Interactive Proof**: Places a live orderbook price table and cost calculator directly on the homepage so visitors can test real spreads and vault locations (Zurich, London, New York, Toronto, Singapore) before signing up.

### 3.4 How Ownership, Custody & the Daily Audit Are Explained
- **Legal Bailment**: Explains clearly that client bullion is held under English law of bailment — it is the personal property of the client, never sits on BullionVault's balance sheet, and cannot be claimed by creditors in insolvency.
- **The Signature Trust Mechanism — The Daily Audit**:
  - Every business day, BullionVault publishes a **public Daily Audit** on its website.
  - Every customer has a unique public **audit nickname** known only to them.
  - Anyone can download the official bar lists from Brink's/Loomis/Malca-Amit alongside the full list of client nicknames and cash balances, proving down to the gram that total client holdings match physical vaulted bars 100%.

### 3.5 How Pricing, Fees & Physical Withdrawal Are Communicated
- **Commission**: Tiered from **0.5% down to 0.05%** based on volume.
- **Storage & Insurance Included**: **0.12% per year for Gold** ($4/month minimum) and **0.48% per year for Silver** ($8/month minimum), which explicitly includes insurance.
- **Physical Withdrawal**: Honest and unvarnished — BullionVault tells users upfront that its core advantage is keeping metal inside accredited Good Delivery vaults to preserve resale value, and that physical withdrawal into small 100g bars incurs a 3%–5% fabrication/shipping fee (or 400 oz Good Delivery bar withdrawal for institutional holders).

### 3.6 Strengths, Weaknesses & Lessons for Correnthian
- **What Works Well**:
  - **Radical, verifiable honesty**: BullionVault doesn't ask users to "trust our brand." It gives them a mechanism (the Daily Audit + upfront withdrawal cost disclosure) to *verify* everything.
  - **Cost calculator clarity**: No hidden spreads; commission and storage are itemized clearly.
- **What Creates Confusion or Distrust**:
  - **Dated 2000s web aesthetic**: Dense tables and legacy `.do` URLs feel intimidating to modern mobile-first users.
  - **No crypto or self-custody wallet**: Purely Web2 bullion brokerage.
- **Lesson for Correnthian**:
  - **Steal BullionVault's intellectual honesty and translate it into modern luxury design.** Correnthian's `BackingDisclosure` card (`allocated` vs `unallocated` vs `synthetic`, custodian, vault, PoR link, and honest redemption minimums) is the Web3 equivalent of BullionVault's Daily Audit.

---

## 4. Paxos / PAX Gold (`https://www.paxos.com/pax-gold`)

### 4.1 Company & Category Overview
- **Category**: Regulated blockchain infrastructure and tokenized asset issuer. **PAX Gold (`PAXG`)** is the leading NYDFS-regulated ERC-20 gold token on Ethereum.

### 4.2 Target Audience
- Institutional desks, crypto-native investors, and gold buyers who want a regulated, bankruptcy-remote, 1:1 physical-gold-backed ERC-20 token.

### 4.3 Primary Value Proposition & Homepage Analysis
- **Live Page H1s (`task-536`)**:
  - *"The safest way to own investment-grade gold"*
  - *"A digital token, backed by physical gold"*
  - *"Gold Allocation Look up"*
  - *"Why Pax Gold?"*
- **Primary CTAs**: *"Buy PAXG"* (`paxg.com/#buy`), *"Verify your PAXG"* (`paxg.com/#verify`), *"Talk to the Team"*, *"Pax Gold Onesheet"* (`paxg-1pager-2026.pdf`), and *"Pax Gold White Paper"*.

### 4.4 How Regulation, Custody & Allocation Lookup Are Explained
- **Regulatory Pedigree**: Issued by **Paxos Trust Company**, a limited purpose trust company regulated by the **New York State Department of Financial Services (NYDFS)**.
- **Bankruptcy Remoteness**: Explicitly explains that all customer assets and physical gold reserves are held in segregated accounts off Paxos's corporate balance sheet.
- **1:1 Fine Troy Ounce Backing**: Each `1 PAXG` represents `1 fine troy ounce` of a 400 oz London Good Delivery gold bar stored in **Brink's vaults in London**.
- **Interactive "Gold Allocation Look Up" Tool**:
  - Any PAXG holder can paste their **Ethereum wallet address** into the lookup tool on Paxos's site and immediately see the **physical bar serial number, branding/refiner, weight, and fine content** of the London Good Delivery gold allocated to their tokens.
- **Monthly Attestations**: Conducted by an independent top-ranking accounting firm under AICPA standards (`paxos.com/regulation-and-transparency/`).

### 4.5 How Fees & Redemption Are Communicated
- **Custody / Storage Fee**: **0.00% annual storage fee** charged by Paxos.
- **Creation / Redemption / On-Chain Fee**: Tiered creation/redemption fees (0.125% to 1.0% depending on volume) and a 0.02% Paxos on-chain transfer fee (plus Ethereum gas).
- **Redemption Paths**:
  - Direct redemption through Paxos for full LBMA-accredited Good Delivery bars (~400–430 oz) or USD proceeds.
  - Smaller unit redemptions routed via Paxos's partner network of physical gold retailers (e.g., Alpha Bullion).

### 4.6 Strengths, Weaknesses & Lessons for Correnthian
- **What Works Well**:
  - **Best-in-class institutional trust communication**: Combines regulatory clarity (NYDFS), physical specificity (Brink's London, LBMA 400 oz bars), and on-chain verifiability (Ethereum address -> bar serial lookup).
- **What Creates Confusion or Distrust**:
  - Paxos is an **issuer and institutional platform**, not a consumer-friendly multi-asset self-custody wallet. Retail users who want to buy $500 of PAXG and hold it safely alongside ETH or USDC without managing MetaMask seed phrases are left on their own.
- **Lesson for Correnthian**:
  - **Paxos is an ideal asset issuer inside Correnthian's registry, not an enemy.** Correnthian bridges the gap between institutional issuers like Paxos/Tether Gold and the everyday buyer by putting `PAXG` and `XAUT` into a passkey-secured self-custody wallet with built-in backing verification.

---

## 5. Trust Wallet (`https://trustwallet.com`)

### 5.1 Company & Category Overview
- **Category**: Mainstream consumer self-custody multi-chain crypto wallet (mobile app + browser extension), claiming 200M+ downloads and 100+ blockchains.

### 5.2 Target Audience
- Retail crypto users looking for a single mobile or browser wallet to hold, swap, stake, and buy tokens via third-party fiat on-ramps.

### 5.3 Primary Value Proposition & Homepage Analysis
- **Core Headline**: *"True crypto ownership. Powerful Web3 experiences."*
- **Trust & Security Section**:
  - *"Zero personal tracking"* (no IP or balance tracking).
  - *"True ownership of your crypto assets — We secure your wallet, but don't control or have access to your private keys or secret phrase — only you do."*
  - Highlights **ISO/IEC 27001:2022** and **ISO/IEC 27701:2019** certifications, independent security audits (CertiK, Cure53, Halborn), and a proactive risky-address Security Scanner.
- **On-Ramp Explanation**: Shows how users buy crypto with cards/bank transfers via integrated third-party providers (MoonPay, Ramp, Transak, Mercuryo, Simplex, Banxa) with provider comparison.

### 5.4 Strengths, Weaknesses & Lessons for Correnthian
- **What Works Well**:
  - **Crisp, jargon-free explanation of self-custody**: Clearly distinguishes securing the software vs. never having access to private keys.
  - **Clear explanation of third-party on-ramp integration**: Users understand they are comparing regulated payment providers inside the wallet.
- **What Creates Confusion or Distrust (Especially for Gold Buyers)**:
  - **Zero Real-World Asset (RWA) or bullion literacy**: In Trust Wallet, `PAXG` or `XAUT` looks identical to any random meme coin — just an ERC-20 ticker and a price chart. There is **no disclosure** of whether a token is allocated, unallocated, or synthetic, who the custodian is, what vault holds the bars, or how redemption works.
  - **Seed-phrase anxiety**: Traditional seed-phrase onboarding terrifies non-crypto precious-metals buyers.
  - **Cartoon 3D mascot aesthetic**: Feels juvenile to a 45-year-old wealth preservationist moving $50,000 into gold.
- **Lesson for Correnthian**:
  - **Correnthian wins where Trust Wallet is blind**: We combine Trust Wallet's non-custodial key sovereignty with **first-class precious-metal intelligence** (`BackingDisclosure`, fine troy oz / gram weight displays, issuer attestation links) and **progressive passkey onboarding** (`SmartAccount` first, optional seed export second).

---

## 6. KMS Labs (`https://kmslabs.money`)

### 6.1 Company & Category Overview
- **Category**: The dedicated blockchain token-issuance subsidiary/partner that issues ERC-20 representations of Kinesis Gold (`KAU`) and Kinesis Silver (`KAG`) on the Ethereum network.

### 6.2 Primary Value Proposition & Live Page Analysis (`task-536`)
- **Live Homepage H1**: *"Connecting gold into the digital economy"*
- **Live Homepage Subheadline & Critical Footnote**:
  > *"KMS Labs issues ERC-20 gold (KAU) and silver (KAG) tokens on the Ethereum network, each backed 1:1 by reserves of Kinesis KAU and KAG, enabling cross-chain integration\*. \*Each ERC-20 token represents a 1:1 claim on Kinesis KAU or KAG held in reserve by KMS Labs S.A. (a company incorporated in Panama). Kinesis KAU and KAG are issued by Kinesis Cayman and are in turn backed 1:1 by fully allocated physical bullion stored in insured third-party vaults by ABX's vault partners. Redemption of ERC-20 tokens for Kinesis KAU/KAG is subject to KMS Labs' terms and conditions and compliance onboarding, following which physical redemption may be made via Kinesis Cayman on terms and conditions."*
- **Section Order**:
  1. Hero (`Connecting gold into the digital economy` + Whitepaper CTA).
  2. `Built on the Gold Standard. Issued on Ethereum and backed by Kinesis tokens.`
  3. `Best-in-class custody` / `Independent audits`.
  4. `On-chain integrity. Real-world infrastructure.` / `The chain of integrity`.
  5. `FAQ` and `Documents` (`/white-paper/`, `/documents/`).

### 6.3 Strengths, Weaknesses & Lessons for Correnthian
- **What Works Well**:
  - **Clean, architectural visual flow**: "The chain of integrity" visually maps how an Ethereum ERC-20 token links to reserve custody and audits.
  - **Legally precise footnote**: Clearly distinguishes the **Panama ERC-20 wrapper issuer (KMS Labs S.A.)**, the **Cayman underlying token issuer (Kinesis Cayman)**, and the **vaulting partner (ABX)**.
- **What It Reveals for Correnthian's Strategy**:
  - Not all "gold tokens" have the same legal structure! Some tokens (like `PAXG` or `XAUT`) are issued directly on Ethereum by the bullion-holding entity, whereas others (like ERC-20 `KAU`) are **two-layer wrapped claims** (an ERC-20 claim on a Panama entity holding a Cayman token backed by ABX vaults).
  - **This is why Correnthian's wedge ("What am I holding, who backs it, and can I take it out") is so powerful**: Correnthian's Asset Registry (`packages/assets`) makes the legal chain of backing visible in plain English so the user never confuses a direct allocated claim with a multi-layer wrapper or synthetic derivative.

---

## 7. Goldmoney (`https://www.goldmoney.com`)

### 7.1 Company & Category Overview
- **Category**: Publicly traded precious-metals custodian and wealth platform (TSX: XAU), safeguarding **$2+ billion** in client assets.

### 7.2 Live Homepage Analysis (`task-536`)
- **Live Title**: *"Own Physical Gold & Precious Metals"*
- **Live H1**: *"Buy, hold and sell physical gold and other precious metals, securely stored and accessible through your online account."*
- **Live H2s (5-section architectural restraint)**:
  1. *"You own the metal. We look after it."*
  2. *"An account for what you own."*
  3. *"Clear costs. Considered decisions."*
  4. *"A wider perspective."*
  5. *"Make your next move an informed one."*
- **Navigation**: Ultra-minimalist top bar: `Why Goldmoney` (`/why-goldmoney`), `Why Precious Metals` (`/why-precious-metals`), `Research` (`/research`), `Investors` (`/investors`), `Sign in`, `Open an account`.

### 7.3 Strengths, Weaknesses & Lessons for Correnthian
- **What Works Well**:
  - **Unmatched tonal authority**: Notice how Goldmoney writes: short, declarative sentences with zero exclamation marks, zero hype, and zero crypto slang (*"You own the metal. We look after it."* / *"Clear costs. Considered decisions."*).
  - **Restrained navigation**: Only 4 primary navigation links before the sign-in actions.
- **What Creates Confusion or Distrust**:
  - **High custodial fees & custodial dependency**: Goldmoney charges higher buy/sell fees (0.5%–0.75%+) and remains a centralized custodial account with no self-custody wallet or on-chain portability.
- **Lesson for Correnthian**:
  - **Adopt Goldmoney's calm, declarative copywriting style.** Our target customer (the gold-owning buyer who distrusts both traditional brokers and neon DeFi casinos) responds immediately to measured, sovereign language: *"You hold the keys. The issuer vaults the metal. Every fee is named before you sign."*

---

## 8. Group C — Visual & Motion Design References (`crypt.tophivetheme.com`, `metamask.io`, and `user_web_dashboard_reference.jpeg`)

### 8.1 Crypt HTML Template (`https://crypt.tophivetheme.com`)
- **Inspection Note**: Live HTTP connection to `crypt.tophivetheme.com` timed out (`FAILED: The operation was aborted due to timeout` in `task-536`). Per our research rules, we record this limitation transparently and evaluate its documented structure from public Muzli/ThemeForest specifications.
- **Design Pattern**: Dark-mode crypto exchange/wallet landing page template featuring high-contrast hero dashboard mockups, live asset ticker strips, glassmorphic feature cards, and step-by-step onboarding timelines.
- **What to Adapt vs. Reject**:
  - *Adapt*: Dark obsidian background depth and structured asset table/card hierarchy.
  - *Reject*: Generic Bootstrap template grids, neon purple/cyan crypto gradients, and stock "ICO/token sale" widgets.

### 8.2 MetaMask Rebuilt Marketing Home (`https://metamask.io`) & Luxury Benchmark
- **Inspection Summary**: As analyzed in our motion audit, modern category leaders combine **GSAP (`gsap` + `ScrollTrigger`)** for scroll-linked structural choreography (pinned feature narratives, 3D perspective card tilts, scrubbed progress timelines) with **Framer Motion (`motion/react`)** for spring-physics micro-interactions, tab transitions, and staggered viewport reveals.

### 8.3 Owner's Product UI Reference (`user_web_dashboard_reference.jpeg`) + `habitline-next` Foundation
- **Visual Ground Truth**: The project owner provided [`user_web_dashboard_reference.jpeg`](file:///Users/mayaoflagos/correnthian/user_web_dashboard_reference.jpeg), which depicts a luxury dark-obsidian mobile vault interface alongside physical gold and silver bullion bars and an engraved titanium seed plate:
  - **Deep Obsidian Canvas**: `#08090B` to `#14171A` with warm dark-bronze glassmorphic card surfaces.
  - **Gold Asset Cards**: Warm burnished gold borders (`#C9A227` / `#E3C766`), 3D gold bar iconography, displaying fine weight (`31.103g`), USD value, and explicit backing status (*"Held in Physical Vault"*).
  - **Silver Asset Cards**: Cool brushed-silver metallic borders and surfaces (`#C7CBD1` / `#E8EAED` / `#4A5058`), 3D silver bar iconography, displaying weight (`750g`) and vault status.
  - **Crypto Asset Cards (BTC & ETH)**: Integrated seamlessly in the same portfolio view with warm metallic gold accents, unified under 5 clean bottom tabs (`Dashboard`, `Assets`, `Trade`, `Vault`, `Settings`).
- **How This Connects to `apps/marketing`**:
  - We preserve [`habitline-next`](file:///Users/mayaoflagos/correnthian/habitline-next)'s exact component architecture, bento card layouts, floating pill navigation, marquee strips, and GSAP + Framer Motion choreography (`MotionEnhancer.tsx`), and exchange Habitline's default light/pastel palette for the **Obsidian + Burnished Bullion Gold + Brushed Silver** palette from [`user_web_dashboard_reference.jpeg`](file:///Users/mayaoflagos/correnthian/user_web_dashboard_reference.jpeg) and [`packages/design-tokens`](file:///Users/mayaoflagos/correnthian/packages/design-tokens/src/index.ts).
