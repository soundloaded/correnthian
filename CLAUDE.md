# CLAUDE.md — Correnthian

Guidance for Claude Code and any agent working in this repository.

---

## What this project is

Correnthian is a **self-custodial platform for holding and buying tokenized
precious metals**. Users hold gold and silver, buy with a card or bank
account, and the metal is delivered to an account only they can move.

Correnthian does **not** issue the tokens, does **not** hold user assets, and
does **not** take principal risk. It earns stated, itemised fees.

> **The product is trust and execution, not token support.**
> Any wallet can list a gold token in an afternoon. What cannot be added to a
> token list is a verifiable answer to *what am I holding, who backs it, and
> can I take it out*.

**Beachhead:** the gold-owning non-crypto buyer — someone who wants gold
exposure but refuses to hand custody to a broker. That refusal is the wedge.

Full rationale and decision record:
[`docs/superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md`](docs/superpowers/specs/2026-10-05-correnthian-v1-architecture-design.md)

---

## THE KEY BOUNDARY — never violate

```
private key / seed ──► user device ──► local signing ──► signed tx ──► network
        │
        └─ never crosses to Correnthian's servers. Ever.
```

**Enforced structurally:** `packages/wallet-core` accepts no HTTP client, no
RPC endpoint, and no provider SDK. If one is ever added to that package's
dependency graph, the boundary is broken and the architecture is no longer what
the threat model describes.

Rules that follow:

- The Correnthian **Account** (server-side profile, devices, preferences) is a
  different thing from **wallet ownership**. Compromising an account must never
  yield funds.
- There are two account *kinds*: `SmartAccount` (EVM, passkey-signed) and
  `SeedAccount` (Bitcoin/Solana only). Do not merge them.
- Correnthian holds **no** recovery key material. Recovery is on-chain
  guardians.
- No key material in any `.env*` file. CI enforces this.
- Use `@correnthian/security`'s `redactDeep()` for anything that gets logged.

---

## Repository layout

```
correnthian/
├── apps/
│   ├── marketing/       Next.js — public site          (later)
│   ├── web/             Next.js — web wallet + PWA     (later)
│   ├── mobile/          Expo — Android + iOS           (later)
│   └── admin/           Next.js + shadcn/ui            ← active
├── services/
│   └── api/             NestJS — modular monolith      ← active, priority
├── packages/            source-only; no build step
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

---

## Build priority

1. **API** — the heaviest investment. Domain modules, data layer, auth.
2. **Admin** — shadcn/ui, wired to real API data (not mocks).
3. Marketing, user-facing web wallet, and mobile come later.

---

## Commands

Requires **Node 22+** and **pnpm 10+**.

```bash
pnpm install
pnpm dev            # all apps
pnpm typecheck      # tsc across every workspace
pnpm build          # only apps build; packages are source-only
pnpm test           # vitest + Nest specs
```

Single workspace:

```bash
pnpm --filter @correnthian/api start:dev
pnpm --filter @correnthian/api test
pnpm --filter @correnthian/admin dev
```

---

## Conventions

**`packages/*` are source-only.** They export TypeScript directly from `src/`
and have **no `build` script**. Only `apps/*` and `services/*` compile. Do not
add a build step to a package without a stated reason.

**Explicit DI in Nest.** Use `@Inject(Service)`, never constructor
parameter types alone. Nest's CLI uses `tsc`, which emits decorator metadata;
vitest uses esbuild, which does not. Explicit injection behaves identically
under both. This bug shipped broken in Nest's own scaffold.

**Metro is monorepo-aware.** `apps/mobile/metro.config.js` watches the
workspace root so `@correnthian/*` resolve. Keep it committed.

**Tokens, not raw values.** Use shadcn theme tokens (`bg-background`,
`text-muted-foreground`, `border-border`) in the admin. Never ad-hoc hex for
foundational surfaces.

**Commits.** Small, purposeful commits with a real message explaining *why*.
End commit messages with the attribution line required by the harness.

---

## Active work

Tracked in [`TASK.md`](TASK.md). Read it before starting anything, and update
it when you finish something.
