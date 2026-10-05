# Swap rails

**Date:** 2026-10-05
**Status:** Core abstraction, locked. Rail *selection policy* is not implemented —
see *Open questions*.

Source of truth: [design spec §4.3](../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md)
and decisions #4 and #5. Interface:
[packages/swaps/src/index.ts](../../packages/swaps/src/index.ts) ·
Quote and status types: [packages/types/src/rails.ts](../../packages/types/src/rails.ts)

Related: [architecture/key-boundary.md](../architecture/key-boundary.md) ·
[product/vision.md](../product/vision.md)

---

## The interface

```ts
interface SwapRail {
  readonly id: string;
  readonly kind: RailKind;                 // 'provider' | 'dex' | 'cex' | 'otc'

  supports(from: AssetRef, to: AssetRef): boolean;

  quote(req: QuoteRequest): Promise<SwapQuote>;
  status(quoteId: string): Promise<SwapStatus>;
}
```

Three methods, and each one is doing specific work.

**`supports()` is capability, not preference.** It answers "can this rail
theoretically do this pair" — asset type, chain, jurisdiction, minimum size. It
must not encode a ranking. A rail that returns `false` because it would be a
worse choice than another rail has confused two different questions.

**`quote()` must be honest about its own limits.** See *Why `sizeCap` and
`executionQuality` exist*. This is the only method that touches money.

**`status()` is the reconciliation path.** A quote is a promise, not a
settlement. Anything that goes wrong between quote and signature — provider
timeout, expired quote, changed price, a failed broadcast — is reported here,
with `failureReason`, rather than being discovered as a missing balance.

`QuoteRequest.fromAmount` is a **decimal string**, never a JS number. So is
`notionalUsd`. Token amounts do not survive IEEE-754 rounding, and this is a
financial application.

---

## Why `sizeCap` and `executionQuality` exist

From [packages/types/src/rails.ts](../../packages/types/src/rails.ts):

> Tokenized gold liquidity is thin on-chain and deep only on custodial venues. A
> quote engine that cannot say "this size is not available" will happily quote a
> price it cannot fill. These two fields make honest failure representable in
> the type, so the UI is **forced** to disclose it rather than a marketing
> promise being trusted for it.

```ts
type ExecutionQuality = 'deep' | 'thin' | 'none';

interface SwapQuote {
  ...
  readonly executionQuality: ExecutionQuality;
  readonly sizeCapUsd: number | null;   // largest fill at this price, USD notional
  readonly expiresAt: string;
}
```

The point is not the fields. The point is that a rail **cannot** return a quote
without answering them. There is no way to express "yes, for any size" in the
type, so a provider adapter that only knows about small orders has to either
report `sizeCapUsd` or fail the quote.

**The most dangerous version of this bug is not visible to the user.** A rail
that quotes a size it cannot fill produces a transaction that succeeds on-chain
at a much worse price, or does not settle at all. Either way the user signed
something they did not understand, which is precisely the failure mode the whole
product exists to avoid. `'none'` must mean *no two-sided liquidity* — not
"unknown".

`sizeCapUsd: null` means **unbounded**, which should be reserved for a rail that
genuinely has depth (a provider with its own book) and never defaulted to by a
rail that simply did not compute one.

The UI's obligation follows from the type: a `'thin'` quote must visibly say
that quality degrades above this size. `'none'` must not render as a buy button.

---

## The rail inventory

| Rail | Kind | Status | Carries |
|---|---|---|---|
| `ProviderRail` | `provider` | **Primary. Launch dependency.** | A licensed metals provider delivering tokens directly to the user's smart account |
| `DexAggregatorRail` | `dex` | Secondary, ships | Users who already hold crypto; shallow liquidity, therefore an explicit size cap |
| `CexRail` | `cex` | **Reserved. Unlikely to ship.** | — |

A rail's identity is not its vendor. There is exactly one `ProviderRail`
interface; the vendor behind it is configuration. If the primary partner
changes, the interface does not — see the reversal below.

---

## The reversal: DEX-first → provider-first

This is the worked example of how decisions get made in this repository. It is
recorded here in full because the spec's own ground rules say a reversed
decision should be recorded with what it was, why it changed, and when.

### What it was

An earlier draft chose **DEX-first, LP partner pursued in parallel**. Primary
rail: a DEX aggregator (e.g. routing USDT → a metal token on-chain). Secondary:
the metals partner. This was marked *Locked* in the first decision record.

### Why it was wrong

> It was correct for a crypto-native beachhead and **wrong for this one**. A
> person paying by debit card has no USDT, no gas, and no tolerance for
> slippage. Routing them through a Uniswap USDT→PAXG trade is the wrong
> mechanism for the wrong user.

