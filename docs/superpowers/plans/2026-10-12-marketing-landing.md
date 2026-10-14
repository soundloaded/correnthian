# Marketing Landing Page (pre-launch)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default Next scaffold with an honest pre-launch landing page: vision, trust model, how-it-will-work, fees honesty, FAQ, and a notify-me capture that stores nothing server-side.

**Architecture:** Single `page.tsx` (server) + one client component for the notify form. No API calls, no backend, no dates, no fees numbers, no provider names, no prices — every claim traces to `docs/agent/MASTER_CONTEXT.md`. System font stack (no webfont fetch at build).

**Tech Stack:** Next.js 16, React 19, Tailwind v4 (already in the app).

**Spec:** `docs/agent/MASTER_CONTEXT.md` §§1–2 (what it is / is-not / wedge / beachhead) · CLAUDE.md ("Fee percentages, custody terms, provider names | Nothing in this repository is verified. Do not write a number that is not in code.")

## Global Constraints

- Copy honesty is the whole task: each section below names its source. Anything without a source does not ship.
- The notify form stores the address in `localStorage` ONLY and says so on the page ("Saved on this device. Nothing was sent anywhere — we'll ask again at launch."). A control that pretended to subscribe would be the ADR-020 lie in UI form. No mailto to an unregistered domain, no invented contact address.
- No fake links: nav anchors to page sections only; footer has no social/shadow links.
- Static content: no TDD unit tests (nothing to fail); verification is typecheck + production build + browser render of every section.
- Commit once + attribution line.

## Review Focus

1. A claim about buying, redeeming, or an app existing today — every launch-dependent item must carry its gating note ("at launch", "with our launch partners" unnamed). Read the page top to bottom checking each verb's tense.
2. A number that is not in code — grep the file for `%`, `$`, digits-near-claims; only `10^-8`-free prose allowed. (Section anchors like `h1` sizes are styling, not claims.)
3. A dead control — click everything in the browser; each must visibly do what its label says.
4. Mobile layout — 390px wide render, no horizontal scroll, no overlap.
5. Dark-mode-only or light-only breakage — page ships one dark theme; verify text contrast on the actual render.

---

## File Map

- Modify: `apps/marketing/src/app/page.tsx` (all sections), `apps/marketing/src/app/globals.css` (theme tokens only if needed — check current file first).
- Create: `apps/marketing/src/app/notify-form.tsx` (`'use client'`, email validation, localStorage, honest copy).
- Touch nothing else.

---

## Task 1: Page + form

- [ ] **Step 1: Read `globals.css`** — keep or extend minimally; no design-system import (marketing has none).
- [ ] **Step 2: Write `notify-form.tsx`** — email regex validation, submit disabled until valid, on submit writes `localStorage['correnthian-notify']`, shows "Saved on this device…" confirmation. No fetch, no mailto.
- [ ] **Step 3: Write `page.tsx`** — header (wordmark "Correnthian" + anchor nav: Trust, How it works, Fees, FAQ), hero ("Gold you own outright." + wedge subhead + notify CTA anchor), trust trio (What am I holding? / Who backs it? / Can I take it out? — answers: registered tokens, disclosed custodians/vaults/proof-of-reserve, physical redemption path), how-it-will-work (buy with card or bank → lands at an address only you control → backing visible → redeem; each launch-gated, partners unnamed), fees honesty (stated and itemised; unknown shown as unknown — no numbers), FAQ (custodian? No. Issuer? No — registers. Earnings? Stated fees. Keys? Never leave your device. When? No date given), footer (© line, no links beyond anchors).
- [ ] **Step 4: Verify** — `pnpm --filter @correnthian/marketing typecheck` exit 0; `pnpm --filter @correnthian/marketing build` exit 0; boot + browser render at desktop and 390px widths, screenshot both; click every control.
- [ ] **Step 5: Commit** (why-message + attribution).

## Task 2: Close out

- [ ] **Step 1: Trackers** — CHANGELOG entry; SLACK_STATUS.md marketing section flips to first page live (scaffold → page).
- [ ] **Step 2: Slack delta** — post via webhook file (never print it), commit the doc.

---

## Self-review

**1. Spec coverage:** MASTER_CONTEXT §§1–2 claims each map to a section (is/is-not → FAQ; wedge → hero+trust trio; beachhead → hero subhead; fees → fees section; constraints → no-numbers/no-dates/no-names). No section without a source.

**2. Placeholder scan:** no TBD/TODO; notify behavior fully specified; no "similar to".

**3. Type consistency:** single new component with explicit props (`{}` — none needed); page has no props. Nothing shared, nothing to mismatch.

**4. Review Focus:** all five lines name the check. No empty section.
