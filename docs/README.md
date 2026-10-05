# Correnthian documentation

## Start here

| If you want to… | Read |
|---|---|
| Understand what this product is and why | [product/vision.md](product/vision.md) |
| Know who we're building for | [product/beachhead.md](product/beachhead.md) |
| See the full decision record | [superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md](superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md) |
| Understand the key boundary | [architecture/key-boundary.md](architecture/key-boundary.md) |
| Know what an asset is and what backs it | [architecture/asset-registry.md](architecture/asset-registry.md) |
| Know how a conversion actually executes | [architecture/rails.md](architecture/rails.md) |
| Work on the API | [engineering/api.md](engineering/api.md) |
| Work on the admin | [engineering/admin.md](engineering/admin.md) |
| Write code at all | [engineering/standards.md](engineering/standards.md) |
| Understand the regulatory position | [compliance/overview.md](compliance/overview.md) |
| Run, monitor and support the platform | [operations/overview.md](operations/overview.md) |

*Last reviewed 2026-10-05. `product/beachhead.md` and `docs/runbooks/` are
listed but not yet written.*

## Layout

```
docs/
├── architecture/     how the system is put together, and why
├── product/          what we build, for whom, and the strategy behind it
├── engineering/      how to write code here — standards, API, admin
├── compliance/       regulatory posture and the jurisdiction engine
├── operations/       running, monitoring and supporting the platform
├── runbooks/         step-by-step procedures for specific incidents/tasks
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
