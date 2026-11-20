# Features.tsx Goldmoney-Mirror Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Features.tsx content (texts, icons, images only) as a Goldmoney mirror for Correnthian vault positioning, keeping all layout/CSS untouched.

**Architecture:** Single-file content swap in `apps/marketing/src/app/home/components/Features.tsx` plus same-size asset generation (new `correnthian-*` files), import swap, browser verification, then delete replaced assets.

**Tech Stack:** Next.js App Router, `next/image` with `StaticImageData` imports, Tailwind, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-19-features-goldmoney-mirror-design.md`

## Global Constraints

- Never violate the private key boundary — `packages/wallet-core` accepts no HTTP client/RPC/provider.
- Correnthian Account ≠ wallet ownership; two kinds: `SmartAccount` (EVM, passkey) and `SeedAccount` (BTC/Solana).
- No key material in `.env*` files; CI enforces this.
- Use `@correnthian/security`'s `redactDeep()` for logging.
- No new CSS, no redesign, no new sections — only texts, icons, images swap (owner constraint).
- All copy stays generic — no real custodian names, AUM figures, or country counts (owner decision).
- Delete replaced icons/images only after the rebuild renders correctly in the browser.

## Review Focus

- New raster with wrong pixel size stretches or crops the fixed-size slot — expect exact dimensions from Task 1's table; pinned in Task 1 dimension-check step.
- Deleted SVG still imported by another component breaks the build — expect repo-wide grep with zero outside-Features hits before delete; pinned in Task 5 grep step.
- Generic copy accidentally naming a real custodian, figure, or rate invents facts — expect zero matches for Brink's/Loomis/Mint/$/numbers in new copy; pinned in Task 3 copy-check step.
- Longer marquee labels overflow the pill or break `whitespace-nowrap` — expect pills render one line without overlap at 1280px; pinned in Task 4 browser step.
- Light-on-dark contrast lost on `featureBg` replacements makes white copy unreadable — expect headings legible over new backgrounds in screenshots; pinned in Task 4 browser step.

---

### Task 1: Generate raster replacement assets (same sizes)

**Files:**
- Create: `apps/marketing/src/assets/images/workspace/correnthian-allocated-bars.png` (466×350 RGBA, replaces `dashboard-09.png`)
- Create: `apps/marketing/src/assets/images/locations/correnthian-faq-bg.webp` (600×700, replaces `feature-01.webp`)
- Create: `apps/marketing/src/assets/images/locations/correnthian-vaults-bg.webp` (1200×520, replaces `feature-02.webp`)
- Create: `apps/marketing/src/assets/images/locations/correnthian-audit-bg.webp` (600×650, replaces `feature-03.webp`)
- Create: `apps/marketing/src/assets/images/icons/correnthian-fee-tag.png` (81×62 RGBA, replaces `bell-image.png`)
- Test: dimension check script (no committed test file; verification is the check below)

**Interfaces:**
- Consumes: current sizes from design doc (466×350, 600×700, 1200×520, 600×650, 81×62).
- Produces: 5 raster files above, imported by Task 4.

- [ ] **Step 1: Generate the 5 rasters at exact pixel sizes.**
  Gold-vault art direction, dark premium backgrounds for the three `locations/*` (white copy sits on them); allocated gold bars photo for `correnthian-allocated-bars.png`; small gold fee-tag icon for `correnthian-fee-tag.png`. Keep same formats (PNG stays PNG, WebP stays WebP).
- [ ] **Step 2: Verify dimensions.**

  Run: `python3 -c "from PIL import Image; [print(f, Image.open(f).size) for f in [...]]"` over the 5 files.
  Expected: `(466, 350)`, `(600, 700)`, `(1200, 520)`, `(600, 650)`, `(81, 62)` respectively — regenerate any mismatch, never resize in code.
- [ ] **Step 3: Verify dark-background contrast.**
  Open each `locations/correnthian-*.webp`; expect dark imagery with white-copy-safe luminance (same mood as current `feature-0*.webp`). Regenerate failures.
- [ ] **Step 4: Commit.**

  ```bash
  git add apps/marketing/src/assets/images/workspace/correnthian-allocated-bars.png apps/marketing/src/assets/images/locations/correnthian-*.webp apps/marketing/src/assets/images/icons/correnthian-fee-tag.png
  git commit -m "feat(marketing): add Correnthian Features replacement rasters"
  ```

### Task 2: Generate SVG replacement icons (same viewBoxes)

**Files:**
- Create: `apps/marketing/src/assets/images/icons/correnthian-trust-01.svg` … `-07.svg` (all `viewBox="0 0 24 24"`, gold line icons, replace `icon-12/13/16/17/42/43/44` in marquee order)
- Create: `apps/marketing/src/assets/images/icons/correnthian-ring-01.svg` (`viewBox="0 0 88 88"`), `-ring-02.svg` (`viewBox="0 0 128 128"`), `-ring-03.svg` (`viewBox="0 0 88 88"`) (gold ring/progress motifs, replace `icon-46/47/48`)
- Create: `apps/marketing/src/assets/images/workspace/correnthian-vault-tall.svg` (`viewBox="0 0 438 695"`, replaces `dashboard-12.svg`), `correnthian-vault-card.svg` (`viewBox="0 0 183 182"`, replaces `dashboard-11.svg`), `correnthian-fee-card.svg` (`viewBox="0 0 359 211"`, replaces `dashboard-13.svg`)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: 13 SVG files above, imported by Task 4.

- [ ] **Step 1: Generate the 7 marquee icons** (`correnthian-trust-01`–`07`, `viewBox="0 0 24 24"`).
  Motifs in order: shield-check, vault-door, audit-clipboard, gold-bar, globe, lock, tag. Gold stroke (`#C9A227` family), no text inside, no background rect.
- [ ] **Step 2: Generate the 3 ring icons** (viewBoxes 88 / 128 / 88 to match slots).
  Gold circular progress-ring motifs at 100% state; keep `imgClass` display sizes unchanged.
- [ ] **Step 3: Generate the 3 workspace SVGs** (viewBoxes 438×695, 183×182, 359×211).
  Tall: dark vault-interior illustration; square card: mini "Your Holding" balance card; wide: fee-schedule card. Same viewBoxes exactly so `next/image` layout is unchanged.
- [ ] **Step 4: Verify viewBoxes and validity.**

  Run: `grep -h viewBox <13 files>` and open each SVG once.
  Expected: viewBoxes match the values above; every file renders without error.
- [ ] **Step 5: Commit.**

  ```bash
  git add apps/marketing/src/assets/images/icons/correnthian-trust-*.svg apps/marketing/src/assets/images/icons/correnthian-ring-*.svg apps/marketing/src/assets/images/workspace/correnthian-vault-tall.svg apps/marketing/src/assets/images/workspace/correnthian-vault-card.svg apps/marketing/src/assets/images/workspace/correnthian-fee-card.svg
  git commit -m "feat(marketing): add Correnthian Features replacement SVGs"
  ```

### Task 3: Rewrite Features.tsx copy (texts only, no CSS changes)

**Files:**
- Modify: `apps/marketing/src/app/home/components/Features.tsx` (data arrays + headings/paragraphs/CTA only; zero className changes)
- Test: `pnpm --filter @correnthian/marketing exec tsc --noEmit -p tsconfig.json`

**Interfaces:**
- Consumes: asset files from Tasks 1–2 (imports wired in Task 4).
- Produces: final copy in `Features.tsx`, verified by Task 4.

Exact copy (generic, no real names/figures):

- Header pill: `Own it outright`; H2: `Gold, held in your name.`; sub: `Buy, hold, and sell physical gold with insured storage and an online account for what you own.`
- Card 1: H3 `Owned by you`; p `Fully allocated metal held in your name — separate from our balance sheet, backed by independent checks.`
- `streakRules` labels (keep 7 entries, same `bgColorClass` values): `Fully allocated`, `In your name`, `Insured vaults`, `Independent audits`, `Daily settlement`, `Global vaults`, `Physical redemption`.
- Card 2: H3 `Before you begin`; p `Three answers worth knowing before you open a Holding.`; `plannedHabits` 4 rows → labels `Who can open a Holding?` / `Is it physical metal that I own?` / `Can I take delivery?` / `Need help with your circumstances?`; rightText → `Individuals, companies, trusts` / `Yes — allocated in your name` / `Arrangeable for full bars` / `Contact our team`. Keep time/timeSuffix fields structurally (repurpose as `01`/`Step` etc. or leave values — implementer picks, no visual change since classes untouched).
- Card 3 (wide): H3 `Your Holding — an account for what you own`; p `Open and verify your account, fund and purchase your chosen metals, then manage everything online.`; CTA both spans: `Open your holding`; footnote: `*Fund by bank transfer. Buy, hold, or sell through your account.`
- Card 4: H3 `Checked independently`; p `Independent audits and daily settlement keep records of your holdings accurate.`; `reflectionMetrics` → values `100`/`100`/`100`, labels `Allocated`/`Insured`/`Audited`; panel H4 `Your Holding at a glance`; `reflectionStats` → titles `Vault coverage` value `6` footer `Regions served worldwide` / `Metal standard` value `100%` footer `Fully allocated, always`.
- Card 5: H3 `Our fees — clear costs, considered decisions`; p `Buying, selling, storage, and redemption fees set out before you begin.`

- [ ] **Step 1: Apply the copy above to `Features.tsx`.** Data arrays + headings/paragraphs/CTA only. Do not touch any `className`, `style`, or JSX structure.
- [ ] **Step 2: Check for invented facts.**

  Run: `grep -n -i "brink\|loomis\|mint\|goldmoney\|\$[0-9]\|billion" apps/marketing/src/app/home/components/Features.tsx`
  Expected: no output.
- [ ] **Step 3: Typecheck.**

  Run: `pnpm --filter @correnthian/marketing exec tsc --noEmit -p tsconfig.json`
  Expected: clean (imports still point at old assets; swap happens in Task 4).
- [ ] **Step 4: Commit.**

  ```bash
  git add apps/marketing/src/app/home/components/Features.tsx
  git commit -m "feat(marketing): mirror Goldmoney copy in Features section"
  ```

### Task 4: Swap imports to new assets and verify in browser

**Files:**
- Modify: `apps/marketing/src/app/home/components/Features.tsx` (import block + `src=` references only)
- Test: typecheck + visual check on `pnpm dev` (marketing on :3002)

**Interfaces:**
- Consumes: Task 1 rasters, Task 2 SVGs, Task 3 copy.
- Produces: fully wired section ready for Task 5 cleanup.

Import map (old → new): `dashboard09`→`correnthian-allocated-bars`; `featureBg1/2/3`→`correnthian-faq-bg`/`correnthian-vaults-bg`/`correnthian-audit-bg`; `dashboard12`→`correnthian-vault-tall`; `dashboard11`→`correnthian-vault-card`; `dashboard13`→`correnthian-fee-card`; `bellImage`→`correnthian-fee-tag`; `icon-12/13/16/17/42/43/44`→`correnthian-trust-01..07`; `icon-46/47/48`→`correnthian-ring-01/02/03`.

- [ ] **Step 1: Swap the 18 imports and all `src=` references per the map.** Nothing else in the file changes.
- [ ] **Step 2: Typecheck.**

  Run: `pnpm --filter @correnthian/marketing exec tsc --noEmit -p tsconfig.json`
  Expected: clean.
- [ ] **Step 3: Verify in browser.** Run `pnpm dev`, open the About/Features section at :3002, scroll all 5 blocks.
  Expected: no opaque boxes, no tilt/crop, marquee pills one line each, white copy legible on all three dark backgrounds, rings show 100/100/100.
- [ ] **Step 4: Commit.**

  ```bash
  git add apps/marketing/src/app/home/components/Features.tsx
  git commit -m "feat(marketing): wire Correnthian assets into Features section"
  ```

### Task 5: Delete replaced assets, full verification

**Files:**
- Delete: `icons/icon-12.svg`, `icon-13.svg`, `icon-16.svg`, `icon-17.svg`, `icon-42.svg`, `icon-43.svg`, `icon-44.svg`, `icon-46.svg`, `icon-47.svg`, `icon-48.svg`, `icons/bell-image.png`, `workspace/dashboard-09.png`, `dashboard-11.svg`, `dashboard-12.svg`, `dashboard-13.svg`, `locations/feature-01.webp`, `feature-02.webp`, `feature-03.webp`
- Test: `pnpm typecheck` (all workspaces)

**Interfaces:**
- Consumes: Task 4's verified section.
- Produces: clean tree, commit with attribution.

- [ ] **Step 1: Confirm zero outside-Features references.**

  Run: `grep -rn "icon-12\|icon-13\|icon-16\|icon-17\|icon-42\|icon-43\|icon-44\|icon-46\|icon-47\|icon-48\|dashboard-09\|dashboard-11\|dashboard-12\|dashboard-13\|feature-01\|feature-02\|feature-03\|bell-image" apps/marketing/src --include="*.tsx" --include="*.ts"`
  Expected: no output (already verified pre-plan; re-check after swap).
- [ ] **Step 2: Delete the 18 files listed above.**
- [ ] **Step 3: Full typecheck.**

  Run: `pnpm typecheck`
  Expected: clean across all workspaces.
- [ ] **Step 4: Commit with attribution.**

  ```bash
  git add -A
  git commit -m "chore(marketing): remove replaced Features assets

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
  ```
