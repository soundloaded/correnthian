# The admin

**Date:** 2026-10-05
**Status:** Not yet built. `apps/admin/` does not exist at the time of writing.
This document is the plan; the gotchas recorded here come from `TASK.md` P2 and
from work already done on the shadcn CLI.

Related: [engineering/api.md](api.md) (the endpoints this will be wired to) ·
[engineering/standards.md](standards.md) ·
[architecture/asset-registry.md](../architecture/asset-registry.md) (what the
asset pages must render) · [architecture/key-boundary.md](../architecture/key-boundary.md)

---

## Why shadcn/ui

**Because the components end up in our repository.**

`shadcn` is not a component library you depend on; it is a CLI that copies
component source into `components/ui`, where it is ours to edit. There is no
`node_modules/shadcn` to upgrade and no upstream roadmap to wait for.

That matters here specifically because this admin cannot use off-the-shelf
components unmodified. It needs:

- Trust-tier and custody-model indicators rendered from the registry's own
  vocabulary — `allocated` / `unallocated` / `synthetic` are not Material-UI
  concepts.
- The `describeBacking()` disclosure string displayed verbatim, in the same
  wording the customer sees. A generic "Description" field component that
  summarises or truncates it would defeat the entire point.
- Dense, scannable tables of backing data with attestation freshness visible.
- Status treatments that read as finance rather than as SaaS.

All of that means editing the component source. The copy-in model is the
feature.

**Related decision:** use the theme tokens, not ad-hoc values. Foundational
surfaces use `bg-background`, `text-muted-foreground`, `border-border`. Never
a raw hex on a foundational surface.

---

## Setup — the v4 CLI flow

`TASK.md` P2 records the required sequence:

```bash
npx shadcn@latest init -d            # or --preset; never bare init
npx shadcn@latest add dashboard-01
```

**CLI v4 removed `--style`, `--base-color`, `--src-dir` and `--css-variables`.**
Passing any of them fails. This is the most common way a v4 setup goes wrong,
and the error messages do not always make it obvious which flag is the problem.

**The unified `radix-ui` package.** New components depend on `radix-ui`, a
single package — **not** the older per-primitive `@radix-ui/react-*` packages.
Do not add `@radix-ui/react-dialog` or similar by hand; let the CLI write the
import.

---

## Gotchas

Both are recorded in `TASK.md` because both cost real time. Both are silent
failures — nothing errors, the thing is simply not there.

### 1. Tailwind v4 fonts resolve to nothing

After `init`, the generated `globals.css` contains a `@theme inline` block with:

```css
--font-sans: var(--font-sans);
```

This is a self-reference. Under Tailwind v4 it resolves to **nothing**, and
every `font-sans` utility silently becomes a no-op.

**Fix:** replace it with **literal** font names, e.g.

```css
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
```

Symptom if unfixed: text renders in the browser default and it looks like a CSS
cascade bug rather than a variable-resolution bug.

### 2. `Avatar` has no `size` prop

There is no `size` prop on the shadcn `Avatar`. Size comes from Tailwind
classes on the component — `size-8`, `size-10`, and so on. Passing `size={40}`
does nothing and, depending on the config, may be a type error or may be
inertly ignored.

---

## Dark-mode-first

The product direction is dark, and it is not incidental: the visual language is
**obsidian surfaces, silver-neutral UI, and a gold accent reserved for signalling
a metal asset**
([packages/design-tokens](../../packages/design-tokens/src/index.ts)).

The token source already exists and is committed. The admin's job is to map it
into the Tailwind v4 theme so shadcn's semantic utilities resolve to Correnthian
colours, not shadcn defaults.

**The gold rule that must survive into the admin:** gold is a *signal*, not a
brand wash. `#C9A227` marks a metal asset. If the whole interface is gold,
nothing is left to highlight with, and the highlight is the information.

Two consequences:

- The admin is **dark-first**. Light mode is a preference, not the default. Do
  not build light-first and invert later.
- State that matters in a trust context — verified vs unverified, allocated vs
  unallocated, attestation fresh vs stale — must **not** rely on colour alone.
  Pair it with text. Colour-blind operators and printed screenshots exist, and
  "red means unverified" is not a disclosure.

`packages/design-tokens` and `packages/ui` are both stubs beyond the token
values themselves (`packages/ui/src/index.ts` is `export {}`). The admin will
be the first real consumer of the design system, so whatever it invents here
becomes the pattern. Record decisions as they are made.

---

## Rewiring plan — replace every mock with real API data

### Status of the stub audit

`TASK.md` P2 requires examining every stubbed file and recording what is mock
data, and `CLAUDE.md`'s repository layout lists `apps/admin/` as an active app.

**At the time of writing, `apps/admin/` does not exist and neither does
`apps/admin/STUB-AUDIT.md`.** The plan below is therefore written from the
design spec rather than from an audit of real files.

**When the app lands, `apps/admin/STUB-AUDIT.md` becomes the authoritative
record of what is mocked.** This section should be reconciled against it, and
this paragraph updated, before anyone treats the rewiring as scoped. Do not
guess which files are stubs — read the audit.

