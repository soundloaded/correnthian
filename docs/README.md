# Correnthian documentation

## Start here

**Working on the backend? Start at [agent/README.md](agent/README.md).** That
directory is the source of truth for what is built, what is half built and what
does not exist. It supersedes [TASK.md](../TASK.md).

| If you want to… | Read |
|---|---|
| Work on the backend at all | **[agent/MASTER_CONTEXT.md](agent/MASTER_CONTEXT.md)**, then [agent/CURRENT_SPRINT.md](agent/CURRENT_SPRINT.md) |
| Know what is built vs planned | [agent/BACKEND_TASKS.md](agent/BACKEND_TASKS.md) |
| Understand what this product is and why | [product/vision.md](product/vision.md) |
| Know who we're building for | `product/beachhead.md` — *not yet written* |
| See the full decision record | [superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md](superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md) |
| Understand the key boundary | [architecture/key-boundary.md](architecture/key-boundary.md) |
| Know what an asset is and what backs it | [architecture/asset-registry.md](architecture/asset-registry.md) |
| Know how a conversion actually executes | [architecture/rails.md](architecture/rails.md) |
| Work on the API | [engineering/api.md](engineering/api.md) |
| Work on the admin | [engineering/admin.md](engineering/admin.md) |
| Write code at all | [engineering/standards.md](engineering/standards.md) |
| Understand the regulatory position | [compliance/overview.md](compliance/overview.md) |
| Run, monitor and support the platform | [operations/overview.md](operations/overview.md) |

*Last reviewed 2026-10-06. `product/beachhead.md` and `docs/runbooks/` are
listed but not yet written.*

**Note on the engineering documents.** `engineering/api.md`,
`engineering/admin.md` and `engineering/standards.md` were written before the
code they describe and now carry superseded status claims. Each has a banner at
the top stating what is wrong. For current status, always use `agent/`.

## Layout

```
docs/
├── agent/            what is actually built — the agent memory system
├── architecture/     how the system is put together, and why
├── product/          what we build, for whom, and the strategy behind it
├── engineering/      how to write code here — standards, API, admin
├── compliance/       regulatory posture and the jurisdiction engine
├── operations/       running, monitoring and supporting the platform
├── runbooks/         step-by-step procedures  *(directory not yet created)*
├── specs/            design documents and decision records
└── archive/          superseded material, kept for provenance
```

## Ground rules for these docs

1. **Record decisions, not narration.** If a choice was reversed, say what it
   was, why it changed, and when. The DEX→provider rail reversal is the
   worked example.
2. **Link, don't duplicate.** The spec is the source of truth for decisions;
   these docs explain how to work with them.
3. **Date everything.** Undated guidance rots silently.
4. **Say what is not decided.** An empty section labelled "open" is more useful
   than confident prose covering a gap.
