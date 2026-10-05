# STUB-AUDIT — `apps/admin`

Written immediately after `create-next-app` + `shadcn init` + `shadcn add dashboard-01`,
**before** any rewiring. This file is the contract for the next task.

Nothing in `apps/admin` is connected to `services/api`. Every number, name, table row,
and chart point on the dashboard is fake and hardcoded.

---

## 1. What was run

```bash
# app shell
npx create-next-app@latest apps/admin \
  --ts --tailwind --eslint --app --src-dir --import-alias "@/*" \
  --use-pnpm --skip-install --disable-git --yes

# shadcn (CLI v4.21.1)
npx shadcn@latest init --preset nova --base radix -y --no-monorepo
npx shadcn@latest add dashboard-01 -y
```

- `dashboard-01` resolved directly from the default `@v0` registry. **No substitution.**
- `components.json` result: `"style": "radix-nova"`, `baseColor: neutral`, `iconLibrary: lucide`.
- Preset `nova` = *Lucide / Geist*, neutral base, default radius. Chosen over the other
  seven (`vega`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`) because the CLI's own
  default (`-d` ⇒ `--preset=base-nova`) and the shadcn skill's admin guidance both point
  at neutral base + Lucide + Geist.

---

## 2. Route structure created

| Route | File | Status |
|---|---|---|
| `/` | `src/app/page.tsx` | **Untouched create-next-app boilerplate.** Still renders the Next.js/Vercel starter with `next.svg`/`vercel.svg`. Not part of the block; it was never overwritten. |
| `/dashboard` | `src/app/dashboard/page.tsx` | The block. Server component. |
| `/_not-found` | — | Next.js default. |

`/dashboard` is a **static** route (`○ (Static)` in the build output). There is no
`loading.tsx`, no `error.tsx`, no `not-found.tsx`, and no route group. The sidebar/header
shell is built **inside** the page rather than in a shared layout, so every future admin
page has to re-mount `SidebarProvider` + `AppSidebar` + `SiteHeader` by hand unless a
`(admin)` layout group is introduced in the rewiring task.

---

## 3. File-by-file inventory

### 3.1 App shell (create-next-app / shadcn init)

| Path | Role | Mock? |
|---|---|---|
| `src/app/layout.tsx` | Root layout. Geist + Geist_Mono via `next/font/google`. **Edited after init** — see §5. | No data. |
| `src/app/globals.css` | shadcn theme tokens, `:root` + `.dark` oklch palettes, `@theme inline`. **Edited after init** — see §5. | No data. |
| `src/lib/utils.ts` | `export { cn } from "cn"` — CLI v4 uses the `cn` npm package, not `clsx` + `tailwind-merge`. | No. |
| `components.json` | shadcn config. | No. |
| `src/app/page.tsx` | create-next-app starter. | Cosmetic boilerplate only. |

### 3.2 Block: shell components

| Path | Role | Needs API? |
|---|---|---|
| `src/app/dashboard/page.tsx` | Composes `SidebarProvider` → `AppSidebar` + `SiteHeader` + `SectionCards` + `ChartAreaInteractive` + `DataTable`. **Server component.** Imports `data.json` and passes it to `DataTable`. | **Yes** — this is the single data entry point today. |
| `src/components/app-sidebar.tsx` | Client. Renders sidebar, holds the entire nav model. | **Yes** — `data.user` must come from the session. |
| `src/components/site-header.tsx` | Server component (no `"use client"`). Sticky header, `SidebarTrigger` + separator + `<h1>`. | Mostly static UI. |
| `src/components/nav-main.tsx` | Client. Primary nav list + "Quick Create" / inbox buttons. | Static UI; consumes items prop. |
| `src/components/nav-documents.tsx` | Client. Documents group with per-item dropdown (Open/Share/Delete). | Static UI; consumes items prop. |
| `src/components/nav-secondary.tsx` | Client. Footer nav group. | Static UI. |
| `src/components/nav-user.tsx` | Client. Avatar + account dropdown (Account/Billing/Notifications/Log out). | **Yes** — user identity + real sign-out. |
| `src/components/section-cards.tsx` | Client. Four KPI cards. | **Yes, entirely.** |
| `src/components/chart-area-interactive.tsx` | Client. Recharts stacked area chart + 90d/30d/7d range control. | **Yes, entirely.** |
| `src/components/data-table.tsx` | Client. TanStack Table v9 + dnd-kit drag reorder + row drawer + view tabs. | **Yes, entirely.** |
| `src/hooks/use-mobile.ts` | `useIsMobile()`. **Edited after install** — see §5. | No. |

### 3.3 Block: static shadcn primitives (`src/components/ui/`)

All 19 are stock `radix-nova` source with **no mock data** — they are the reusable design
system and should be left alone (or only restyled) by the rewiring task:

`avatar`, `badge`, `breadcrumb`, `button`, `chart`, `checkbox`, `drawer`, `dropdown-menu`,
`input`, `label`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`,
`table`, `tabs`, `toggle`, `toggle-group`, `tooltip`.

Note: `breadcrumb`, `skeleton`, and `sheet` are installed but **unused** by the block.
`skeleton` in particular is what the "designed loading states" item in `TASK.md` needs.

---

## 4. Every mock value, by file

### 4.1 `src/app/dashboard/data.json` — **the single biggest mock**

68 rows, all fictional. Shape:

```ts
{ id: number, header: string, type: string, status: string,
  target: string, limit: string, reviewer: string }
```

- `target` and `limit` are **strings** (`"18"`, `"5"`) holding what are semantically numbers.
- `status`: only two values ever appear — `"Done"` (39) and `"In Process"` (29).
  The UI's status `<Select>` also offers `"Not Started"`, which never occurs in the data.
- `type`: 10 values — `Cover page`, `Table of contents`, `Narrative`, `Technical content`,
  `Plain language`, `Legal`, `Financial`, `Research`, `Visual`, `Planning`.
- `reviewer`: **21 unique fake people**, 27 of 68 rows are the sentinel string
  `"Assign reviewer"`. Named reviewers: Eddie Lake (11), Jamik Tashpulatov (12), and one
  row each for Maya Johnson, Carlos Rodriguez, Sarah Chen, Raj Patel, Leila Ahmadi,
  Thomas Wilson, Sophia Martinez, Alex Thompson, Nina Patel, David Kim, Maria Garcia,
  James Wilson, Priya Singh, Sarah Johnson, Michael Chen, Lisa Wong, Daniel Park,
  Emma Davis.
- `header`: fictional document-section titles ("Cover page", "Executive summary",
  "Disaster Recovery Plan", …). **Zero overlap with the Correnthian domain.**
- `target` 2–31, `limit` 0–40 — arbitrary, no relationship to each other.

**Replacement:** delete entirely. The domain row shape is whatever the API's
documents/transactions endpoint returns; `target`/`limit` are proposal-draft concepts
with no place in a metals platform.

### 4.2 `src/components/app-sidebar.tsx`

Every nav entry is `url: "#"` — **21 dead links** (`navMain` 5, `navClouds` 3×2=6,
`navSecondary` 3, `documents` 3, plus the header `<a href="#">`).

| Mock | Line | Value |
|---|---|---|
| `data.user.name` | 22 | `"shadcn"` |
| `data.user.email` | 23 | `"m@example.com"` |
| `data.user.avatar` | 24 | `"/avatars/shadcn.jpg"` |
| brand label | 191 | `"Acme Inc."` |

**`/avatars/shadcn.jpg` does not exist** — `public/` contains only `file.svg`,
`globe.svg`, `next.svg`, `vercel.svg`, `window.svg`. The avatar 404s and the UI falls
back to the hardcoded `CN` initials in `nav-user.tsx`.

Nav labels that must be replaced wholesale with the Correnthian IA (`TASK.md` P2 lists
users, devices, assets, issuers, providers, chains, transactions, quotes, compliance,
audit):

- `navMain`: Dashboard, Lifecycle, Analytics, Projects, Team
- `navClouds`: Capture / Proposal / Prompts, each with Active Proposals + Archived
- `navSecondary`: Settings, Get Help, Search
- `documents`: Data Library, Reports, Word Assistant

Note `navClouds` is built but **never rendered** — `AppSidebar` passes only `navMain`,
`documents`, `navSecondary`. Dead data.

### 4.3 `src/components/nav-user.tsx`

- `<AvatarFallback>` text is the literal `"CN"` in both the trigger (line 47) and the
  dropdown label (line 68). It does not derive from `user.name`.
- Dropdown items **Account / Billing / Notifications / Log out** have no `onClick`
  handlers — all four are inert. Billing in particular is meaningless for this platform.
- Sizing uses Tailwind (`className="h-8 w-8 rounded-lg grayscale"`) — see §5.3.

### 4.4 `src/components/site-header.tsx`

- `<h1>` hardcoded `"Documents"`. Not the page's actual title.

### 4.5 `src/components/section-cards.tsx` — **all four cards are fake**

| Card | Label | Value | Delta | Sub-copy |
|---|---|---|---|---|
| 1 | Total Revenue | `$1,250.00` | `+12.5%` | "Trending up this month" / "Visitors for the last 6 months" |
| 2 | New Customers | `1,234` | `-20%` | "Down 20% this period" / "Acquisition needs attention" |
| 3 | Active Accounts | `45,678` | `+12.5%` | "Strong user retention" / "Engagement exceed targets" |
| 4 | Growth Rate | `4.5%` | `+4.5%` | "Steady performance increase" / "Meets growth projections" |

Every value is a JSX text literal — not a prop, not data. This is the most important
file to rewrite: a metals platform has no "Total Revenue" headline. Likely Correnthian
equivalents are held metal, active accounts, pending compliance reviews, open quotes.

Card 2 is also the only one with a *meaningful* delta (`-20%`, `TrendingDownIcon`); the
other three all claim `+12.5%` regardless of value.

### 4.6 `src/components/chart-area-interactive.tsx`

- `chartData` (lines 35–127): **91 hardcoded rows**, `2024-04-01` → `2024-06-30`,
  `{ date, desktop: number, mobile: number }`. All values random-ish (59–520).
- `referenceDate = new Date("2024-06-30")` (line 155) — the window is computed against a
  **frozen literal date**, so the "last 3 months" window drifts further into the past
  every day and eventually shows nothing.
- `chartConfig`: series labelled **`desktop` / `mobile`**, both mapped to
  `color: "var(--primary)"`. Series names are web-traffic concepts, not metals.
- `<CardTitle>Total Visitors</CardTitle>` + description "Total for the last 3 months".
- Range control options: `"90d"` / `"30d"` / `"7d"` labelled
  "Last 3 months" / "Last 30 days" / "Last 7 days".
- Exports `export const description = "An interactive area chart"` (line 33) — a leftover
  from the v0 canvas; harmless but meaningless here.

### 4.7 `src/components/data-table.tsx`

Structural mocks / stubs, not just data:

- `schema` (line 118) — a Zod object matching `data.json` exactly. Everything downstream
  types against it. It must be replaced **first**; the whole file is downstream of it.
- `columns` (lines 148–319) — nine columns: `drag`, `select`, `header` ("Header"),
  `type` ("Section Type"), `status` ("Status"), `target` ("Target"), `limit` ("Limit"),
  `reviewer` ("Reviewer"), `actions`.
- Reviewer `<Select>` options are hardcoded to exactly **two** people
  (`Eddie Lake`, `Jamik Tashpulatov`, lines 283–285) — while `data.json` carries 21.
  Inconsistent with its own data.
- Drawer reviewer `<Select>` options are hardcoded to three people
  (`Eddie Lake`, `Jamik Tashpulatov`, `Emily Whalen`, lines 802–807) — a *third*
  inconsistent set, and `Emily Whalen` does not exist in `data.json`.
- Drawer `<Select>` options for type use `"Table of Contents"`, `"Executive Summary"`,
  `"Technical Approach"`, … (lines 748–763) — **capitalised differently from `data.json`
  values** (`"Table of contents"` lowercase `c`). So the drawer select never matches the
  row it was opened for.
- **`toast.promise(new Promise(resolve => setTimeout(resolve, 1000)))`** at lines 217 and
  241 — the "Target" and "Limit" cells look like editable inputs and submit on Enter, but
  the handler only waits one second and never persists anything. Fake write path.
- Row actions menu (lines 294–318): **Edit / Make a copy / Favorite / Delete** — all four
  have no handlers.
- View tabs (lines 411–445): `outline`, `past-performance` (badge `3`), `key-personnel`
  (badge `2`), `focus-documents`. **The badge counts are hardcoded literals** and do not
  match the data (data.json contains 21 distinct reviewers, not 2).
- Three of the four tabs (`past-performance`, `key-personnel`, `focus-documents`) render
  `<div className="aspect-video w-full flex-1 rounded-lg border border-dashed" />` —
  **empty dashed placeholders, no content at all.** Clicking 3 of 4 tabs shows a blank box.
- Drawer copy (lines 672–673, 721–729): `"Showing total visitors for the last 6 months"`,
  `"Trending up by 5.2% this month"`, and
  `"Showing total visitors for the last 6 months. This is just some random text to test the layout."`
  — the block literally says so in the source.
- A second `chartData` / `chartConfig` (lines 639–657), 6 rows, `month` + `desktop` +
  `mobile`, used by the row drawer. Same fabricated traffic series.
- `"Assign reviewer"` sentinel is compared against at line 262 to decide whether to
  render a `<Select>` vs plain text — a UI hack driven by mock data that will not
  survive a real API.

### 4.8 `src/app/page.tsx` (root `/`)

create-next-app boilerplate. References `/next.svg` and `/vercel.svg`. Not Correnthian.
Should be replaced with a redirect to `/dashboard` or a real landing.

---

## 5. Known shadcn gotchas — verified, not assumed

### 5.1 Circular `--font-sans` — **WAS PRESENT, now fixed**

`shadcn init` wrote exactly the broken form into `src/app/globals.css`:

```css
@theme inline {
  --font-sans: var(--font-sans);          /* circular self-reference */
  --font-mono: var(--font-geist-mono);    /* runtime-injected, also unresolvable */
  --font-heading: var(--font-sans);       /* inherits the cycle */
}
```

(The pre-init create-next-app file had the milder `--font-sans: var(--font-geist-sans)`,
which is equally unresolvable under Tailwind v4's parse-time `@theme inline` resolution.)

Replaced with literal family names:

```css
--font-sans: "Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif;
--font-mono: "Geist Mono", "Geist Mono Fallback", ui-monospace, monospace;
--font-heading: "Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif;
```

The `next/font` classes stay on `<html>` (not `<body>`), matching the skill's guidance.

### 5.2 Unified `radix-ui` package — **CONFIRMED CORRECT**

15 files under `src/components/ui/` import from `"radix-ui"`. Zero occurrences of
`@radix-ui/react-*` anywhere in `src/`. `radix-ui@^1.6.7` is the only primitive dependency.

### 5.3 `Avatar` `size` prop — **GOTCHA IS OUTDATED; no action needed**

The skill says Avatar has no `size` prop. As of **shadcn CLI 4.21.1 that is no longer
true**. `src/components/ui/avatar.tsx` defines:

```tsx
function Avatar({ className, size = "default", ...props }:
  React.ComponentProps<typeof AvatarPrimitive.Root> & {
    size?: "default" | "sm" | "lg"
  })
```

sizing itself via `data-size={size}` + `data-[size=lg]:size-10` / `data-[size=sm]:size-6`.
The block's `nav-user.tsx` still uses Tailwind classes (`className="h-8 w-8"`), which is
harmless — `twMerge` resolves them over the default `size-8`. **Use the `size` prop
going forward.**

### 5.4 Gotcha the skill does *not* list — **`TooltipProvider` was never mounted, and the build failed**

First `pnpm --filter @correnthian/admin build` failed:

```
Error occurred prerendering page "/dashboard". Read more: https://nextjs.org/docs/messages/prerender-error
Error: `Tooltip` must be used within `TooltipProvider`
    at ignore-listed frames { digest: '1338536064' }
Export encountered an error on /dashboard/page: /dashboard, exiting the build.
⨯ Next.js build worker exited with code: 1 and signal: null
```

Cause: `sidebar.tsx`'s `SidebarMenuButton tooltip={...}` renders a `Tooltip`, but the
block never mounted a `TooltipProvider` — the CLI printed the reminder and then did not
add it. Fixed in `src/app/layout.tsx` by wrapping children in `<TooltipProvider>`.

`<Toaster />` was **also** not mounted, so every `toast.promise(...)` in `data-table.tsx`
was silently a no-op. Mounted alongside it.

`src/components/ui/sonner.tsx` calls `useTheme()` from `next-themes`, but **no
`ThemeProvider` is mounted anywhere**. It does not crash (`useTheme()` returns `{}`, so
`theme` falls back to `"system"`), but the toast theme will not track the app. Decide
whether to mount `next-themes` or drop the dependency when the theme story is settled.

### 5.5 Gotcha the skill does *not* list — **ESLint `react-hooks/set-state-in-effect`**

The block ships two lint **errors** under the repo's own `eslint-config-next`, which
would turn root `pnpm lint` red (CI does not currently run lint — see `.github/workflows/ci.yml`):

- `src/hooks/use-mobile.ts:14` — `setIsMobile(window.innerWidth < ...)` in an effect body.
- `src/components/chart-area-interactive.tsx:149` — `setTimeRange("7d")` in an effect.

Both rewritten (see the comments in those files):
- `useIsMobile` now uses `React.useSyncExternalStore` subscribing directly to the media query.
- The chart derives `const effectiveTimeRange = isMobile ? "7d" : timeRange` and binds the
  `ToggleGroup`/`Select` to it.

Plus one warning: unused `Button` import in `site-header.tsx`, removed.

### 5.6 Other observations

- **`cn` is an npm package**, not the classic `clsx` + `tailwind-merge` pair:
  `src/lib/utils.ts` is one line, `export { cn } from "cn"`. 22 imports across `src/`
  pull from `"cn"`. Don't rewrite these to `clsx`.
- `globals.css` imports `"shadcn/tailwind.css"` — a **runtime CSS import from the
  `shadcn` package**, which is why `shadcn@^4.21.1` sits in `dependencies` rather than
  `devDependencies`. Removing it breaks the build.
- The block is `radix-nova` style, not `new-york`. The `new-york` naming still appears in
  older docs; CLI v4 styles are named after the preset.
- **Dark-first:** `globals.css` ships a full `.dark` palette, but nothing applied the
  `dark` class — the app defaulted to **light**. `className="dark"` is now set statically
  on `<html>` in `layout.tsx`. There is no theme toggle.
- `metadata.title` was `"Create Next App"`; now `"Correnthian Admin"`.

---

## 6. No TODO/stub comments were left by the block

A grep for `TODO | FIXME | XXX | HACK | mock | fake | stub | sample` across `src/` returns
only two incidental hits — `"User Interface Mockups"` (a `data.json` string) and
`"m@example.com"` (a fake email). The block ships **no marker comments at all**: every
stub is undiscoverable from the source and has to be found by reading the values. That is
the reason this file exists.

---

## 7. Handoff checklist for the rewiring task

Ordered by dependency:

1. **Delete `src/app/dashboard/data.json`** and the `schema`/`columns`/`chartData` in
   `data-table.tsx` first — everything else types off them.
2. Replace `components/app-sidebar.tsx`'s inline `data` object with the real nav model.
   Delete `navClouds` (rendered by nothing). `data.user` must come from the session.
3. Mount a real API client. `packages/api-client` exists for this and is not yet
   referenced by `apps/admin` — `apps/admin/package.json` currently has **zero**
   `@correnthian/*` workspace dependencies.
4. Add auth + RBAC. `nav-user.tsx`'s "Log out" is inert; nothing gates `/dashboard`.
5. Replace the four `section-cards.tsx` values with real metrics.
6. Replace `chart-area-interactive.tsx`'s series. Also fix the hardcoded
   `referenceDate = new Date("2024-06-30")`.
7. Build the `/users`, `/devices`, `/assets`, `/issuers`, `/providers`, `/chains`,
   `/transactions`, `/quotes`, `/compliance`, `/audit` routes listed in `TASK.md`.
   Consider a `(admin)` route group so the sidebar shell is not duplicated per page.
8. Delete the three empty dashed-border tab panes, or give them content.
9. Delete `src/app/page.tsx`'s create-next-app boilerplate.
10. Add `loading.tsx` / `error.tsx` / designed empty states. `skeleton.tsx` is already
    installed and unused.

### Dependency surface added by the block

Runtime: `@dnd-kit/core`, `@dnd-kit/modifiers`, `@dnd-kit/sortable`, `@dnd-kit/utilities`,
`@tanstack/react-table@^9`, `recharts@3.8.0`, `sonner`, `vaul`, `zod@^4`,
`next-themes`, `lucide-react`, `radix-ui`, `cn`, `class-variance-authority`,
`tw-animate-css`, `shadcn`, plus the Next/React pins.

If the rewiring task replaces the table with a server-driven one, `@dnd-kit/*` (drag-to-
reorder of mock rows) is the most likely candidate for removal.