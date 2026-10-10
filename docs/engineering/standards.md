# Engineering standards

**Date:** 2026-10-05
**Status:** Enforced by CI where marked. Read before writing code.

Related: [engineering/api.md](api.md) ·
[architecture/key-boundary.md](../architecture/key-boundary.md) ·
[CLAUDE.md](../../CLAUDE.md)

---

## 1. `packages/*` build to `dist/`

Every package under `packages/` compiles with `tsc -p tsconfig.package.json` and
exposes the result:

```json
"main":    "./dist/index.js",
"types":   "./dist/index.d.ts",
"exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
"scripts": { "build": "tsc -p tsconfig.package.json", "typecheck": "tsc --noEmit" }
```

`pnpm build` runs them, and `turbo.json` gives `lint`, `typecheck` and `test` a
`dependsOn: ["^build"]`, so a consumer never resolves a package that is behind
its own source.

**Why, and why this is not cosmetic.** `services/api` is a tsc-emitting Node
service. Node cannot execute `main: "./src/index.ts"`, and a package that only
works under a bundler looks fine until the one consumer that is *not* a bundler
loads it. The failure is deferred and confusing: a single-file package loads
fine, so the problem appears only once a package gains a second file and the
relative specifier needs its `.js` extension resolved against real output.
Recorded as [ADR-006](../agent/DECISIONS.md).

> **This document previously said the opposite.** It recommended shipping
> TypeScript directly and called a compiled package a staleness hazard. That
> was corrected in `standards.md` after `services/api` failed to load a package
> that worked everywhere else. The rules below about extensions and `import
> type` are unchanged — they were always about the Node consumer.

**Rules that follow.**

- **Relative imports carry their `.js` extension** (`from './index.js'`, not
  `from './index'`). `services/api` compiles with `"module": "nodenext"`, which
  requires it, and the packages use it so one specifier works under both
  configurations.
- **Type-only imports use `import type`.** `verbatimModuleSyntax` is on, so a
  value import of a type-only symbol is a build error rather than a warning.
  This is why [packages/types/src/asset.ts](../../packages/types/src/asset.ts)
  is imported with `import type { ... } from '@correnthian/types'` throughout.
- **Never hand-edit `dist/`.** It is generated output and is gitignored; a
  change there is a change that evaporates on the next build.
- **Adding a `build` script is not an architectural decision any more** — every
  package has one. Adding a *different* build mechanism (a bundler, a codegen
  step, a prepack hook) still is, and it belongs in an ADR.

---

## 2. Explicit DI in Nest — and why

```ts
// Correct. Identical behaviour under tsc and under esbuild.
constructor(@Inject(AssetsService) private readonly assetsService: AssetsService) {}
```

**Never rely on `emitDecoratorMetadata` alone.** Do not write a constructor
that declares a provider type and hopes Nest can infer the token.

**Why, precisely:**

| | `tsc` | `esbuild` |
|---|---|---|
| Used by | `nest build` / `nest start` (`nest-cli.json`) | `vitest` (via `vite`) |
| `emitDecoratorMetadata` | **Yes** — emits `design:paramtypes` | **No** — strips types, no metadata emitted |

So a provider injected by constructor type works when the app runs and fails
under test, or the reverse, depending on which path executed first. Explicit
`@Inject()` behaves identically under both because it does not depend on emitted
metadata at all.

**This bug shipped broken in Nest's own scaffold** — the scaffolded
`app.controller.spec.ts` failed on arrival and had to be fixed before anything
else could be tested. It is recorded in `TASK.md`'s done log. Treat this rule as
load-bearing, not stylistic.

The comment explaining it is in
[services/api/src/assets/assets.controller.ts](../../services/api/src/assets/assets.controller.ts).
Leave it there. If you ever remove the convention, remove the reason with it.

---

## 3. Naming and vocabulary

**Files.** `kebab-case` within a feature directory; Nest suffixes are fixed:
`*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.spec.ts`,
`*.e2e-spec.ts`. Package tests live in `src/__tests__/*.test.ts` (vitest's
`__tests__` convention); Nest service tests are co-located `*.spec.ts`.

**TypeScript identifiers.** `PascalCase` for types, interfaces and classes;
`camelCase` for variables, functions and methods; `SCREAMING_SNAKE_CASE` for
module-level constant regexes (`packages/security`). Exported constant tables
are `PascalCase` object literals with `as const` (`color`, `space`, `glass`,
`motion` in `packages/design-tokens`).

**Domain vocabulary.** These words have precise meanings. Using them loosely is
how the security bug in [architecture/key-boundary.md](../architecture/key-boundary.md)
gets introduced:

