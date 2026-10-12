# XAUT / TG Commodities — diligence pack (2026-10-12)

**Purpose:** the question list and terms record for the issuer conversation.
Owner holds a tether.to account; this pack turns that head start into a
partnership track. Nothing here is a commitment — commercial and legal
answers come from them and from counsel, not from this file.

**Terms on record** (vendor-published, verified 2026-10-12 against
`tether.to/en/fees` — re-verify at signing; web pages move):

| Term | Figure |
|---|---|
| Minimum acquisition or redemption | 100,000 USD |
| Acquisition fee | 0.1% |
| Redemption fee | greater of $1,000 or 0.1% |
| Verification fee | 150 USD, payable in Tether tokens |

**Design consequence already taken:** the $100k minimum makes direct
redemption wholesale-only. Retail exit is market sell-back unless
aggregation is permitted (question 3 below) — the redemption execution
build waits on that answer plus counsel.

---

## 1. Company, licensing, standing

1. Confirm the issuing legal entity (TG Commodities S.A.?) and jurisdiction.
2. Licences held that cover issuance and redemption of a gold-backed token.
3. Most recent auditor name and report date for the gold reserves.
4. Has any regulator restricted, fined, or opened proceedings against the
   issuer in the last 3 years? (For counsel, not for us to judge.)

## 2. Attestation (feeds our backing-disclosure UI)

5. Attestation cadence and publisher; sample of the two most recent reports.
6. Are reports per-bar/serialised or pooled claims? Which vaults, named?
7. Machine-readable endpoint or file drop for reserve figures (URL, format,
   update cadence, auth)? Our UI shows custodian, vaults, proof-of-reserve
   URL and freshness — what we cannot fetch on a schedule, we must hand-enter.

## 3. Redemption mechanics (shapes our state machine)

8. Confirm current minimum lot, acquisition/redemption fees, verification
   fee and tier.
9. **Aggregation:** may one $100k+ settlement cover metal requested by many
   end-users through our flow, or must each redeeming party qualify alone?
10. Settlement timeline at minimum lot (request → metal shipped/delivered).
11. Identity requirements per redeeming party (documents, jurisdictions
    excluded).
12. Delivery geography: where is metal shipped from, where to, who insures
    transit, what serialisation (per-bar numbers?) accompanies delivery?
13. Failure handling: refused request, failed delivery, disputed weight —
    what are the reversal/compensation mechanics?

## 4. Chains and tokens

14. Confirm XAUT contract addresses on Ethereum (and Base, if supported).
15. Any chain restrictions on transfers we must enforce client-side?

## 5. Commercial and support

16. Partner/distribution arrangements: does TG Commodities support
    integration partners, and who owns that conversation?
17. Volume tiers or fee schedules beyond the public page.
18. Technical contact / SLA for integration breakage; sandbox or test
    facility for the acquisition/redemption flow.
19. Notice periods for fee or terms changes (our fee disclosure quotes
    their numbers — silent changes become our misstatements).

## 6. For counsel (do not pre-answer)

- Money-transmitter analysis of flows 1–3 above under our entity.
- Whether user-batch aggregation needs a licence wrapper.
- CFTC-vs-SEC posture for metal tokens sold to our beachhead buyer.
- Entity, jurisdiction, and contract review of whatever they send back.

---

## Acceptance criteria (for the builds this unblocks)

- Metals-buy endpoint: acquisition fee + minimums encoded from signed
  terms, not from this file.
- Redemption execution: lot formation (aggregated iff Q9 permits),
  fee lines from signed terms, settlement tracking to delivered.
- Attestation verification: scheduled fetch where Q7 gives a machine
  endpoint, else hand-entry with freshness flags (already built).
