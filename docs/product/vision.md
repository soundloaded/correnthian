# Product vision

**Date:** 2026-10-05
**Status:** Living. The decisions described here are locked in the
[design spec](../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md)
§1–§5. This document explains what those decisions mean in practice and — more
usefully — where they stop being true.

Related: [beachhead.md](beachhead.md) (customer profile) ·
[architecture/asset-registry.md](../architecture/asset-registry.md) (why the
provenance payload is the product) ·
[compliance/overview.md](../compliance/overview.md) (the regulatory consequences
of what is described here)

---

## What Correnthian is

A self-custodial platform for holding and buying **tokenized precious metals**.
Users hold gold and silver, buy with a card or a bank account, and the metal is
delivered to an account only they can move.

Three negations define the company as much as the product does:

- It does **not** issue the tokens.
- It does **not** hold user assets.
- It does **not** take principal risk.

Everything downstream — the business model, the regulatory posture, the
architecture — follows from those three. They are the reason the key boundary
is non-negotiable rather than aspirational: if Correnthian never holds a key, a
full compromise of Correnthian's infrastructure is an embarrassing outage
rather than a loss of funds.

---

## The wedge

> **The product is trust and execution, not token support.**
> Any wallet can list a gold token in an afternoon. What cannot be added to a
> token list is a verifiable answer to *what am I holding, who backs it, and
> can I take it out*.

Tokenized gold already exists and already trades. What does not exist is a way
for a non-crypto buyer to hold it without trusting a broker, alongside any
place that is willing to say, in plain language, what a given token actually
is.

That is a three-part claim, and each part has a hard dependency:

| Claim | What must be true | Where it lives |
|---|---|---|
| "what am I holding" | Identity is `(chain, contract, issuer)`, and the unit is grams/troy ounces, not tokens | [packages/types/src/asset.ts](../../packages/types/src/asset.ts) |
| "who backs it" | Custody model, custodian, vault location, attestation date are recorded and surfaced — not inferred from the ticker | [architecture/asset-registry.md](../architecture/asset-registry.md) |
| "can I take it out" | A redemption path exists, and its terms are disclosed before the user buys | [architecture/rails.md](../architecture/rails.md), partner terms (**not yet secured**) |

The third is the weakest link today. It depends on an issuer/LP partnership
that has not started. See *Open questions*.

**Who this is for:** the gold-owning non-crypto buyer. Someone who already
understands gold as a savings instrument and refuses to hand custody of it to a
broker. That refusal is the wedge; it is also the reason the product is hard —
see *Honest limits*.

---

## "Wallet with gold" is a feature, not a company

The phrase is a description of the interface, not of the business. Taken
literally it is a commodity: a token list, a balance view, and a buy button.

Three reasons it cannot be the company:

1. **A token list has no defensibility.** Listing a widely-known metal token
   is an afternoon's work. A competitor can replicate the *list* in days. It
   cannot replicate eighteen months of verification and attestation tracking in
   days — but that is the only moat here, and it must be built deliberately or
   it will not exist.
2. **The customer is not shopping for the token.** The beachhead buyer is
   shopping for a way to keep owning gold without a broker. Gold is the
   product's context, not its differentiator.
3. **The honest framing is already written.** The spec is explicit: "wallet" is
   the wrong word. The framing is *a gold savings app that happens to be
   self-custodial*, with custody as a **trust signal** rather than a user task.
   A seed-phrase-phobic buyer shown a seed phrase does not get more confident
   in us — they get scared, and then they ask where to write it down, and we
   have started competing on the one axis we cannot win.

The self-custodial property is therefore load-bearing **as marketing**, not as
a technical preference. It is also the cheapest available differentiator,
because it is architectural: once the
[key boundary](../architecture/key-boundary.md) holds, custody is a property
that cannot be quietly removed later without breaking every user's
expectation. That is the actual asset — an integrity constraint competitors
cannot retrofit without doing the same engineering.

---

## Where the business value comes from

**Correnthian earns an explicit, itemised, pre-signature fee and never earns by
mispricing an asset** (spec §4.4). Provider fee, network fee and Correnthian fee
are three separate lines, shown before the user signs.

This is simultaneously an ethics decision and a commercial one. A hidden spread
in the gold price is the single fastest way to poison a trust-based product —
and the user has a reference price for gold from any bank or news site, so the
spread is not even hidden for long.

### The revenue lines that exist in the design

| Line | Notes | Status |
|---|---|---|
| Fiat on-ramp fee | Provider-handled; Correnthian's share is negotiated | Shape known, terms **not** |
| Swap fee (Correnthian line) | Explicit line item on the quote | Shape known, rate **not** |
| Fiat off-ramp fee | v1.5, needs its own compliance analysis | Deferred |
| Redemption fee | Depends entirely on partner terms | **Unknown — blocking** |
| Network fee | Pass-through at cost | Not a margin line |
| Provider fee | Pass-through, itemised | Not a margin line |
| **Spread** | — | **Zero, by decision** |

