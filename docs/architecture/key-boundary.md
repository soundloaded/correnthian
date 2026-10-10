# The key boundary

**Date:** 2026-10-05
**Status:** Load-bearing. Violating it does not degrade the product — it
invalidates the security model, the regulatory posture in
[compliance/overview.md](../compliance/overview.md), and the trust claim in
[product/vision.md](../product/vision.md).

Source of truth for the decision: [design spec §4.1](../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md)
and decision record #6, #7.

**Read this document before writing anything that touches keys, accounts,
sessions, or signing.**

---

## The rule

```
private key / seed ──► user device ──► local signing ──► signed tx ──► network
        │
        └─ never crosses to Correnthian's servers. Ever.
```

Not "we do not currently send it". Not "we redact it in transit". **Never.**
No Correnthian-operated service may accept, store, log, transform, escrow, or
transmit key material. There is no feature, no recovery flow, no support
workflow, no analytics pipeline, and no debugging tool that is an exception.

The practical formulation that makes it checkable: **a Correnthian server must
be incapable of moving a user's funds.** If a server compromise can empty a
wallet, the boundary has failed, regardless of intent.

---

## The threat model the boundary buys

What a full compromise of Correnthian's infrastructure yields:

| Attained | Not attained |
|---|---|
| Read balances, addresses, holdings, transaction history | Any signature over a user transaction |
| Change preferences, notification settings, display name | Derive or recover a private key |
| Revoke sessions and devices | Restore a revoked passkey |
| Serve wrong prices, wrong disclosures, wrong asset metadata | Move funds |
| Refuse service (outage) | Not be blamed for a loss |
| Read KYC/compliance records | Transfer those records to a third party |

That last row is not "no risk" — it is a materially different risk class.
Correnthian holds personal data about a financial product, which is its own
problem, addressed in [compliance/overview.md](../compliance/overview.md).

**It is also why the boundary is a product asset.** Once customers have
understood that a Correnthian account cannot be drained by anyone at Correnthian,
that understanding cannot be withdrawn without breaking every user's
expectation. A competitor cannot retrofit it.

---

## Structural enforcement

> "`packages/wallet-core` takes no HTTP client, no RPC endpoint and no provider
> SDK. If one is ever added to that dependency graph, the boundary is broken."
> — design spec §4.1

The enforcement is meant to be **structural, not procedural**. A rule that lives
only in a code review or a doc comment decays; a rule that lives in the
dependency graph does not.

### What is actually enforced today

[packages/wallet-core/package.json](../../packages/wallet-core/package.json)
declares exactly one dependency: `@correnthian/types`. No runtime dependency of
any kind. That is a genuine structural property, and it is why
`packages/wallet-core/src/index.ts` can declare `sign(payload)` and mean it.

The module's own doc comment names the denylist explicitly — React, Next.js,
React Native, `fetch`, `axios`, every provider SDK. The `Signer` interface takes
a payload and returns a signature; there is no seam through which a network
call could be introduced without an obviously wrong import appearing in a
package that has none.

### What is *not* enforced today — a real gap

