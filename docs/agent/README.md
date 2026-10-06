# docs/agent — the agent memory system

Development context for anyone — human or agent — working on Correnthian's
backend. Specified by plan §69.

Every document here was written by reading the repository, not by paraphrasing
a plan. Where a claim could not be verified it is marked **unverified** rather
than asserted. Where something does **not** exist, that is stated as plainly as
what does.

Baseline commit: `2be6499` (2026-10-06).

---

## Read order

The plan specifies this order, and it is the right one:

```
MASTER_CONTEXT  →  ARCHITECTURE  →  CURRENT_SPRINT  →  the task  →  DECISIONS
```

1. [`MASTER_CONTEXT.md`](MASTER_CONTEXT.md) — what Correnthian is, what it is
   not, the beachhead, technology, security rules, current phase. **Read first.**
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — how it fits together, with the
   key-boundary diagram and the layer-by-layer map.
3. [`CURRENT_SPRINT.md`](CURRENT_SPRINT.md) — what is being worked on now, and
   the explicit do-not-start list. **Read every time.**
4. [`BACKEND_TASKS.md`](BACKEND_TASKS.md) — the task tracker. Replaces the root
   `TASK.md`, which is now a pointer.
5. [`DECISIONS.md`](DECISIONS.md) — twenty ADRs, each naming the code that
   carries it.

## Reference

| Document | Answers |
|---|---|
| [`BACKEND_ROADMAP.md`](BACKEND_ROADMAP.md) | The dependency order from plan §68, annotated with what is done and what the plan got wrong |
| [`API_CONTRACTS.md`](API_CONTRACTS.md) | The `@correnthian/contracts` registry — and, more importantly, what is **not** covered |
| [`DATABASE.md`](DATABASE.md) | The Prisma schema, the security invariant, the two hand-written migrations |
| [`SECURITY_RULES.md`](SECURITY_RULES.md) | The key boundary, deny-by-default, jurisdiction, disclosure, fail-closed rate limiting |
| [`BLOCKCHAINS.md`](BLOCKCHAINS.md) | `BlockchainAdapter`, the EVM implementation, RPC failover, what is not supported |
| [`PROVIDERS.md`](PROVIDERS.md) | The provider registry, health, and why nothing is contracted |
| [`ADMIN_OPS.md`](ADMIN_OPS.md) | The console, its pages, the role model |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | shadcn `radix-nova`, token rules, component conventions |
| [`CHANGELOG.md`](CHANGELOG.md) | Significant entries reconstructed from git history |

## Also worth reading

These predate this directory and are not superseded by it:

- [`../../CLAUDE.md`](../../CLAUDE.md) — the working rules for this repository.
  Not restated here.
- [`../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md`](../superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md)
  — the product decision record. The source of truth for *why the product is
  this shape*.
- [`../architecture/key-boundary.md`](../architecture/key-boundary.md) — the
  long treatment of the security boundary, including nine ways to break it.
- [`../product/vision.md`](../product/vision.md),
  [`../compliance/overview.md`](../compliance/overview.md),
  [`../operations/overview.md`](../operations/overview.md).

## Stale documents

These state the opposite of the code. They are tracked as `DEF-014` in
[`BACKEND_TASKS.md`](BACKEND_TASKS.md), and an agent should not act on them:

- `../engineering/api.md` — says every domain module is unbuilt. All of them are
  built.
- `../engineering/standards.md` and `../../README.md` — say `packages/*` are
  "source-only, no build step". They build to `dist/`.
- `../engineering/admin.md` — says `apps/admin/` does not exist.
- `../README.md` — lists `product/beachhead.md` and `docs/runbooks/`, neither of
  which exists.
- `../../TASK.md` — now a pointer to
  [`BACKEND_TASKS.md`](BACKEND_TASKS.md). Its old content is superseded and its
  `apps/admin/STUB-AUDIT.md` link was broken; that file is at
  `archive/admin-legacy/STUB-AUDIT.md`.

## Keeping this current

Update these in the **same commit** as the code they describe:

- A task's status change → `BACKEND_TASKS.md` and `CURRENT_SPRINT.md`.
- A new architecture decision → `DECISIONS.md`, with an ADR number that does not
  collide.
- A new response contract → `API_CONTRACTS.md`.
- A schema or migration change → `DATABASE.md`.
- Anything significant → `CHANGELOG.md`.

A document that drifts from reality is worse than no document, because an agent
will trust it. If you find a claim here that contradicts the code, **the code is
right** — fix the document in the same commit.