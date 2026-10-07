# BACKEND_ROADMAP

The dependency order from plan §68, annotated with what is already done, what
is half done, and what the annotation says the plan got wrong.

Verified against the repository at `2be6499`.

---

## 1. The plan's chain, annotated

```
FOUNDATION            ████████████████████  DONE
    ↓
DATABASE              ████████████████████  DONE (DEF-003 closed in 7ad3d69)
    ↓
AUTH                  ████████████████████  DONE
    ↓
USER/DEVICE           ████████████████████  DONE
    ↓
WALLET METADATA       ████████████████████  DONE
    ↓
BLOCKCHAIN ABSTRACTION████████████████████  DONE (EVM only)
    ↓
ASSET REGISTRY        ███████████████████░  DONE; verification workflow missing
    ↓
INDEXING              ████░░░░░░░░░░░░░░░░  Balance sync only. No events.
    ↓
TRANSACTIONS          ░░░░░░░░░░░░░░░░░░░░  NOT STARTED
    ↓
PORTFOLIO             ████████████░░░░░░░░  Valuation and snapshots. No history curve.
    ↓
PRICING               ██████░░░░░░░░░░░░░░  Record and read. No feed, no scheduler.
    ↓
SWAPS                 ██████████░░░░░░░░░░  Quote + disclosure. No rail, no execution.
    ↓
ON-RAMP/OFF-RAMP      ████░░░░░░░░░░░░░░░░  Refuses by design. No provider.
    ↓
PRECIOUS METALS       ████░░░░░░░░░░░░░░░░  Redemption state machine. Request path dead.
    ↓
COMPLIANCE/RISK       ████████░░░░░░░░░░░░  Jurisdiction only. No KYC, AML, sanctions, risk.
    ↓
ADMIN OPS             ████████████████░░░░  11 route files. Operations pages missing. Role gate closed (DEF-016).
    ↓
ANALYTICS             ░░░░░░░░░░░░░░░░░░░░  NOT STARTED
    ↓
RECONCILIATION        ░░░░░░░░░░░░░░░░░░░░  NOT STARTED
    ↓
PRODUCTION HARDENING  ██████░░░░░░░░░░░░░░  CI yes. No SAST, no deploy, no runbooks.
```

Plan §68 also says:

> Some security, admin, audit and observability components begin **much earlier**
> and continue throughout the entire project.

That is accurate and has happened: audit, RBAC, rate limiting, the key-boundary
guard and the admin console were all built early. Audit and admin are ahead of
the chain; observability is behind it.

---

## 2. The milestones (plan §70), annotated

| Milestone | Plan scope | State |
|---|---|---|
| `BACKEND-01` Foundation | NestJS + Postgres + Redis + config + logging + health | **Done**, except queue/worker |
| `BACKEND-02` Identity | Auth + users + devices + sessions | **Done** |
| `BACKEND-03` Wallet metadata | Accounts and addresses without private keys | **Done** |
| `BACKEND-04` Blockchain Core | Chain registry + RPC manager + first EVM adapter | **Done**, and verified against live Sepolia |
| `BACKEND-05` Indexer | Addresses → events → transactions | **Balance sync only.** No events, no `Transaction` rows. |
| `BACKEND-06` Asset Engine | Crypto/token/metal registry | **Done**, minus a verification workflow |
| `BACKEND-07` Portfolio | Balances + pricing + allocation + history | **Valuation and snapshots.** No allocation, no history curve, no feed. |
| `BACKEND-08` Transaction Engine | Send/receive lifecycle + confirmation | **Not started** |
| `BACKEND-09` Swap Engine | Quotes + providers + execution + reconciliation | **Quote record only.** No rail, no execution. |
| `BACKEND-10` On/Off-ramp | Buy/sell crypto providers | **Refusal path only** |
| `BACKEND-11` Precious Metals | Gold/silver provider abstraction + buy/sell | **Redemption state machine only.** No provider, no buy, no sell. |
| `BACKEND-12` Compliance/Risk | KYC + AML + jurisdiction + risk | **Jurisdiction only** |
| `BACKEND-13` Admin Operations | Admin API + RBAC + dashboards + audit | **Ahead of plan.** Eleven route files, mutations, full audit. |
| `BACKEND-14` Analytics/Finance | Revenue + fees + volume + reconciliation | **Not started** |
| `BACKEND-15` Production Hardening | Security testing + performance + observability + DR | **CI only** |

**Six of fifteen milestones are complete.** A seventh (`BACKEND-13`) is ahead of
where the chain says it should be.

---

## 3. What the annotation says about the plan

Three things the plan gets wrong or has already been overtaken by, worth
recording because an agent following it literally will do wasted work.

### The plan's `BE-001 … BE-070` numbering does not survive contact

The plan names only ten task IDs (`BE-001`–`BE-004`, `SEC-001`, `AUTH-001`,
`USER-001`, `WALLET-001`, `CHAIN-001`, `BLOCKCHAIN-001`, `ASSET-001`). Sections
5 through 66 are thematic chapters, not tasks. **All ten named tasks are
already built**, under different names. See §1 of
[`BACKEND_TASKS.md`](BACKEND_TASKS.md).