### The rule

> **No mock data survives into a merged admin.**

Mocks are scaffolding for building layouts against nothing. They are not
fixtures. A page that renders `[{ id: 1, name: 'Acme Gold' }]` from a literal in
the component file is a page that lies to an operator, and the lie is
invisible — the operator has no reason to distrust a table.

### Plan

**Step 0 — audit.** For every file under `apps/admin/src`: list every mock,
note the API resource it stands in for, and record it in `STUB-AUDIT.md`.

**Step 1 — establish the data path before any page.** Typed client in
`@correnthian/api-client` (currently `export {}`), auth attached, error handling
in one place. Pages written before this exists will each invent their own, and
they will disagree.

**Step 2 — wire in dependency order,** following what the operator must be able
to do first:

| Page | Backed by | Notes |
|---|---|---|
| Auth + RBAC gate | P1.2 `admin`, RBAC guard | **First.** Nothing renders behind an ungated layout |
| Users, devices, sessions | P1.2 | Includes KYC status where applicable |
| Assets, issuers | P1.3 `assets` | Render the disclosure string **verbatim** |
| Chains | P1.3 `chains` | Per-chain enablement is the page's whole purpose |
| Providers | P1.3 `providers` | Health, sandbox/prod, **never credentials** |
| Transactions | `transactions` + `blockchain` | Hash, chain, provider, fees, errors |
| Quotes | P1.3 `swaps` | Surface `sizeCap` and `executionQuality` as first-class columns |
| Metals / redemption | P1.3 `metals` | Redemption states — see the open question in [api.md](api.md) |
| Compliance | P1.3 `compliance` | Jurisdiction restrictions, risk flags, screening |
| Audit | P1.3 `audit` | Immutable. Filter by actor and entity |

**Step 3 — delete the mocks.** Not disable, not feature-flag. Remove them, so
they cannot be re-enabled by accident.

**Step 4 — design the states.** Loading, empty, error, and partial-failure for
every page. "Designed — not placeholder text" per `TASK.md`. A page that only
works when data exists is a page whose failure mode is a blank screen an
operator cannot interpret.

### Rules for each page

1. **The disclosure string comes from the API and is rendered unmodified.**
   `GET /assets` already returns `disclosure` alongside each asset. Do not
   recompute, summarise, truncate or reformat it client-side. The whole point is
   that the operator sees exactly what the customer sees — a second
   implementation will drift, and it will drift in the direction that is easiest
   to get wrong.
2. **Never display asset identity by symbol.** Tables key on `assetId` /
   `AssetRef`. A symbol column is fine as a label; it must never be the key.
3. **Credentials are never rendered, not even masked.** The `providers` module
   owns them server-side. The admin shows provider *status*, not provider
   secrets.
4. **Every write is audited and attributed.** The admin is the surface where
   backing and trust data gets corrected; those corrections change what
   customers are told they own.
5. **Money displays as decimal strings, with the unit.** Operators will
   reconcile figures against a provider statement.
6. **Show degradation.** A provider that is degraded, an RPC endpoint that is
   failing, an attestation that has expired — surface it. An admin that renders
   only the happy path is a monitoring tool with a blind spot.
7. **No secret on the client.** No API keys, no service tokens, no private RPC
   URLs with embedded credentials. See
   [operations/overview.md](../operations/overview.md).

---

## Open questions

1. **The stub audit is pending.** `apps/admin/STUB-AUDIT.md` does not exist.
   Until it does, the rewiring scope above is inferred from the spec and may not
   match the files that get scaffolded.
2. **Server components or client?** Next.js App Router default is server-side
   fetching, which is the better fit for an authenticated internal surface
   (credentials stay on the server). But live provider-health and RPC status
   imply some client-side refresh. Which pages need real-time, and at what
   interval?
3. **Does the admin render `describeBacking()` output as a column, a drawer, or
   a dedicated detail view?** It is long text; in a dense table it needs a
   deliberate treatment, not a truncated cell.
4. **Feature flags.** The original admin scope included system feature flags,
   fee configuration and maintenance mode. None are in P2's page list. Are they
   v1, or dropped? Fee configuration in particular is a revenue control and
   needs an audit trail and probably an approval step.
5. **Who is an admin user, and how are they provisioned?** P1.2 has an "admin
   role / RBAC guard" but no provisioning story. Bootstrap problem.
6. **Does the admin show the same disclosure the customer sees, always?** If an
   asset's `Trust` tier is `issuer-verified`, does the customer see that word?
   Currently the registry can assert it about itself and no workflow backs it —
   see [architecture/asset-registry.md](../architecture/asset-registry.md). The
   admin is where that gap becomes visible and dangerous.
7. **Audit log retention and export.** Immutable inside the system is not the
   same as retained for the period a regulator might ask for, and there is no
   export path.
8. **`packages/ui` is empty.** The admin will be its first real consumer.
   Decide deliberately whether admin-only components graduate into the shared
   design system or stay local.