| Term | Means | Never means |
|---|---|---|
| **Correnthian Account** | Server-side profile. No key material. | Anything that can sign |
| **Key Container** | Device-side. Never serialised to a transport. | An account record |
| **SmartAccount** | EVM, passkey-signed, guardians | A generic crypto account |
| **SeedAccount** | BTC/SOL, BIP-39 | A backup of a SmartAccount |
| **Asset** | The `(chain, contract, issuer)` triple | A symbol, a ticker, a contract |
| **AssetRef** | The minimum triple needed to name one | An `assetId` string |
| **Rail** | A way to execute a conversion, by capability | A specific vendor |
| **Backing** | What metal, if any, stands behind a token | A trust score |
| **Disclosure** | The user-facing `describeBacking()` sentence | Something the UI composes |

**Money and rates.**

- Token amounts and USD notionals are **decimal strings**. Never `number`. See
  `QuoteRequest.fromAmount`.
- Rates are **basis points**, integers (`priceImpactBps`, `slippageBps`).
- Comparisons on money-adjacent values must go through a single shared helper so
  two implementations cannot disagree about rounding.

---

## 4. Error handling

**Domain errors are typed classes with `name` set.** The two existing examples
are the pattern:

```ts
export class UnsupportedRailError extends Error {
  constructor(public readonly railId: string) {
    super(`Rail "${railId}" does not support the requested pair`);
    this.name = 'UnsupportedRailError';
  }
}
```

- Extends `Error`, sets `name`, carries structured data as properties.
- Thrown for **domain** conditions a caller can reasonably handle.
- Not thrown for programming errors — a `TypeError` from a bad argument stays a
  `TypeError`.

**Never leak internals across a trust boundary.** An error message that reaches
a user must not contain a provider response body, a stack trace, a contract
address the user did not supply, or an internal identifier. The API's error
taxonomy is where this is enforced — see
[engineering/api.md](api.md); it is **planned, not built**.

**Do not `catch` and continue silently.** A swallowed exception in a financial
path is an unreconciled balance. If something is genuinely best-effort (a
non-critical enrichment), say so in a comment and make the failure observable.

---

## 5. Testing standards

**Runner:** vitest throughout, for both `packages/*` (`test: vitest run
--passWithNoTests`) and `services/api` (`test: vitest run`, plus `test:e2e`).
CI runs `pnpm test` at the root. There is no separate e2e harness yet — P1.4.

**What currently has tests** (two files, and they are the right two):

- [packages/security/src/__tests__/redact.test.ts](../../packages/security/src/__tests__/redact.test.ts)
- [packages/assets/src/__tests__/registry.test.ts](../../packages/assets/src/__tests__/registry.test.ts)

**What must have tests.** These are not optional:

| Subject | Why |
|---|---|
| Key-boundary invariants | See the checklist in [key-boundary.md](../architecture/key-boundary.md) |
| Asset identity derivation | Getting this wrong loses user funds across chains |
| `describeBacking()` disclosure | Rendering a synthetic token as metal is the product's worst failure |
| Redaction | It is the last line of defence before a log sink |
| Fee arithmetic | Fees are the revenue and the trust claim |
| Quote `sizeCap` / `executionQuality` | See [architecture/rails.md](../architecture/rails.md) |
| Jurisdiction eligibility | Default-deny logic must be provable |

**Fixture rules.**

- Fixtures must exercise the bad cases. The seed registry deliberately includes
  a synthetic lookalike so the disclosure path runs rather than being assumed.
  Keep that property in any new fixture.
- **Fixtures must not carry unverified real-world claims.**
  `services/api/src/assets/seed-registry.ts` contains specific custodian, vault
  and attestation values that are placeholders, not facts. See
  [asset-registry.md](../architecture/asset-registry.md).
- Never mock `wallet-core`. There are no keys to mock and doing so would
  normalise a boundary violation in a test.

**The mock-data rule extends to the front end.** Admin mocks are scaffolding,
not a fixture. See [engineering/admin.md](admin.md).

---

## 6. The secret-redaction rule

**Nothing secret ever becomes an ordinary string.** That is the stated goal of
[packages/security](../../packages/security/src/index.ts) and it is the rule to
follow.

- Use `redactDeep()` on **anything that gets logged** — arguments, responses,
  error objects, request bodies.
- Use `log.info` / `log.warn` / `log.error` from `@correnthian/security` rather
  than `console.*` in server code. They wrap `console` and apply `redactDeep()`
  for you.
- Redaction is **defence in depth, not a substitute for not having the value**.
  The primary control is that key material never reaches a server in the first
  place — [architecture/key-boundary.md](../architecture/key-boundary.md). The
  redaction exists so that a mistake elsewhere is survivable.