An agent told to "start with BE-001" would rebuild the NestJS app.

### The dependency order under-weights the external dependencies

Plan §68 is a chain of *code*. Three of the four things actually blocking
progress are not code:

1. **The metals issuer/LP contract.** Blocks `BACKEND-09`, `BACKEND-11` and
   `BACKEND-14`. Multi-month lead time, not started.
2. **Legal counsel.** Entity structure, money-transmitter analysis, CFTC vs SEC.
   Required **before design freeze**, and design freeze is undated. It changes
   how the buy flow is built, which is `BACKEND-11`.
3. **A provider, for anything in `BACKEND-07` onward.** Pricing has no feed, so
   the portfolio cannot value anything. This is why `BACKEND-07` is
   structurally blocked even though its code exists.

**The honest reordering:** most of what remains is gated on the partnership and
on counsel, not on the next item in the chain. Work that can proceed
independently — defect clearance, `BACKEND-05` events, `BACKEND-13` remaining
pages, `BACKEND-15` hardening — is finite and small.

### The plan's task-tracking template needs `Status` values it does not define

Plan §67 lists `BACKLOG | READY | IN_PROGRESS | BLOCKED | REVIEW | TESTING |
DONE`. It has no value for **"exists but does not work"** or **"exists without a
test"**, which describes 20 of the 54 tasks in this repository. `PARTIAL` is
used throughout [`BACKEND_TASKS.md`](BACKEND_TASKS.md) for exactly that, and it
is not in the plan's list. Without it, honest status collapses into `DONE`,
which is how a tracker starts lying.

---

## 4. Recommended order from here

Not the plan's chain. The order that unblocks the most with the least
dependency on things that are not code.

### Phase A — Clear the defects (do this now)

`DEF-001` through `DEF-018`. No external dependency, no product decision, all
eighteen are bounded. Several are silent and will otherwise be found by a
customer.

**Seven are done** — `DEF-001`, `DEF-002` (`5a31c4b`), `DEF-003` (`7ad3d69`),
`DEF-016` (`50cb8a1`), `DEF-004` and `DEF-005` (`8c48624`), and `DEF-019`, found
while fixing those two. Twelve remain, and the time-sensitive one that ordered
this phase is closed: `prisma migrate diff` reports no difference, so running
`migrate dev` can no longer reintroduce the asset-registry uniqueness hole.

Order from here: `DEF-006`, then `DEF-014`, then the rest. See
`CURRENT_SPRINT.md` for why.

### Phase B — Make the existing surface testable

- `BE-1702` — controller-level tests. Fourteen routes have none outside the
  contract suite, and `DEF-001` exists **because** of that gap.
- `BE-102` — generate OpenAPI from `CONTRACT_REGISTRY`. The shipped document
  describes no request or response schemas at all.
- `BE-101` — **done**. The version lifecycle itself is now the thing to keep
  honest: the first `deprecated` version is the test of whether the
  announcement path works, and there is not one yet.
- `DEF-012` / contract coverage for `GET /portfolio*` and `POST /redemptions`.

### Phase C — Finish what needs no provider

- `BE-302` — the indexer's missing half: events to `Transaction` rows.
  This is the largest remaining piece of work that depends on nothing external.
- `BE-601` / `BE-602` — the transaction engine atop it.
- `BE-1504` — the remaining admin pages whose APIs exist.
- `BE-1101` / `BE-1105` — KYC and sanctions. **These do not need the metals
  partner**, and they are legally required before selling gold to consumers for
  dollars regardless of custody posture.

### Phase D — Provider work (gated)

`BE-802` and everything downstream. Starts when the contract is signed, not
before. Building an adapter against an imagined API produces an adapter that
gets rewritten.

### Phase E — Hardening

`BE-1601` analytics, `BE-1602` reconciliation, `BE-1603` incident runbooks.
Reconciliation is the one that matters most and cannot be built before
`BE-802`.

### Running in parallel from day one

- **The partnership.** It is the critical path and it is not this repository's
  work.
- **Counsel.** Required before design freeze, not before launch.

---

## 5. The shape of what remains

| Layer | Rough completion | Gated on |
|---|---|---|
| Foundation, identity, registry, admin | ~90% | Defect clearance only |
| Read paths (portfolio, pricing, chains, providers) | ~60% | A provider, for anything with a real number in it |
| Write paths that move money (swaps, metals, on-ramp) | **0%** | The partnership |
| Compliance obligations (KYC, AML, sanctions) | **0%** | Counsel, but not the partnership |
| Observability, analytics, reconciliation, DR | **~5%** | Nothing, and under-invested |

**The single most misleading thing about this repository is how complete it
looks.** Every module exists, every route is guarded, 140 tests are defined and
113 pass without a database, and nothing can move a dollar. That is by design —
the modules refuse rather than fabricate — but it means "the backend is
basically built" is false in the only sense that matters.
