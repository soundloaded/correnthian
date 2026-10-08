# Correnthian

Self-custodial platform for holding and buying **tokenized precious metals**.

> The product is trust and execution, not token support. Any wallet can list a
> gold token in an afternoon. What cannot be added to a token list is a
> verifiable answer to *what am I holding, who backs it, and can I take it out*.

**Design document:** [`docs/superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md`](docs/superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md)

---

## The key boundary

```
private key / seed ──► user device ──► local signing ──► signed tx ──► network
        │
        └─ never crosses to Correnthian's servers. Ever.
```

This is enforced structurally, not by convention: `packages/wallet-core` accepts
no HTTP client, no RPC endpoint and no provider SDK. If one is ever added to
that dependency graph, the architecture is no longer what the threat model
describes.

CI includes a guard that fails the build if key material appears in any
environment file.

---

## Repository

```
correnthian/
├── apps/
│   ├── marketing/       Next.js — public site
│   ├── web/             Next.js — web wallet + PWA
│   └── mobile/          React Native + Expo — Android and iOS, one codebase
├── services/
│   └── api/             NestJS — modular monolith
├── packages/            shared, build to dist/ (see Conventions)
│   ├── types/           domain types — asset identity, accounts, rails
│   ├── wallet-core/     keys, derivation, local signing  ← the boundary
│   ├── blockchain/      EVM / Bitcoin / Solana behind BlockchainAdapter
│   ├── assets/          asset + issuer registry, backing disclosure
│   ├── swaps/           SwapRail abstraction and quotes
│   ├── transactions/    models, simulation, state
│   ├── security/        redaction and policy
│   ├── integrations/    per-provider adapters
│   ├── api-client/      typed client for the API
│   ├── design-tokens/   colour, space, glass, motion
│   ├── ui/              design system
│   └── config/          runtime configuration
├── infrastructure/
└── docs/
```

`packages/*` compile to `dist/` with `tsc -p tsconfig.package.json` and expose
`dist/index.js` plus `dist/index.d.ts` through `exports`. They are shared, they
are built by `pnpm build`, and they are **not** handed to consumers as
TypeScript — see Conventions for why that distinction is load-bearing.

---

## Getting started

Requires **Node 22+** and **pnpm 10+**.

```bash
pnpm install
cp .env.example .env.local

pnpm dev          # run all apps
pnpm typecheck    # tsc across every workspace
pnpm build        # marketing, web, api
pnpm test         # vitest + Nest specs
```

| App | Command | Default port |
|---|---|---|
| Marketing | `pnpm --filter @correnthian/marketing dev` | 3000 |
| Web wallet | `pnpm --filter @correnthian/web dev` | 3001 |
| API | `pnpm --filter @correnthian/api start:dev` | 3000 |
| Mobile | `pnpm --filter @correnthian/mobile start` | — |

### API smoke test

```bash
pnpm --filter @correnthian/api build
node services/api/dist/main.js &

curl localhost:3000/health
curl localhost:3000/assets    # returns each asset with its disclosure string
```

`/assets` returns both an allocated gold token and a deliberately synthetic
lookalike, so the disclosure path is exercised rather than assumed:

```
PAXG -> Allocated; 1 troy oz per token; custodied by Brink's; vaults: London; last attested 2026-09-30.
XAU  -> Price exposure only. No physical metal is held for this token.
```

---

## Conventions

- **Explicit DI in Nest.** `@Inject(Service)` rather than relying on
  `emitDecoratorMetadata`. Nest's CLI uses `tsc`, which emits the metadata;
  vitest uses esbuild, which does not. Explicit injection behaves identically
  under both.
- **Metro is monorepo-aware.** `apps/mobile/metro.config.js` watches the
  workspace root so `@correnthian/*` resolve. Keep it committed.
- **No secrets in `.env*`.** That file holds Correnthian's own credentials only.

---

## Status

Foundation v0.1. Monorepo, four shells, the asset registry, the rail
abstraction, the key-boundary package and the design system tokens are in place.
No wallet is connected to real funds yet.

**Open, and blocking the launch path:** the metals issuer/LP partnership. It has
a multi-month lead time and is the project's critical path. See §3 of the design
document.
