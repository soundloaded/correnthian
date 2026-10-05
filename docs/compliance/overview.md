# Compliance overview

**Date:** 2026-10-05
**Status:** Posture and reasoning only. **This is not legal advice.** Counsel
has not been engaged (`TASK.md`, blockers table). Counsel is required **before
the product design is frozen**, not before launch.

Source of truth: [design spec §7](../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md)
— *"Legal and tax. Entity structure, the money-transmitter analysis for metals,
and whether tokenized precious metals fall under CFTC or SEC jurisdiction are
questions for crypto/fintech counsel, not an architecture document."*

Related: [product/vision.md](../product/vision.md) ·
[architecture/key-boundary.md](../architecture/key-boundary.md) ·
[engineering/api.md](../engineering/api.md) (the `compliance` module)

---

> **Read this first.** Nothing in this document cites a statute, a licence
> class, a provider's regulatory status, or a threshold. Those were
> deliberately omitted: an unverified citation in an architecture document is
> worse than an acknowledged gap, because it reads as if someone checked.
>
> **Everything marked "verify independently" below is a question for counsel,
> not a statement by Correnthian.** Where a real answer exists, it lives in
> counsel's written opinion, and it should be linked from here when it does.

---

## The thin-aggregator posture

**Decision #1, locked:** Correnthian holds no assets, takes no principal risk,
and earns stated, itemised fees.

The intent of that posture is specific: to keep Correnthian on the
**software-provider** side of the money-transmitter line, and to avoid a capital
requirement. Custody is the thing that creates the hardest obligations, so
Correnthian takes none of it.

Three architectural decisions carry the posture, and each one is doing
regulatory work, not just engineering work:

| Architectural decision | Regulatory function |
|---|---|
| [Key boundary](../architecture/key-boundary.md) — no key material on any Correnthian server | Correnthian is not a custodian of user assets |
| Fees itemised and pre-signature, zero spread | Correnthian does not take a position in the asset or earn by mispricing it |
| Provider delivers tokens directly to the user's smart account | Correnthian does not take title to, or control over, the metal |

**The honest limit of this reasoning:** it establishes what Correnthian *is*.
It does not establish what Correnthian *does*. Regulators do not classify
companies by posture; they classify them by what actually happens to a
customer's money. Which is the next section.

---

## Why AML and sanctions obligations arise anyway

The self-custodial posture does not remove them. It changes their shape.

**Once a fiat on-ramp exists, Correnthian is selling to consumers with dollars.**
The customer opens an account at Correnthian, pays dollars, and shortly
receives a metal-linked token. At that point Correnthian has:

- Introduced itself into the flow of funds, as the party the customer chose to
  transact with.
- Onboarded and identified a customer — which means holding the identity data
  that screening obligations act on.
- Sold a financial instrument to a consumer, in exchange for money, in a
  jurisdiction.

**None of that depends on custody.** The obligations arise from being the
counterparty-of-record for a fiat purchase. A self-custodial wallet with no
on-ramp has a materially smaller surface than a self-custodial wallet with one.
This is why `TASK.md` P1.3 has a `compliance` module in v1 and why decision #10
marks compliance as **load-bearing in v1, not deferred**.

**What this means concretely for the build:**

- The `onramp` provider handling KYC does **not** automatically discharge
  Correnthian's obligations. Delegating screening is not the same as having no
  obligations. **Verify independently, with counsel.**
