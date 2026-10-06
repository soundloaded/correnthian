# DESIGN_SYSTEM

The design language, the component conventions, and — importantly — the gap
between the token source and what the admin actually renders.

Verified against the repository at `2be6499`.

---

## 1. The direction

From `packages/design-tokens/src/index.ts`:

> Obsidian surfaces, silver-neutral UI, and a gold accent that is reserved for
> signalling a metal asset. Gold is never used as general brand colour — if the
> whole interface is gold, nothing is left to highlight with.

Three scales, plus glass and motion:

| Token group | Values |
|---|---|
| `color.obsidian` | `0 #08090B`, `50 #0E1013`, `100 #15181C`, `200 #1D2126`, `300 #272C33`, `400 #363C45` |
| `color.silver` | `100 #E8EAED`, `200 #C7CBD1`, `300 #9BA1AA`, `400 #6E757F`, `500 #4A5058` |
| `color.gold` | `accent #C9A227`, `soft #E3C766`, `muted #8A6F1C` |
| `color` semantic | `positive #3FA46A`, `negative #D9534F`, `warning #D9A441`, `info #4A90D9` |
| `space` | `0`–`8` = 0, 4, 8, 12, 16, 24, 32, 48, 64 px |
| `radius` | `sm 8px`, `md 14px`, `lg 20px`, `xl 28px`, `pill 999px` |
| `glass` | `surface rgba(21,24,28,0.72)`, `surfaceElevated rgba(29,33,38,0.82)`, `border rgba(200,205,212,0.10)`, `borderStrong rgba(200,205,212,0.18)`, `blur 24px`, `shadow 0 8px 32px rgba(0,0,0,0.45)` |
| `motion` | `fast 140ms`, `base 240ms`, `slow 420ms`, `standard cubic-bezier(0.32,0.72,0,1)`, `emphasized cubic-bezier(0.16,1,0.3,1)` |

The stated intent: restraint is what separates this from "glass everywhere",
which reads as decoration rather than finance.

---

## 2. The gap: the admin does not use the tokens

**`packages/design-tokens` is not imported by `apps/admin`.** The admin's
`globals.css` defines its own palette in OKLCH, and it is a **neutral** one —
`oklch(0.145 0 0)` foreground on `oklch(1 0 0)` background, with a
`--sidebar-primary` of `oklch(0.488 0.243 264.376)` (a violet) in dark mode.

So:

- The obsidian/silver/gold scales exist and are unused.
- The gold rule — gold is a signal, not a brand wash — is **not enforced anywhere**.
- `packages/ui` is `export {}`. There is no component layer above shadcn.

This is not a defect to fix in a hurry. Mapping the tokens into the admin is a
design decision, not a mechanical import, and it is explicitly out of scope for
the current sprint. See [`CURRENT_SPRINT.md`](CURRENT_SPRINT.md).

**What is true today:** the admin uses shadcn theme tokens for foundational
surfaces (`bg-background`, `text-muted-foreground`, `border-border`) rather than
ad-hoc hex. That rule is being followed.

---

## 3. shadcn/ui conventions

`apps/admin/components.json`:

```json
{ "style": "radix-nova", "baseColor": "neutral", "cssVariables": true,
  "iconLibrary": "lucide", "rsc": true, "tsx": true }
```

### The CLI flow

```bash
npx shadcn@latest init --preset nova --base radix
npx shadcn@latest add dashboard-01
```

**CLI v4 removed `--style`, `--base-color`, `--src-dir` and `--css-variables`.**
Passing any of them fails, and the error does not always make the cause obvious.

**Base is `radix`, not a default.** `dashboard-01` ships Radix-based primitives,
so `base-ui` or `aria` would surface as broken primitives mid-integration rather
than at install time.

**The unified `radix-ui` package** is the dependency — not the older per-primitive
`@radix-ui/react-*` packages. Do not add those by hand; let the CLI write the
import.

**Always add components through the CLI.** `alert-dialog` was lost in the
re-scaffold and had to be restored with `npx shadcn@latest add alert-dialog -y`
rather than by writing an import pointing at a file that was not there.

### Gotchas that cost real time

