# Correnthian — Task Tracker

**This file is a pointer. It is not a source of truth.**

The tracker moved to [`docs/agent/`](docs/agent/) on 2026-10-06, so that one
document answers "what is built, what is half built, and what does not exist"
instead of two that disagree.

| You want | Read |
|---|---|
| What to work on now, and what not to start | [`docs/agent/CURRENT_SPRINT.md`](docs/agent/CURRENT_SPRINT.md) |
| Every task, with honest status | [`docs/agent/BACKEND_TASKS.md`](docs/agent/BACKEND_TASKS.md) |
| Why the architecture is this shape | [`docs/agent/DECISIONS.md`](docs/agent/DECISIONS.md) |
| The order of remaining work | [`docs/agent/BACKEND_ROADMAP.md`](docs/agent/BACKEND_ROADMAP.md) |
| What is already built, layer by layer | [`docs/agent/ARCHITECTURE.md`](docs/agent/ARCHITECTURE.md) |
| What Correnthian is and is not | [`docs/agent/MASTER_CONTEXT.md`](docs/agent/MASTER_CONTEXT.md) |
| Everything else | [`docs/agent/README.md`](docs/agent/README.md) |

---

## Why this was folded in

The old `TASK.md` was a hand-maintained checklist with `[ ]`, `[~]` and `[x]`
marks. Three things made it unreliable:

1. **It had no `PARTIAL`.** A module that exists, is guarded, and refuses to do
   anything because no provider is contracted is neither `[ ]` nor `[x]`. The
   old file marked `swaps` as `[~]` and `metals` as `[x]`, and both describe
   their state inaccurately.
2. **It drifted.** It said the Prisma schema has "18 models, 15 enums"; it has
   19 and 19. It linked to `apps/admin/STUB-AUDIT.md`, which moved to
   `archive/admin-legacy/` in the shadcn re-scaffold. It said the API integration
   test harness was both done (P1.1) and not done (P1.4).
3. **It duplicated what the plan already specified** as `docs/agent/`, so the
   repository had two places to look and no rule about which won.

Its content is superseded, not deleted — the blockers, the shadcn gotchas and
the done log all live on in `docs/agent/`.

---

## Carried forward from the old tracker

These were the open items. Each is now a tracked task; none was dropped.

| Old entry | Now |
|---|---|
| Metals issuer / LP partnership — critical path | `BE-802`, and the blocker table in `BACKEND_TASKS.md` §20 |
| Legal counsel — required before design freeze | Same blocker table |
| Seed account recovery | `BE-203b` |
| Design freeze date undated | Same blocker table |
| `verifiedTier` has no verification workflow | `BE-401` |
| Provider due diligence unverified | Same blocker table |
| Magic-link / passwordless auth | `BE-203` |
| `swaps` rail binding awaits a contracted provider | `BE-701`, `BE-702` |
| `pricing` — spot vs executable | `BE-502` |
| `admin` — internal operations surface | `BE-1501`, `BE-1504` |
| OpenAPI docs | `BE-102` |
| Integration test harness against real Postgres/Redis | `BE-1702` (the harness exists; the coverage does not) |
| Admin auth + RBAC gate | `DEF-016` — **done** in `50cb8a1` |
| Admin pages: transactions, compliance, metals, finance | `BE-1504` |
| Marketing site, web wallet, mobile | Out of scope — see `CURRENT_SPRINT.md` do-not-start |

## New, found by the 2026-10-06 audit

Eighteen defects, `DEF-001` through `DEF-018`. **Four are done** — `DEF-001`
and `DEF-002` (`5a31c4b`), `DEF-003` (`7ad3d69`) and `DEF-016` (`50cb8a1`) —
and **fourteen remain open**. Start with `DEF-004` / `DEF-005`: the rate
limiter's configuration and its keying are both inert, in one file.

`DEF-003` was the urgent one and is closed; `prisma migrate diff` reports no
difference between schema and database.

---

## The rule the old file stated, kept

> Read it before starting work. If you start something, mark it so parallel
> workers do not duplicate it. Add new tasks as they are discovered — do not let
> work happen that is not tracked.

That rule still holds. It now applies to
[`docs/agent/BACKEND_TASKS.md`](docs/agent/BACKEND_TASKS.md), and every task
there carries the plan's §67 fields: ID, Description, Dependencies, Inputs,
Expected output, Acceptance criteria, Security requirements, Tests, Status.

**One logical task at a time**, unless tasks are genuinely independent.
