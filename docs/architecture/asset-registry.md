# The asset registry

**Date:** 2026-10-05
**Status:** Core. `Backing` and `Trust` are not metadata — they are the product.

Source of truth: [design spec §4.2](../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md).
Types: [packages/types/src/asset.ts](../../packages/types/src/asset.ts) ·
Logic: [packages/assets/src/index.ts](../../packages/assets/src/index.ts)

Related: [product/vision.md](../product/vision.md) (the wedge) ·
[architecture/rails.md](../architecture/rails.md) (which assets are tradable
through which rails)

---

## Identity is `(chain, contract, issuer)` — never a symbol

> **A symbol is never an identity.** An asset is
> `(chain, contract, issuer)`. USDT on Ethereum, BNB, Polygon, Tron and Solana
> are five distinct assets.

The failure this prevents is mundane and catastrophic: treating USDT-on-Ethereum
and USDT-on-Tron as one asset means a balance aggregation that silently adds two
different contracts, or a transfer routed to the wrong network. Both are
user-visible losses of funds, and both look like a bug nobody can reproduce.

`packages/types/src/asset.ts` states the invariant; `deriveAssetId()` in
`packages/assets` is the **only** place that produces an identifier:

```
<chainId>:<contractAddress lowercased | "native">:<issuerId>
```

Four properties follow from the implementation, all of them deliberate:

| Property | Why | Covered by |
|---|---|---|
| Derived, never hand-assigned | A hand-written `assetId` can disagree with its own triple. Deriving it makes disagreement impossible. | — |
| Contract lowercased | `0xAbC…` and `0xabc…` are the same contract. Without this, one asset gets two identities. | `registry.test.ts` — "is case-insensitive on contract address" |
| Native assets use `native` in the contract slot | ETH has no contract address. `null` would make the ID format unstable. | `registry.test.ts` — "names native assets without a contract slot" |
| The same symbol on two chains yields two IDs | The whole point. | `registry.test.ts` — "treats the same symbol on two chains as two different assets" |

**Rule: never key a map, a cache, a balance record, or a URL parameter on
`symbol`.** If you need a human label, read `asset.symbol`; if you need to
identify, use `assetId` or `AssetRef`. There is no third option.

`AssetRef` — `{ chainId, contractAddress, issuerId }` — is the minimum a caller
needs to name an asset unambiguously. APIs should take `AssetRef`, not an
`assetId` string, so that identity is always reconstructible.

---

## `Backing` — what the token actually is

```ts
interface Backing {
  custodyModel: 'allocated' | 'unallocated' | 'synthetic';
  custodian: string | null;
  vaultLocation: string[];
  proofOfReserve: string | null;
  attestationCadence: 'monthly' | 'quarterly' | 'annual' | 'none';
  lastAttestation: string | null;
  gramsPerToken: number | null;
  ouncesPerToken: number | null;
}
```

| Field | What it must mean | Failure mode if wrong |
|---|---|---|
| `custodyModel` | Whether a specific, identified piece of metal backs *this* holding | **The single most dangerous field.** Getting this wrong means telling a customer they own gold when they hold a derivative |
| `custodian` | The legal entity holding the metal, named | "Trust us" — the exact thing the beachhead refuses |
| `vaultLocation` | Where the metal physically is | Unverifiable claim. Fine to have multiple; not fine to have empty on an allocated token |
| `proofOfReserve` | Where the attestation lives, not just that one exists | An unopenable proof is not a proof |
| `attestationCadence` | How often the issuer commits to one | Sets expectations for how stale the data goes |
| `lastAttestation` | **Date of the last actual attestation** | The freshness signal. Its absence is the signal |
| `gramsPerToken` / `ouncesPerToken` | The fixed denomination, if there is one | Without it, the metal content of a holding cannot be computed at all |

`custodyModel` has exactly three values and they are not interchangeable:

- **`allocated`** — each token is backed one-for-one by specific, identified
  metal. This is what a gold buyer thinks they are buying.
- **`unallocated`** — backed in aggregate; no specific metal is reserved for
  them. Real backing, no specific claim.
- **`synthetic`** — no metal at all. Price exposure only. **This is not a
  physical-gold product and the UI must never imply otherwise.**

## `Trust` — how much Correnthian stands behind the above

```ts
interface Trust {
  verifiedTier: 'issuer-verified' | 'community-verified' | 'unverified';
  riskFlags: string[];
}
```

`riskFlags` is an open string list. The seed registry uses
`no-attestation` and `synthetic-backing`. It is deliberately not an enum,
because flags are discovered faster than types can be changed — but that also
means **nothing enforces that flags are ever set**. See *Open questions*.

---

## Why these payloads are the product

The spec's sentence:

> "These fields exist so the UI can make an honest claim, and they are the
> product — not metadata. A registry without them cannot produce the sentence
> that is Correnthian's entire differentiation."

The sentence in question is the answer to *"what am I holding, who backs it,
and can I take it out."* Decomposed:

- **"what am I holding"** — grams/troy ounces per token, plus identity by triple.
  A token count is not an amount of metal.