- Jurisdiction restrictions become a product requirement, not a compliance
  afterthought — hence the [jurisdiction engine](#the-jurisdiction-engine)
  below and the `JURISDICTION_BLOCKED` error category in
  [engineering/api.md](../engineering/api.md).
- Every jurisdiction decision must be **attributable**: which rule, from where,
  effective from when. A rules engine that cannot answer "why was this user
  blocked on 14 March" is not an audit trail.

**Open, and it is a real question:** whether Correnthian needs its own
sanctions-screening program, or can rely on its on-ramp provider's, or on a
screening vendor, or on some combination. This decides whether the `compliance`
module is a thin rules engine or a substantial subsystem. It is not a decision
engineering can make.

---

## Physical redemption and precious-metals dealer status

> "Offering physical redemption or delivery may make Correnthian a precious
> metals dealer — separately licensed in many US states. If delivery is in
> scope, jurisdiction selection depends on it."
> — design spec §7

This is the single most consequential open question in the product, and it is
worth stating plainly how it works:

**A product decision has a regulatory consequence large enough to change the
entity structure.** *"Will v1 let a customer take physical gold?"* sounds like a
scope question. It is not — if the answer is yes, Correnthian may need state-by-state
dealer licensing, and that changes where the company can operate, what the
on-ramp flow looks like, and potentially which entity holds the customer
relationship.

**This is the item most likely to be decided by accident**, because it is
natural to design the redemption path late, once the partner is signed and the
token flow works. By then it is expensive to reverse.

**Recommendation:** force the decision before design freeze, and record the
answer with the reasoning. Even choosing *"no physical redemption in v1"* is a
useful decision, because it bounds the licensing surface — and it can be
revisited later with counsel, whereas an implemented delivery flow cannot be
un-implemented.

**Verify independently:** which US states treat tokenized-metal redemption or
delivery as dealer activity, what the licensing obligations attach to, and
whether a software intermediary is in scope or only the party taking title.
None of this has been researched. Do not assume "we never touch the metal" is
a complete answer — a dealer is defined by activity, not by custody.

---

## The jurisdiction engine

From the original design conversation:

```
Country
   ↓
State
   ↓
User eligibility
   ↓
Available features
```

Four levels, and the ordering is the design. Features are not globally
available; eligibility is resolved first, and the eligible feature set falls out
of it.

### Why the `State` level exists

Country alone is not sufficient for a US product — which is precisely why the
physical-redemption question above lands where it does. State-level rules mean
the answer can differ between a user in one US state and a user in the next
state, for the same product, on the same day. Any jurisdiction model that stops
at country is wrong for the US by construction.

### Design requirements

These follow from the constraints above; they are engineering requirements on
the `compliance` module, not legal positions.

1. **Default deny.** An unknown country, an unresolvable state, a rule set that
   fails to load — all of them deny. Never allow. An error that falls open is
   worse than an outage.
2. **Versioned rules with an effective date.** A decision must be
   reconstructible: *which rule, from where, effective when, decided by whom*.
   Store the rules as data, not as code that gets redeployed.
3. **Attributable refusals.** The `JURISDICTION_BLOCKED` error carries the
   jurisdiction, the rule id and the effective date, so the UI can tell the
   user something true and the audit log can explain itself later.
4. **Features derive from eligibility, not from separate flags.** Two
   independent switches for "is this user allowed" and "is this feature on"
   will eventually disagree.
5. **The rules source is an input, not a constant.** It changes on a schedule
   nobody controls. Someone must own it. See *Open questions*.

### What is not decided

- **Where do the rules come from?** Counsel? A vendor? A maintained internal
  table? Each has a different maintenance cost and a different failure mode.
- **Who owns updates, and how are they reviewed?** Nobody currently owns this.
- **What is the appeal path?** If a user is blocked, who tells them, and does
  the decision get reviewed? For a consumer product this is a real requirement,
  not a nicety.
- **Is user-declared location enough, or is geolocation required?** Open-routing
  VPNs, and cross-border residency, both complicate it.
- **Does eligibility change over time?** A user eligible when they signed up may
  not be eligible later. Does an existing account get frozen, or grandfathered?
  That answer has product and regulatory consequences and is unrecorded.

---

## What is deliberately not in this document

- No statute, regulation, or licence class is named. **Verify independently.**
- No claim about any provider's or issuer's regulatory status. `TASK.md` records
  provider due diligence as outstanding and the original research as degraded.
- No threshold, limit, or filing requirement.
- No jurisdictional scope for Correnthian. **The entity does not exist yet.**

---

## Open questions

| # | Question | Who must answer | Blocks |
|---|---|---|---|
| 1 | Entity structure and jurisdiction of incorporation | Counsel | Everything |
| 2 | The money-transmitter analysis **for metals specifically** — not the generic wallet analysis | Counsel | On-ramp design |
| 3 | Whether tokenized precious metals fall under CFTC or SEC jurisdiction | Counsel | Product design, disclosures |
| 4 | **Is physical redemption in v1?** | Product + counsel, together | Jurisdiction selection, licensing |
| 5 | Does Correnthian need its own sanctions-screening programme, or is the provider's sufficient? | Counsel | `compliance` module scope |
| 6 | Who performs KYC, and at whose cost? | Counsel + commercial | Margin, P1.3 `onramp` |
| 7 | Consumer disclosure requirements — what must be shown, where, and in what wording | Counsel | Buy flow, marketing site |
| 8 | Tax treatment of the holding and of any redemption | Counsel | Marketing claims |
| 9 | Record-keeping obligations and retention periods | Counsel | `audit` module design, backup posture |
| 10 | What are the marketing constraints? (Expected-return language, risk disclosure, "gold" claims) | Counsel | Marketing site, in-app copy |

**Sequencing, from the design spec:** *"Counsel is required before the product
design is frozen, not before launch."* These questions are load-bearing for
v1 — they can change the design — but they do not have to be answered before
code is written. What they **must** precede is design freeze, which means the
question is: **when is that?** Nothing in the current plan names a date, and
items 2, 4 and 7 all change how the buy flow is built. That is a scheduling
risk worth naming explicitly rather than discovering at freeze time.

The only thing worse than not having counsel early is having counsel early and
not acting on the answer, so the questions above are recorded in `TASK.md`'s
blockers table and should be checked off there as they are resolved.