- **A signature is not key material and will not be redacted.** A logged signed
  transaction is a replayable authorisation while its nonce is unconsumed.
  Do not log signed payloads. This is called out in the key-boundary document
  because the redaction layer gives false confidence here.

**What `redact()` catches:** BIP-39-style mnemonics (11–23 lowercase words),
32-byte hex keys, and `bc1…` Bitcoin addresses. `redactDeep()` additionally
replaces any object field whose *name* matches `seed|mnemonic|privatekey|secret|password|passphrase`,
recursively, regardless of value shape.

**CI guard.** The `secret-scan` job greps `*.env*` files for
Assignments to `PRIVATE_KEY`, `MNEMONIC` or `SEED_PHRASE`. Be precise about what it does and does not
do:

- **Does:** fail the build if key material is committed to an environment file.
- **Does not:** scan source code, scan CI logs, or check `wallet-core`'s
  dependency graph. Its job name — "Key-boundary guard" — overstates it. The
  actual boundary guard does not exist yet; see
  [key-boundary.md](../architecture/key-boundary.md).

**No key material in any `.env*` file. Ever.** `.env.example` states the rule
at the top of the file: it contains Correnthian's *own* secrets only, and
anything that could move user funds belongs on the user's device.

---

## 7. TypeScript

Root `tsconfig.json` is strict, and stricter than a default:

```jsonc
"strict": true,
"noUncheckedIndexedAccess": true,   // arr[i] is T | undefined
"noImplicitOverride": true,
"verbatimModuleSyntax": true,      // import type is mandatory
"isolatedModules": true,
"target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler"
```

`services/api/tsconfig.json` is a separate config with `"module": "nodenext"`
(needed for the `.js` extension rule) and `"strictPropertyInitialization": false`
(Nest's requirement). Node 22+ and ES2023 there.

**Known inconsistency — flag it, do not work around it silently.** The two
TypeScript configurations do not match:

| | `noUncheckedIndexedAccess` | TypeScript version |
|---|---|---|
| Root + `packages/*` | **on** | resolves to root's `^5.7.2` |
| `services/api` | **off** | pins `^6.0.2` |
| `apps/mobile` | — | pins `~6.0.3` |
| `apps/marketing`, `apps/web` | — | pin `^5` |

So shared packages are typechecked under a *different major* than the service
that consumes them, and the service — the highest-value code in the repository —
is held to a weaker indexed-access guarantee than the packages it depends on.
This is not currently causing a visible failure, and it is exactly the kind of
thing that produces "typechecks locally, fails in CI". **Decide one major and
one baseline and apply them everywhere.** Tracked in *Open questions*.

---

## 8. Commits

Small, purposeful, with a real message explaining **why**. The existing history
is the reference: `Add CLAUDE.md, TASK.md and documentation structure` followed
a body of four or five bullet points covering what each artefact is for and the
reason it exists — not a restatement of the diff.

Rules:

- One logical change per commit. Refactors are separate commits from behaviour
  changes, even in the same file.
- The body explains reasoning and consequences. "Fixes a bug" is not a message.
- End every commit message with the attribution line required by the harness:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Do not commit `.env*`, `dist/`, `.next/`, `coverage/` or `*.tsbuildinfo` —
  all gitignored.

---

## Open questions

1. **One TypeScript version, one strictness baseline.** Currently the repo has
   TypeScript 5 and 6 side by side, and `services/api` runs without
   `noUncheckedIndexedAccess`. Needs a decision and a sweep.
2. **Two vitest majors.** `packages/*` run `vitest ^2.1.8` (from the root);
   `services/api` runs `vitest ^4.1.2` with `vite ^7.1.0`. `TASK.md` records
   that Nest 12 shipped vitest 4 against a hoisted vite 5 and that it was fixed
   locally — by pinning vite 7 in the API workspace. Two test runners means two
   behaviours and two sets of gotchas. Reconcile deliberately.
3. **No lint story yet.** `oxlint` is configured in `services/api`
   (`.oxlintrc.json`) but there is no root lint configuration and packages have
   no `lint` script, so `pnpm lint` covers almost nothing.
4. **No formatter baseline beyond Prettier defaults.** There is a root
   `format` script and a `.prettierrc` in `services/api`. Whether packages and
   apps share one config is undecided — a mismatch here produces a first
   commit that reformats the world.
5. **Integration test harness.** P1.4 lists it as planned. Until it exists,
   nothing verifies the API against a real Postgres or Redis, and unit tests
   over mocks will be the only signal.
6. **Where does the shared Zod schema live?** P1.4 requires validation on every
   route, and the repo wants a typed `api-client`. If schemas live in
   `services/api`, the client package cannot import them without depending on a
   service. If they live in `packages/types`, the service depends on them for
   runtime behaviour. Needs a call before either is built.