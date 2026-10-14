# Admin visual rebuild — design spec

Date: 2026-10-14. Status: proposed, awaiting go-ahead for implementation.

## Outcome

The operations console keeps every route, every live data call, the role
gate, and the test suite, and gains a finished visual layer built from the
Nexora CRM template's theme, shell, and composite patterns, remapped onto
the Correnthian brand (obsidian surfaces, silver-neutral UI, gold reserved
for signalling a metal asset).

Success looks like: all 18 pages render in the new shell with no data
regression, `pnpm typecheck && pnpm test && pnpm build` green for
`@correnthian/admin`, the token mapping recorded in one place, and no new
framework in the dependency tree.

## Constraints (non-negotiable)

- Next.js 16 App Router stays. No TanStack Start, Router, or Vite enters
  `apps/admin`. The template is a parts donor, inspected statically from an
  isolated directory; nothing is installed or run from inside it.
- `lib/api-server`, `lib/roles`, `ApiState`, and `Contract<>` types are the
  only data path. Ported components receive data as props; none fetch.
- The dashboard layout's session gate stays first in the file. A reskin
  that moves or weakens it fails review regardless of how it looks.
- No Base UI dependency. The vendored Radix `ui/*` set stays canonical;
  template variants are adapted onto it per component.
- The API base moves to `/api/v1` during the rebuild (the unversioned
  alias is removed 2026-12-01).
- Template license must be confirmed to cover use in this product before
  its code enters the repo. Ported files get scanned by `check-secrets`.

## Decision: rebuild the current console, not replace it

Two options were weighed.

**A. Delete `apps/admin`, stand up the template, rewire 18 pages.**
Rejected. It discards the tested role gate, the server-only API layer,
the failure-state handling, and 21 tests, then re-earns all of them to
save styling effort. The template's shells are structural twins of what
exists (`SidebarProvider` + sidebar + inset + header + main under both),
so a replacement buys near-zero structure and pays full rewire cost.
Risk of a page shipping without its guard during rewire is the sharpest
edge.

**B. Rebuild the current console with the template's parts. Chosen.**
The shells match, Tailwind v4 matches on both sides, and Table, Recharts,
and dnd-kit are already dependencies, so tables, charts, and the pipeline
board port onto libraries already in the tree. Every phase below keeps
the suites green, so the console is never in a half-rewired state.

## Plan (execution order)

**Phase 1 — Theme.** Diff the template `globals.css` against the console's,
adopt any missing tokens (sidebar, chart series), then remap values onto
`packages/design-tokens` (obsidian, silver, gold-accent rules). One file
owns the mapping; ad-hoc values in layout and pages are replaced with
tokens. Verify: visual pass over dashboard + one table page, suites green.

**Phase 2 — Shell.** Port sidebar, header (search, notifications, user),
and page scaffold patterns onto `components/layout/*` behind the existing
names (`AdminSidebar`, `SiteHeader`). TanStack links become Next.js links
at the boundary. Verify: layout gate tests untouched and passing, all
routes render inside the new shell.

**Phase 3 — Composites, page by page.** Stat cards and charts (dashboard),
dense tables with sorting and pagination (users, transactions, quotes),
pipeline board (quotes/redemptions stark view if wanted), dialogs and
drawers for the action components. Data calls stay byte-identical; only
presentation changes. Verify per page: same endpoints, same empty and
error states, tests updated only where selectors changed.

**Phase 4 — Honest-state labels.** Notifications page marked queue-view
until a transport exists; verified-issuer states shown only where the
verification workflow (separate backend task) supports them.

## Non-goals

No new pages (risk, finance, sysconfig come with their backend surfaces),
no framework additions, no primitive-layer replacement, no marketing
landing page, no changes to API routes or contracts.

## Risks

- Brand mapping is a judgment call the template cannot make; gold
  overuse destroys its signalling value.
- Template composites may assume client-side data; each port must be
  checked for fetching logic smuggled in with the markup.
- Test selectors tied to old class names will need updating; that is
  expected churn, not breakage.