The original conversation also floated a referral programme
([archive transcript §29](../archive/chat-transcript.txt)). It has never been
designed, costed, or put in front of counsel. Treat it as unstarted.

### The shape of the business

High trust, low margin, near-zero capital. There is no float to earn on, no
balance-based revenue, no lending book, no market-making.

That has one consequence worth stating plainly, because it is usually hidden in
a pitch deck: **revenue scales with transaction count, not with balances held.**
Correnthian earns nothing extra when a user holds more gold. This removes the
structural incentive to churn users into overtrading — which is exactly the
behaviour that ends in a consumer-finance enforcement action and, separately,
the behaviour that would poison the trust claim. It is a genuine commercial
weakness and it is also the reason the business can be described honestly.

---

## Honest limits

These are the places where the thesis is weakest. They are written down because
a founder relying on this document to make real decisions needs the weak points
more than the pitch.

**The moat is operational, and operational moats rot.** Trust in this category
is a claim about *current* facts — who holds the metal, where, as of when.
Attestations expire, issuers change custodians, terms change. Every month of not
verifying is a month of the moat degrading quietly. The verification work is
recurring cost, not one-time.

**Correnthian is relaying someone else's disclosure.** The trust claim is only
as good as the metals provider's own claims about its backing. We are a better
interface to someone else's truth, not an independent source of it. Until a
second, independently-verifiable source of backing data exists (on-chain
proof-of-reserve, an independent auditor), the trust claim rests on a single
partner — the same partner we are operationally dependent on.

**Incumbents can copy this.** A brokerage that decides self-custody is worth
offering can do it. The defence is the accumulated verification record and the
refusal to take principal risk, both of which take longer than a product
decision.

**The audience is harder than crypto users, by decision.** This customer expects
banking-grade reliability and support, and complains to regulators rather than
to Discord. Accepted in spec §8 — a harder audience in exchange for a larger
uncontested one.

**The business has a single point of failure that is contractual.** Mitigated
architecturally by the [rail interface](../architecture/rails.md), not
eliminated. If the partner relationship fails, there is no DEX fallback of any
depth for a fiat buyer.

**Do not read a take rate into any of the above.** No fee percentage, partner
term, provider licence or volume figure appears in these docs because none has
been verified. `TASK.md` records provider due diligence as outstanding and the
original research as degraded. **Verify independently, in writing, before
anyone builds a model on it.**

---

## Open questions

Ordered by how much damage an unanswered one does.

1. **Who is the metals issuer / LP partner, and on what terms?** *Critical path,
   not started.* Redemption mechanics, redemption fees, KYC responsibility, and
   the whole of `docs/compliance/overview.md` depend on it. Multi-month lead
   time.
2. **Is physical redemption in v1?** This is a product question wearing a
   regulatory costume. If the answer is yes, Correnthian may be a precious
   metals dealer in several US states and the compliance surface changes
   materially. See [compliance/overview.md](../compliance/overview.md).
3. **Is the Correnthian fee charged as basis points of notional, or per unit of
   metal?** Undecided, and it is not cosmetic: notional-denominated fees scale
   with the gold price (revenue rises when gold rises, and Correnthian takes no
   view on gold), while per-unit fees are stable but exposed to volume risk.
   This single choice reshapes the whole financial model.
4. **Is there a subscription?** Recurring revenue currently does not exist.
   Anything recurring — custody assurance, premium redemption, higher limits —
   changes both the product and the compliance analysis.
5. **Who pays for KYC?** If the on-ramp provider does it, Correnthian's margin
   is capped by their pricing and Correnthian's compliance exposure is
   second-hand. If Correnthian does it, there is a real cost line and a real
   licence question. Undecided.
6. **Referral programme** — mentioned once, never designed. No action.
7. **Where does the brand sit between "fintech" and "crypto"?** The frame is
   *gold savings app that happens to be self-custodial*. That framing has not
   been pressure-tested with users, and it is the sort of thing that quietly
   determines the entire go-to-market.

---

## What would make this wrong

Written down so it can be recognised early rather than defended late:

- If verification and attestation tracking cost materially more than the
  take rate earns, the trust business does not have a business.
- If the partner's economics leave a take rate that does not cover a
  banking-grade support function, the audience is unserviceable at this margin.
- If the beachhead proves smaller or less willing to pay than assumed, the
  "largest uncontested segment" premise fails and the company falls back to
  competing with crypto-native wallets — where it has no advantage at all.