# Features.tsx Rebuild — Goldmoney Mirror (Design)

## Intent and why
Rebuild the Features section content for Correnthian's gold-vault positioning, mirroring
goldmoney.com's trust-first messaging (ownership, custody, audit), because Goldmoney's
all-text sections convert on proof, not product UI.

## Goals
- Same layout, grid, and CSS — only texts, icons, images swap.
- 5 content blocks map 1:1 onto Goldmoney's pillars.
- Generated images/icons match current asset pixel sizes exactly.
- Delete replaced icons/images only after the rebuild renders correctly.

## Non-goals / anti-goals
- No new CSS, no redesign, no new sections (user constraint).
- No invented custodian names, AUM figures, or country counts — placeholders flagged below.
- Failure = tilted/cropped phone-style mismatch repeated here: wrong aspect or restyled layout.

## Constraints
- `packages/wallet-core` keeps no HTTP/RPC (private-key boundary) — marketing-only change, unaffected.
- Logging uses `redactDeep()` — not applicable to static marketing copy.
- No key material in `.env*` — not applicable.

## Approaches considered
- **A. Goldmoney mirror (picked):** 1:1 copy mapping. Fastest trust transfer, fits vault positioning.
- B. Product-led (app actions per block) — rejected: less trust language, needs new screenshots.
- C. Hybrid (Goldmoney headlines + app screenshots) — rejected: more image work, user picked A.

## Block mapping (final, approach A)
| Slot (current) | New heading | Source | Rows/images |
|---|---|---|---|
| Header | pill `Own it outright`, H2 `Gold, held in your name.` | Goldmoney hero | sub: buy/hold/sell + insured storage |
| Light card (`Flexible Streak Rules`) | `Owned by you` + allocated copy | Pillar 1 | keep `dashboard09` slot (466×350) → allocated-bars photo; 7 marquee pills → Fully allocated / In your name / Insured vaults / Independent audits / Daily settlement / 6 global vaults / Physical redemption |
| Planner (`Smart Daily Planner`, bg 600×700) | `Before you begin` FAQ | Goldmoney FAQ | 4 rows ↔ 3 Q&As + support row; rightText becomes links (Check eligibility / Read about ownership / Redemption fees / Contact team) |
| Wide (`Routine Stacks`, bg 1200×520) | `Your Holding — an account for what you own` + 3 steps in paragraph + CTA `Open your holding` | Goldmoney Holding | `dashboard12` (tall) + `dashboard11` (square card) slots → vault imagery, same display aspect |
| Reflection (bg 600×650) | `Checked independently` | Pillar 3 | 3 rings → 100% Allocated / 100% Insured / 100% Audited; 2 stat cards → country count + safeguarded value (**needs real numbers**) |
| Reminders (dark) | `Our fees — clear costs, considered decisions` | Goldmoney fees | bell slot (81×62) → fee-tag icon; `dashboard13` slot (wide) → fee-schedule card image |

## Asset generation plan (same sizes)
- Raster: 466×350 PNG, 600×700 / 1200×520 / 600×650 WebP backgrounds, 81×62 PNG icon, tall + square + wide card images at current display aspects.
- Vector: 10 SVG icons (7 marquee @13px display, 3 rings) — gold themes: shield, vault, audit-check, bar, globe, lock, tag.
- Verify in browser over `:3002` before deleting any replaced file.

## Open questions for owner
1. Stats for the two stat cards — real Correnthian figures (countries, value safeguarded, since-year) or omit?
2. Custodian names — name real vault partners or keep generic ("specialist insured vaults")?

## Left to the builder
Exact copy wording, image prompts, grep-check icon usage repo-wide before deleting, full `pnpm typecheck`, commit with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