The reasoning, unpicked:

1. The beachhead buyer arrives with **dollars**. They do not hold USDT, and
   getting to USDT is itself an on-ramp flow they cannot perform.
2. They will not pay gas. A swap UI that shows a network fee to someone who
   thinks gold is a savings instrument reads as a bug.
3. They will not sign a swap. "Approve USDT, then swap, then approve the
   router" is not a UX anyone in this audience will tolerate.
4. Deep gold liquidity is **custodial**. On-chain metal liquidity is thin
   precisely because there is little reason for it to be otherwise.

So the original design would have required three frictions in the exact
transaction the product exists to make effortless.

### What it changed to

**The licensed metals provider is the primary rail and a launch dependency.**
The secondary rail — DEX — was retained for users who already hold crypto, with
an explicit size cap because its liquidity is thin.

> **Nothing else in this project may be late; that may.** The partner contract
> has a multi-month lead time and is the project's critical path.

Decision #4 now reads `Reversed — see §3`. Recorded **2026-10-05**, in the same
document, same day as the reversal.

### What the reversal did *not* change

**The key boundary is untouched.** The provider delivers tokens **directly to
the user's smart-account address**. The user never holds USDT, never sees a
chain, never sees gas, never signs a swap.

> The difference from Kinesis, which is custodial, is precisely the product.

That clause is the whole reason the reversal was affordable. It is not a detail
of the rail decision; it is the condition that made it possible.

### Why the interface made the reversal cheap

> "App code resolves a rail from the registry by capability and never names a
> concrete one. That is what allows decision 4 to change without touching a
> screen."

This is the load-bearing architectural argument for the rail abstraction, and
the reversal is the evidence. If any screen, service or provider adapter had
named a concrete rail, this decision would have required rewriting the buy flow.
Because none did, it required changing a decision record.

The proof of that claim is falsifiable and worth preserving: **if you find a
screen or a service that names `dex` or `provider` literally, that is a bug.**
Resolution goes through the registry by capability.

---

## The reversal is modelled, not yet implemented

An honest note about the current state of `selectRail()`:

```ts
export function selectRail(rails, from, to): SwapRail | undefined {
  return rails.find((r) => r.supports(from, to));
}
```

**First match wins.** There is no ranking, no preference for `provider` over
`dex`, no capability scoring. The source comment says what comes next: *"Later:
prefer provider, fall back to dex."*

So today the rail the product gets depends on array ordering. That is not
acceptable for the primary decision of v1, and it is the single most important
piece of unimplemented logic in this package. The interface is right; the
policy is not written.

The policy needs to answer, at minimum: preference order by `kind`; what to do
when the primary rail cannot quote a size the secondary can; whether the user
ever sees a choice; and how the chosen rail is disclosed before signature
(saying "via provider" rather than "via DEX" is a trust-relevant fact for this
audience).

---

## Open questions

1. **Rail selection policy.** Unwritten. See above. Blocking for the buy flow.
2. **Quote expiry versus provider validity.** `SwapQuote.expiresAt` exists; the
   provider's own quote validity is a different clock. Which one governs, and
   what does the user see between a stale quote and a signature request?
3. **Settlement and finality.** `SwapStatus.state` includes `broadcast` and
   `settled`. What is the rule for when the user is told they own the metal?
   On broadcast, on chain confirmation, or when the provider reports delivery?
   The customer is buying gold — "settled" needs a defensible definition.
4. **Where does `sizeCapUsd` come from for a provider rail?** Either the
   provider tells us, or we have to model it from our own data. Guessing is
   worse than `null`-with-no-fallback: a wrong cap means a quoted-and-unfillable
   order.
5. **What happens when the provider is down?** The DEX fallback is thin by
   definition and is unusable by the beachhead buyer anyway. Is the answer a
   wait, a reduced-size quote, or a visible outage? The spec accepts the partner
   as a single point of failure, mitigated by this interface but not eliminated.
6. **Retry and idempotency.** Nothing in the interface carries an idempotency
   key. A retried `quote()` or a double-submitted order is an open question,
   and double-submission in a financial flow is not a small one.
7. **Partial fills.** `SwapStatus` has no notion of a partial fill. If a rail
   can fill 60% of a size, either it must refuse (set a `sizeCap`) or the type
   must model partials. Pick one deliberately; do not discover it in production.
8. **Is `otc` a real rail kind?** It exists in `RailKind` with no
   implementation and no decision. Deservedness tests will be needed once it is
   real — OTC is exactly the kind of thing that creates AML exposure. See
   [compliance/overview.md](../compliance/overview.md).