- **"who backs it"** — `custodyModel`, `custodian`, `vaultLocation`,
  `lastAttestation`.
- **"can I take it out"** — `TradingCapabilities.redeemSupported`, plus the
  actual redemption terms, which come from the partner and are **not yet
  secured**.

A registry that holds only `(contract, symbol, price)` supports the first clause
badly and the other two not at all. It would render Correnthian indistinguishable
from a block explorer with a metals filter.

---

## Honest-disclosure rules

These are hard rules. They are enforced in code by `describeBacking()` and
covered by tests, and they should be enforced in every surface that displays an
asset — not only the one that calls the helper.

1. **Never present a synthetic token as metal.** `describeBacking()` returns
   `"Price exposure only. No physical metal is held for this token."` for
   `custodyModel: 'synthetic'`, before it looks at any other field. Covered by
   `"never presents a synthetic token as metal"`.
2. **Never present unallocated as allocated.** The two produce different
   sentences and different user expectations. There is no path in the code where
   one can be rendered as the other.
3. **State the gap; never omit it.** A missing `lastAttestation` renders
   `"never attested"` rather than silently dropping the clause. Covered by
   `"says 'never attested' rather than omitting the gap"`. The same rule
   generalises: a registry that cannot answer a question must say so in words,
   because a field the UI does not render looks identical to a field that does
   not apply.
4. **The disclosure travels with the asset, not beside it.**
   `ListedAsset.disclosure` (`services/api/src/assets/assets.service.ts`)
   returns the asset *and* its disclosure together, and the API substitutes
   `"Backing information unavailable."` when `describeBacking()` returns null.
   Clients must render `disclosure` verbatim. **Do not recompute it in the UI** —
   that creates a second implementation that will drift and will eventually be
   wrong in the direction that is easiest to get wrong.
5. **Disclose before the user buys, not after.** The fee disclosure rule
   ([spec §4.4](../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md))
   applies to backing claims too: the disclosure must be on the screen before
   the signature, not on a detail page reached afterwards.

### The seed registry contains unverified claims — do not ship it

`services/api/src/assets/seed-registry.ts` populates a realistic-looking gold
token with specific custodian, vault location and attestation date values.

**Those values are illustrative placeholders. They are not verified.**
`TASK.md` records provider due diligence as outstanding and notes that the
original research was degraded and unverified. The file's own comment is
correct — *"This is not the registry — it is the shape the registry must be able
to hold."*

Before any of these values can appear anywhere a user can see them, each must
be independently sourced and dated, with the source recorded. **Verify
independently; do not carry these strings forward on trust.** The synthetic
lookalike token in the same file exists deliberately, to exercise the
disclosure path — keep it, and keep it in any fixture used by the admin.

---

## Rules for changing the registry

1. **An asset may not be listed without a known `custodyModel`.** Unknown is
   not a value. Unknown means the asset is not listed yet.
2. **Never infer anything from the symbol.** `XAU` in the seed file is synthetic
   — which is exactly the case a symbol-based inference would get wrong, and
   exactly why it is in the fixture.
3. **`lastAttestation` must move with reality.** A stale attestation is a
   disclosure failure, not a cosmetic staleness. Add a rule that flags an asset
   as degraded when the date is older than its own `attestationCadence` allows.
   *Not implemented — see open questions.*
4. **Risk flags must be set on the way in, not added later.** A flag discovered
   months after listing is a correction notice, which is worse than a smaller
   initial set.
5. **Registry changes are auditable events.** `services/api` has an `audit`
   module planned ([engineering/api.md](../engineering/api.md)). A change to
   `Backing` or `Trust` changes what a customer is told they own, and must be
   attributable and reversible.

---

## Open questions

1. **`null` is overloaded.** `custodian: string | null` conflates *"no custodian
   exists"* (true of a synthetic token) with *"we have not found out"*. The UI
   cannot honestly distinguish them. Same for `proofOfReserve` and
   `lastAttestation`. A tri-state (unknown / none / value) is probably correct
   and is a breaking change to `Asset` — decide before the registry becomes
   real data with real customers behind it.
2. **Who sets `verifiedTier`, on what evidence, and who revokes it?** There is
   no verification workflow. As written, `issuer-verified` is a field the
   registry can assert about itself. If it means "Correnthian checked", there
   must be a process and an audit trail behind it; if it means something weaker,
   it should be renamed. **Currently this field could be used to lie.**
3. **How are `riskFlags` governed?** Open strings, no registry, nothing
   enforcing that they are ever read. A small enum plus an "other" string, or a
   documented flag catalogue, would make the field usable.
4. **Attestation staleness has no enforcement.** Nothing compares
   `lastAttestation` against `attestationCadence`, so a two-year-old attestation
   on a monthly-cadence asset renders exactly like a fresh one.
5. **Is `Asset` too wide for a mobile client?** It carries everything at once.
   A list endpoint probably wants a summary shape and a detail endpoint the full
   payload. Not a correctness problem, but it will show up when the web and
   mobile wallets are built.
6. **Who owns verification, as work?** The moat is the verification record.
   That means a recurring operational task with an owner, a cadence and a cost.
   Nobody currently owns it.