| Gotcha | Symptom |
|---|---|
| `dashboard-01` never mounts `TooltipProvider` | `next build` **fails** prerendering `/dashboard` with "`Tooltip` must be used within `TooltipProvider`". The CLI prints a reminder and then does not add it. |
| `dashboard-01` never mounts `<Toaster />` | Every `toast.promise(...)` is a silent no-op. |
| The block ships two `react-hooks/set-state-in-effect` lint errors | Root `pnpm lint` goes red. `use-mobile` now reads the media query through `useSyncExternalStore`; the chart derives an effective range during render. |
| The block ships **no `TODO` or stub comments** | Every mock is undiscoverable without reading the values. That is why the original `STUB-AUDIT.md` was per-file rather than a summary. |
| `shadcn init` writes `--font-sans: var(--font-sans)` into `@theme inline` | A circular self-reference. Tailwind v4 evaluates `@theme inline` at parse time, so every `font-sans` utility silently becomes a no-op. It also wrote `--font-mono: var(--font-geist-mono)`, which resolves at *runtime* and so never resolves at all. Both are fixed in `globals.css` with literal family names. |
| `Avatar` has no `size` prop | Size comes from Tailwind classes. *(Superseded: as of CLI 4.21.1 `Avatar` does accept `size?: "default" \| "sm" \| "lg"`.)* |

---

## 4. Component conventions

### Grouping

Components are grouped by role, not by the block's flat names:

```
src/components/
├── layout/     admin-sidebar, nav-links, site-header, user-menu
├── feedback/   api-state, retry-button, skeletons
├── forms/      action-form, confirm-action
├── actions/    asset-actions, issuer-actions, registry-actions, user-actions
├── charts/     audit-activity-chart
└── ui/         shadcn primitives
```

### The feedback layer is the substantive part

`ApiState` is the single component every data-backed surface routes through. It
renders five designed states — `ok`, `unauthorised`, `forbidden`, `unavailable`,
`error` — and a designed empty state. Detail in [`ADMIN_OPS.md`](ADMIN_OPS.md).

`SkeletonRows` and `SkeletonCards` are placeholders for a surface whose data is
still being fetched. They are states, not fakes.

`RetryButton` calls `router.refresh()` in a transition, because a server
component cannot retry on its own.

### Charts

Recharts cannot render in a server component, so the audit chart is split into
`apps/admin/src/components/charts/audit-activity-chart.tsx`. shadcn's own block splits it the
same way.

### Filtering

Radix `Select` is a client component and cannot participate in a no-JS form
submission. The shadcn `Select` renders a hidden native select so it happens to
work — **verified rather than assumed**. Where a filter must work without
JavaScript, the admin uses `Button`-as-link chips instead, which also puts the
filter in the URL.

---

## 5. Typography and formatting

`apps/admin/src/lib/format.ts`:

- **Monospace everywhere an operator may need to compare characters or copy a
  value** — hashes, addresses, amounts, timestamps.
- `fmtUsd` renders `—` for null, never `$0.00`.
- `fmtDate` is `en-GB` short; `fmtDateTime` is ISO with the `T` replaced.
- `shortAddress` is `0xAbCd…1234` — enough to recognise, short enough for a
  table cell. **Never use it in a transaction.**
- `relativeTime` renders `never` for null.

---

## 6. Dark mode

The product direction is dark, and it is not incidental. The token source says
so; `docs/engineering/admin.md` says the admin is dark-first and that light mode
is a preference, not the default.

**The admin is not dark-first.** `globals.css` defines both `:root` (light) and
`.dark`, and `layout.tsx` applies neither — the app renders light unless the
browser prefers dark. `next-themes` is a dependency but is not wired.

This is a real gap against the stated direction, and it is the first thing to
fix when the tokens are mapped in.

---

## 7. Trust and colour

State that matters in a trust context must **not** rely on colour alone. Colour-
blind operators and printed screenshots exist, and "red means unverified" is not
a disclosure.

The admin follows this: `synthetic — not metal` and `never attested` are badges
with text, not grey text. `degraded` providers take the destructive tone with
the word in the badge. `denied` audit outcomes are the only ones that take the
destructive tone.

---

## 8. What to do before building a new admin page

1. **Read `ApiState` first** and route through it. A page that does not is a page
   whose failure mode is a blank screen.
2. **Infer the response type** from `Contract<'GET /x'>`. Do not hand-write it.
   See [`API_CONTRACTS.md`](API_CONTRACTS.md).
3. **Design the empty state.** A page that only works when data exists is a page
   whose failure mode is a blank screen an operator cannot interpret.
4. **Design the partial-failure state.** If a page reads more than one endpoint,
   name the ones it could not read rather than reporting an all-clear.
5. **Put filter state in the URL** via a plain GET form, so the URL is the state
   and pagination stays server-side.
6. **Use shadcn theme tokens** for foundational surfaces. Never ad-hoc hex.
7. **Never display asset identity by symbol.** Tables key on `assetId` / `AssetRef`.
   A symbol column is a label, never a key.
8. **Render the disclosure string verbatim** from the API. Never recompute it.