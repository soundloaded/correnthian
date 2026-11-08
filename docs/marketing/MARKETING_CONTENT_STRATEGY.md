# Correnthian — Marketing Content Strategy & Editorial Guardrails (Phase 6A)

> **Purpose**: Define the voice, editorial rules, terminology precision, and compliance guardrails that govern every headline, card, tooltip, and disclosure across the Correnthian marketing website.

---

## 1. Editorial Voice & Tone Principles

### 1.1 The "Sovereign Clarity" Voice
Our target customer is an intelligent, skeptical adult — either a precious-metals buyer who distrusts paper promises and custodial brokers, or a self-custody crypto holder who wants real physical-backed bullion without opaque issuer gimmicks.

We combine three tonal inspirations from our competitive research:
1. **Goldmoney's Calm Authority**: Short, declarative sentences. Zero exclamation marks, zero hype, zero FOMO.
2. **BullionVault's Intellectual Honesty**: Never ask the reader to "trust us." Show them *how* they can verify the vault, the bar list, the key boundary, and the fee calculation themselves.
3. **Paxos's Institutional Precision**: Name exact legal entities, regulatory frameworks, vault operators, and fine troy ounce / gram conversions rather than vague marketing adjectives.

### 1.2 Voice Contrast Table

| Never Sound Like This (Banned) | Always Sound Like This (Correnthian Standard) |
| :--- | :--- |
| *"Supercharge your wealth with next-gen Web3 RWA gold yields!"* | *"Own allocated gold, silver, and crypto in a wallet only you control."* |
| *"Your gold is stored safely in our high-security vaults."* (False — implies Correnthian is the custodian) | *"Your tokens are held under your own keys on-chain; the underlying physical bars are vaulted and audited by the regulated token issuer."* |
| *"Zero fees! Buy gold for free!"* (Deceptive spread model) | *"Every quote itemises three lines before you sign: Provider Fee, Network Gas, and Correnthian Fee — with zero hidden spread."* |
| *"Redeem your tokens for gold bars delivered to your door anytime!"* (Misleading on minimums) | *"Transfer your tokens on-chain 24/7, or request physical redemption under the underlying issuer's verified bar minimums and KYC terms."* |
| *"100% risk-free inflation protection."* | *"Direct exposure to allocated physical gold and silver alongside core digital assets."* |

---

## 2. Precision Terminology Lexicon

Every writer and engineer touching `apps/marketing` must use exact terminology aligned with [`packages/domain`](file:///Users/mayaoflagos/correnthian/packages/domain) and [`packages/assets`](file:///Users/mayaoflagos/correnthian/packages/assets):

1. **Correnthian's Role**:
   - **Use**: *Self-custodial platform*, *non-custodial wallet interface*, *curated asset & backing registry*, *zero-key software layer*.
   - **Never Use**: *Custodian*, *depository*, *bullion dealer*, *token issuer*, *bank*, *exchange*.
2. **Precious-Metal Backing Classifications (`BackingType`)**:
   - **`Allocated`**: Each token represents title or direct claim to specific, serial-numbered physical bullion bars held in an insured vault (e.g., `PAXG`, `XAUT`).
   - **`Unallocated`**: Token represents a general claim on a pool of metal held by the issuer rather than specific segregated bars.
   - **`Synthetic`**: Price-tracking token or derivative with no physical metal redeemable behind it. (Correnthian's UI and marketing never badge a synthetic token as vaulted bullion.)
3. **Weight & Unit Measurements**:
   - Always specify **fine troy ounces (`oz t` = `31.1034768 grams`)** and **grams (`g`)** alongside USD/fiat value. Never use ambiguous "ounces" without clarifying troy ounces when discussing bullion ratios.
4. **Wallet & Key Architecture**:
   - **`SmartAccount` (Passkey Tier)**: ERC-4337 smart contract wallet controlled by a hardware-bound WebAuthn P-256 passkey on the user's device.
   - **`SeedAccount` (BIP-39 Tier)**: Optional standard mnemonic keypair that advanced users can add or export at any time.
   - **Zero-Key Boundary (`ADR-002`)**: The architectural and CI-enforced guarantee that Correnthian's backend servers never generate, receive, store, or log private keys, seed phrases, or signing shares.
5. **Fee Structure (`ADR-005` / `ADR-021`)**:
   - Always refer to the **Three-Line Pre-Signature Fee Breakdown**:
     1. `Provider / Issuer Fee`
     2. `Network Fee (Gas)`
     3. `Correnthian Fee`

---

## 3. Mandatory Compliance & Approval Labels

Per [`VERIFIED_PRODUCT_FACTS.md`](file:///Users/mayaoflagos/correnthian/docs/marketing/VERIFIED_PRODUCT_FACTS.md) and [`docs/compliance/counsel-briefing-memo.md`](file:///Users/mayaoflagos/correnthian/docs/compliance/counsel-briefing-memo.md), any copy touching the following four areas must carry an explicit review flag in draft documentation and appropriate on-page disclosures when published:

1. **`[REQUIRES LEGAL COUNSEL APPROVAL]`**:
   - Entity licensing statements, US FinCEN/state money-transmitter or precious-metals dealer characterizations, Terms of Service, Privacy Policy, and Risk Disclosures.
2. **`[REQUIRES ISSUER / PARTNER APPROVAL]`**:
   - Statements describing live direct liquidity routing, primary mint/burn partnerships, or use of third-party issuer trademarks/logos (`PAXG` / Paxos, `XAUT` / Tether Gold, Persona, fiat on-ramp providers).
3. **`[REQUIRES COMMERCIAL FEE SIGN-OFF]`**:
   - Specific numeric percentages for the `Correnthian Fee` line (the *structure* of the 3-line breakdown and 0% hidden spread is locked in `ADR-005`/`ADR-021`, while final basis-point pricing is a commercial launch setting).
4. **`[PRE-RELEASE / EARLY ACCESS CAPABILITY]`**:
   - End-user mobile/web `SmartAccount` passkey deployment, gas sponsorship (`ADR-022`), live fiat on-ramp checkout, and Bitcoin/Solana chain adapters.

---

## 4. Proof Standards for Every Marketing Section

No section on the Correnthian website may rely on empty adjectives ("secure", "transparent", "fast"). Every claim must be paired with a **verifiable mechanism**:

- **If we claim "Self-Custody"** -> Show how the device passkey signs locally while `scripts/check-key-boundary.mjs` blocks any key material from ever entering Correnthian's server code.
- **If we claim "Verified Bullion Backing"** -> Show the exact 6 fields of `BackingDisclosure` (`Backing Type`, `Issuer`, `Custodian`, `Vault Location`, `Fine Weight per Token`, `Latest Attestation Link`).
- **If we claim "Transparent Pricing"** -> Show the 3-line pre-signature quote card (`Provider`, `Network`, `Correnthian`) and explicitly state `0.00% Hidden Spread`.
- **If we claim "Physical Redemption Path"** -> State honestly that physical bar withdrawal is fulfilled by the underlying token issuer subject to their published bar minimums (e.g., LBMA Good Delivery bar thresholds for direct `PAXG`/`XAUT` redemption) and KYC verification.