**No automated guard checks this.** The CI workflow
([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) has two jobs:

- `verify` — typecheck, build, test.
- `secret-scan` — greps `*.env*` files for assignments to any of `PRIVATE_KEY`, `MNEMONIC`, `SEED_PHRASE`.

Neither job inspects `wallet-core`'s dependency closure. The "secret-scan" job
is a useful guard against *credential* leakage into environment files; it says
nothing about the *key boundary*, which is about code structure. The two are
easy to conflate, and the job's name ("Key-boundary guard") invites the
conflation.

**Proposed — not implemented, needs a decision:**

Add a CI job that computes `wallet-core`'s transitive runtime dependency
closure and fails if it contains any of: `fetch`/`undici`/`axios`/`got`/`node-fetch`,
`viem`/`ethers`/`@web3-onboard/*`, `bitcoinjs*`, `@solana/*`,
`@correnthian/blockchain`, `@correnthian/integrations`, or any package whose
name matches `*sdk*`. The same closure should additionally be checked in
`services/api/**` for `wallet-core` — the API may *describe* account types but
must not sign.

The cheapest version of this is a test in `packages/wallet-core` that imports
its own `package.json` and asserts the dependency list is exactly the expected
one. That is weaker (it does not catch transitive additions) but it runs in
seconds and requires no tooling.

**Open:** is a dependency-closure guard in CI acceptable, or is the manual
review at `packages/wallet-core` boundary-touching PRs considered sufficient?
This is a decision, not a technical question.

---

## Two things share the word "account"

> "Two things share the word 'account' and conflating them is a security bug."
> — [packages/types/src/account.ts](../../packages/types/src/account.ts)

### 1. Correnthian Account — server-side

Profile, devices, preferences, notifications, KYC status, jurisdiction. Exists
in Postgres. **Holds no key material of any kind.** Defined as
`CorrenthianAccount` in the domain types.

### 2. Key Container — device-side

Never serialised to a transport. Defined as `KeyContainer`. Contains one or
more account *kinds*:

| | `SmartAccount` | `SeedAccount` |
|---|---|---|
| Chains | Ethereum, Base | Bitcoin, Solana |
| Key material | Passkey (WebAuthn) | BIP-39 mnemonic |
| Address | Deterministically derived via CREATE2, `deployed: false` until used | Derived by derivation path |
| Recovery | On-chain guardians | **Unresolved — see below** |
| Gas | Sponsorship required (this user will not pay $2.40 to move gold) | Paid by user |
| Phase | v1 | Deferred until after the EVM slice |

**Do not merge them.** They are separate types with separate managers
(`SmartAccountManager`, `SeedAccountManager`) precisely so that "which recovery
model protects this holding" is answerable without inspecting the chain. A
union type that merged them would force every call site to branch on chain to
answer a security question.

### The rule that follows

**Compromising a Correnthian Account must never yield funds.** Concretely: no
Correnthian Account field may be sufficient to produce a signature, and no
Correnthian session may be sufficient to move funds. Sessions authenticate
*requests*; the signature that moves funds is produced on the device.

---

## Recovery

**Decision #7, locked:** recovery is **on-chain social recovery** via guardians.
A lost passkey must not mean lost funds, and Correnthian holds **no share** of
the recovery material. Corenthian does not run a backup service, does not hold
an escrow key, and must never be added to a guardian set by default.

This is a direct consequence of the boundary: any recovery mechanism that
requires Correnthian to hold something *is* a custodial arrangement wearing a
self-custodial label.

### Unresolved: seed accounts have no guardian path

**This is a genuine contradiction in the current design and it needs a decision
before the Bitcoin/Solana work starts, not after.**

Decision #7 and spec §4.1 describe recovery as on-chain social recovery for the
platform. But Bitcoin and Solana seed accounts hold BIP-39 keys on a plain
secp256k1/ed25519 derivation — **there is no on-chain account contract to place
guardians in.** A guardian set cannot restore a seed account, because there is
no on-chain state for the guardians to act on.

The available options, none of which is currently chosen:

1. **Accept that seed accounts are backed up by the user** — the seed phrase
   and a written backup, with Correnthian offering no recovery at all. Honest,
   and a marked regression in reliability relative to smart accounts. It also
   reintroduces exactly the failure mode the beachhead cannot tolerate, for any
   future user who reaches for BTC/SOL.
2. **Wrap BTC/SOL in a smart-account or multi-sig layer** so guardians become
   possible. This changes the custody model of those chains substantially and
   is a much larger project than "add an adapter".
3. **Social-recovery wallet scheme** (e.g. a key-splitting construction where
   guardians hold shares rather than a contract). Compatible with BTC/SOL in
   principle; carries its own security analysis that has not been done.
4. **Defer BTC/SOL indefinitely** and never ship seed accounts. Consistent with
   the spec's removal of multi-chain sprawl from scope, and the cheapest answer.

Option 4 is the one most consistent with what the spec already decided. It is
recorded here as a question, not a decision, because the spec explicitly keeps
BTC/SOL alive (deferred, with a trigger: "after the EVM slice").

**Related known gap, accepted in spec §8:** guardian flows require a user graph.
Guardian flows only work once users know each other. A user with no friends in
the product cannot use the recovery feature they were promised. Until the graph
exists, the honest UI is to say so rather than to hide the option.

---

## What breaks the boundary

Anything on this list is a boundary break, regardless of intent.

1. **An HTTP client, RPC endpoint, or provider SDK in `wallet-core`'s
   dependency graph.** The canonical break. See *Structural enforcement*.
2. **A server-side "backup", "restore", or "recovery key" service.** Any of
   these is custody. There is no compliant version of this.
3. **A support tool that can view or request a signature.** Read-only support
   tooling is fine — transaction history, holdings, device list. Anything that
   can *cause* or *relay* a signature is not.
4. **A phishing-shaped recovery flow.** Any surface that asks a user to paste a
   seed phrase into a Correnthian web page is an attack, even if it is our own
   page and even if it works. The product's beachhead is seed-phobic by
   definition; a flow that contradicts that will destroy more trust than any
   outage.
5. **Session keys minted server-side with scopes broader than the user's
   intent.** A session key is a real, constrained delegation from a device. If
   the server can mint one unilaterally, or grant it a scope the user never
   authorised, the account is custodial.
6. **A gas paymaster that can cause a transaction rather than only sponsor
   one.** Sponsorship is deferred ("commercial decision", spec §6). When it is
   designed, the paymaster must be able to *pay for* a user-signed operation and
   be structurally unable to originate one.
7. **CEX routing.** Decision record reserves a `CexRail` and marks it "probably
   never" because it weakens the key boundary. Reserved means reserved.
8. **Logging a signed payload.** A signature is not key material, so
   `redactDeep()` will not catch it — but a logged signed transaction is a
   replayable authorisation if the nonce has not been consumed, and it leaks
   exactly what an attacker needs. See
   [engineering/standards.md](../engineering/standards.md).
9. **An admin capability that can move user funds.** Admins operate the
   platform. They do not operate users' wallets. If an admin action can produce
   a signature, it is a break, and it is a critical one.

---

## Invariants

These are the assertions the codebase should be making in tests. Only the
first is currently covered, and only indirectly.

- [ ] `wallet-core`'s transitive runtime dependency closure contains no
      networking library, no chain SDK and no provider SDK. *(Not implemented —
      proposed above.)*
- [ ] No module reachable from `services/api` imports a `Signer`. *(Not
      implemented.)*
- [ ] `redactDeep()` redacts a mnemonic, a 32-byte hex key, and any object field
      named `seed`/`mnemonic`/`privateKey`/`secret`/`password`/`passphrase`.
      **Covered** — [packages/security/src/__tests__/redact.test.ts](../../packages/security/src/__tests__/redact.test.ts).
- [ ] A synthetic or unallocated token is never described as metal.
      **Covered** — [packages/assets/src/__tests__/registry.test.ts](../../packages/assets/src/__tests__/registry.test.ts).
- [ ] No key material appears in any `.env*` file. **Covered** by CI
      `secret-scan`.
- [ ] No signed payload is passed to `log.*`. *(Not implemented; see item 8.)*
- [ ] Every Correnthian Account mutation endpoint is reachable only with a
      session, and none of them can return or accept key material. *(Not
      implemented — depends on P1.2.)*

---

## Open questions

1. **Do we add the dependency-closure guard to CI?** Currently the boundary is
   enforced by convention plus a code comment. That is weaker than the spec
   claims and the spec's own wording ("enforced structurally") deserves an
   actual mechanism.
2. **How do `SeedAccount`s recover?** Unresolved — see *Recovery* above. Must be
   decided before Bitcoin/Solana work begins.
3. **What is the session-key model?** Scope, lifetime, revocation, and whether
   a session key can ever be minted without a fresh device signature. Deferred
   with the paymaster; needed for any usable web experience.
4. **What happens before smart-account deployment?** Addresses are derived via
   CREATE2 and `deployed: false`. Who pays the deploy, and can a provider
   deliver tokens to an undeployed address safely? This is a live integration
   question with the not-yet-signed partner.
5. **Who is a guardian, and can Correnthian suggest them?** Suggesting a
   guardian edges toward Correnthian influencing recovery. Suggesting nothing
   means most users pick badly. Needs a product *and* a compliance answer.
6. **What is the incident response if the boundary is ever crossed in
   production?** No runbook exists. `docs/runbooks/` is empty. This should be
   written before, not during.