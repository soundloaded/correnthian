# Correnthian — Marketing Visual Direction & Habitline Color-Exchange Specification (Phase 7)

> **Purpose**: Define the complete visual, color, typography, component, and GSAP + Framer Motion choreography specification for [`apps/marketing`](file:///Users/mayaoflagos/correnthian/apps/marketing).
>
> **Core Visual Directive (Agreed with User)**:
> Preserve [`habitline-next`](file:///Users/mayaoflagos/correnthian/habitline-next)'s exact layout structure, rounded bento cards, floating pill navbar, marquee tracks, and GSAP + Framer Motion animations (`MotionEnhancer.tsx`), while **exchanging Habitline's default light/pastel palette for the Deep Obsidian, Burnished Bullion Gold, and Brushed Silver palette** from [`user_web_dashboard_reference.jpeg`](file:///Users/mayaoflagos/correnthian/user_web_dashboard_reference.jpeg) and [`packages/design-tokens/src/index.ts`](file:///Users/mayaoflagos/correnthian/packages/design-tokens/src/index.ts).

---

## 1. Visual Analysis of `user_web_dashboard_reference.jpeg`

Inspection of [`user_web_dashboard_reference.jpeg`](file:///Users/mayaoflagos/correnthian/user_web_dashboard_reference.jpeg) establishes five signature visual hallmarks that make the product immediately feel like a sovereign precious-metals and crypto vault:

1. **Deep Warm-Obsidian Canvas**:
   - The screen background is not flat pure `#000000` nor cool blue-gray; it is a rich, deep obsidian-bronze (`#08090B` -> `#12100B`) with subtle radial warm-gold ambient lighting behind the portfolio total (`$148,250.75 USD`).
2. **Material-Coded Asset Cards (Gold vs. Silver vs. Crypto)**:
   - **Gold Card (`TOTAL GOLD XAU — $84,910.20 / 31.103g / Held in Physical Vault`)**: Features a warm smoked-gold glass surface (`linear-gradient(135deg, rgba(201,162,39,0.22), rgba(20,18,12,0.88))`), a crisp 1px burnished-gold border (`#C9A227` / `#E3C766`), subtle inner specular glow, and a 3D physical gold bullion bar icon.
   - **Silver Card (`TOTAL SILVER XAG — $21,225.00 / 750g / Held in Physical Vault`)**: Features a brushed gunmetal-silver metallic gradient (`linear-gradient(135deg, rgba(199,203,209,0.24), rgba(29,33,38,0.90))`), a cool specular silver border (`#C7CBD1` / `#E8EAED`), and a 3D physical silver bullion bar icon.
   - **Bitcoin & Ethereum Cards**: Use warm dark-bronze glass surfaces with metallic gold emblem badges (`BTC`, `ETH`), uniting bullion and crypto inside one coherent luxury material language.
3. **Classical Authority + Tabular Financial Precision**:
   - Display titles (`CORRENTHIAN / DIGITAL VAULT`) use tracked-out authoritative serif/editorial proportions, while portfolio figures (`$148,250.75`, `31.103g`, `+2.4% last 24h`) use ultra-clean geometric sans-serif with `tabular-nums`.

---

## 2. Exact Color-Exchange Mapping for `apps/marketing/src/styles/partials/_config.css`

In Stage 3 (Implementation), we will exchange the CSS theme variables in [`apps/marketing/src/styles/partials/_config.css`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/styles/partials/_config.css) and component utility classes in [`_components.css`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/styles/partials/_components.css) as follows:

| Habitline Variable (`_config.css`) | Old Habitline Value (Light / Pastel) | New Correnthian Value (Obsidian / Gold / Silver) | Role in Marketing UI |
| :--- | :--- | :--- | :--- |
| `--color-bg` | `#FAF9F6` (Light cream) | `#08090B` (`surface.950` Deep Obsidian) | Primary page background canvas |
| `--color-primary-100` | `#231F20` (Dark charcoal text) | `#F5F6F8` (`text.primary` Alabaster White) | Primary headlines, H1–H4, high-contrast body text |
| `--color-primary-200` | `#F4F2EE` (Light beige card) | `#0E1013` (`surface.900` Obsidian Card) | Primary section & bento card background |
| `--color-secondary-100` | `#605D5D` (Muted brown-gray) | `#A0A6B1` (`text.secondary` Warm Pewter) | Subheadlines, body paragraphs, card descriptions |
| `--color-secondary-200` | `#8F8C8C` | `#686E78` (`text.muted` Slate Muted) | Eyebrows, captions, footnotes, metadata labels |
| `--color-gray-100` | `#FFFFFF` (White surface) | `#14171A` (`surface.850` Elevated Vault Surface) | Inner cards, navbar pill surface, interactive panels |
| `--color-gray-200` | `#E8E6E1` (Light border) | `#282D34` (`border.subtle` / Metallic hairline) | Card borders, dividers, table hairlines |
| `--color-gray-300` | `#F7F5F0` | `#1D2126` (`surface.800` Hover/Interactive Card) | Secondary bento surfaces, FAQ accordion hover |
| `--color-yellow-100` (Bullion Gold Accent) | `#FDF3D0` (Pastel yellow) | `#C9A227` (`gold.500` Burnished Bullion Gold) | Primary CTA fill, Gold asset highlights, active badges |
| `--color-yellow-200` (Gold Highlight) | `#FCE79C` | `#E3C766` (`gold.400` Specular Gold Highlight) | Button hover glow, gold border rims, fine-weight badges |
| `--color-blue-100` (Brushed Silver Accent) | `#E2F0FD` (Pastel blue) | `#C7CBD1` (`silver.400` Brushed Bullion Silver) | Silver asset card accents, secondary metallic badges |
| `--color-blue-200` (Silver Highlight) | `#B8DCFA` | `#E8EAED` (`silver.300` Specular Silver) | Silver card borders and icon highlights |
| `--color-green-100` (Positive / Verified) | `#E3F9E5` (Pastel green) | `#16A34A` (`semantic.success` / `+2.4%` Emerald) | Verified `ALLOCATED` badges, positive 24h delta (`#22C55E` text on `rgba(22,163,74,0.14)` pill) |
| `--color-orange-100` (Bronze / Deep Gold) | `#FDE8D7` | `#8A6F1C` (`gold.600` Deep Vault Bronze) | Warm ambient card gradients and secondary borders |
| `--color-pink-100` / `--color-purple-100` | Pastel pink / purple | Replaced with **Gold Glass** (`rgba(201,162,39,0.12)`) & **Silver Glass** (`rgba(199,203,209,0.10)`) | Eliminates all pastel/playful SaaS colors in favor of bullion metallic surfaces |

---

## 3. Signature Surface Recipes (From `user_web_dashboard_reference.jpeg`)

To replicate the tactile luxury of the mobile screen in [`user_web_dashboard_reference.jpeg`](file:///Users/mayaoflagos/correnthian/user_web_dashboard_reference.jpeg) across Habitline's bento cards:

### 3.1 The Bullion Gold Card Surface (`.card-bullion-gold`)
- **Background**: `linear-gradient(135deg, rgba(201, 162, 39, 0.20) 0%, rgba(138, 111, 28, 0.08) 45%, rgba(14, 16, 19, 0.94) 100%)`
- **Border**: `1px solid rgba(227, 199, 102, 0.38)`
- **Box Shadow**: `0 20px 50px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(227, 199, 102, 0.25)`
- **Usage**: Primary Gold holding cards, Hero portfolio showcase, Passkey Self-Custody feature card, and Primary CTA banners.

### 3.2 The Brushed Silver Card Surface (`.card-bullion-silver`)
- **Background**: `linear-gradient(135deg, rgba(232, 234, 237, 0.18) 0%, rgba(154, 160, 168, 0.08) 50%, rgba(20, 23, 26, 0.94) 100%)`
- **Border**: `1px solid rgba(199, 203, 209, 0.35)`
- **Box Shadow**: `0 20px 50px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(232, 234, 237, 0.22)`
- **Usage**: Silver (`XAG`) holding cards, Zero-Key Boundary security cards, and Network architecture cards.

### 3.3 The Obsidian Vault Glass Surface (`.card-obsidian-glass`)
- **Background**: `linear-gradient(180deg, rgba(29, 33, 38, 0.78) 0%, rgba(14, 16, 19, 0.95) 100%)`
- **Border**: `1px solid rgba(255, 255, 255, 0.08)` (hover transitions to `rgba(201, 162, 39, 0.40)`)
- **Backdrop Filter**: `blur(16px)`
- **Usage**: Floating Pill Navbar (`.nav-menu`), Three-Line Fee Breakdown inspector, FAQ accordions, and comparison matrices.

### 3.4 Primary & Secondary Buttons (`.button`)
- **Primary Button (`.button--gold`)**:
  - Background: `linear-gradient(135deg, #E3C766 0%, #C9A227 55%, #9E7E1E 100%)`
  - Text color: `#08090B` (Deep Obsidian, `font-weight: 600`)
  - Hover: Subtle metallic sheen shift + `0 0 28px rgba(201, 162, 39, 0.40)` glow.
- **Secondary Button (`.button--silver-outline`)**:
  - Background: `rgba(20, 23, 26, 0.85)`
  - Border: `1px solid rgba(199, 203, 209, 0.32)`
  - Text color: `#F5F6F8`

---

## 4. Typography & Numerical Hierarchy

Aligned with [`docs/agent/DESIGN_SYSTEM.md`](file:///Users/mayaoflagos/correnthian/docs/agent/DESIGN_SYSTEM.md) and [`packages/design-tokens/src/index.ts`](file:///Users/mayaoflagos/correnthian/packages/design-tokens/src/index.ts):
- **Primary UI & Body Sans (`--font-sans`)**: `'Plus Jakarta Sans'` / `'Inter'` — clean, high-legibility geometric grotesque for navigation, body copy, and interactive UI controls.
- **Editorial Authority Display (`--font-display`)**: `'Instrument Serif'` or tracked-out sovereign serif accent for select hero/section keywords (matching the authoritative `AURUM / CORRENTHIAN DIGITAL VAULT` crest in [`user_web_dashboard_reference.jpeg`](file:///Users/mayaoflagos/correnthian/user_web_dashboard_reference.jpeg)).
- **Monospace & On-Chain Verification (`--font-mono`)**: `'JetBrains Mono'` — used for composite asset IDs (`1:0x4580...EbAf78:paxos`), fine troy ounce / gram conversions (`1.0000 oz t = 31.1035g`), and 3-line fee tables (`font-variant-numeric: tabular-nums`).

---

## 5. GSAP + Framer Motion Choreography Specification (`MotionEnhancer.tsx`)

We preserve and refine the dual-engine animation architecture already wired into [`apps/marketing/src/components/wrappers/MotionEnhancer.tsx`](file:///Users/mayaoflagos/correnthian/apps/marketing/src/components/wrappers/MotionEnhancer.tsx):

1. **Restrained Sovereign Physics (No Bouncy Cartoon Springs)**:
   - In alignment with [`docs/agent/DESIGN_SYSTEM.md`](file:///Users/mayaoflagos/correnthian/docs/agent/DESIGN_SYSTEM.md) (`150ms–220ms`, `cubic-bezier(0.22, 1, 0.36, 1)`), all GSAP and Framer Motion transitions must feel **weighted, metallic, and deliberate** — like a precision watch or vault door, never bouncy or elastic.
2. **Hero 3D Vault Showcase (`data-gsap="hero-visual"`, `data-gsap="tilt-card"`)**:
   - Smooth 3D perspective mouse-tilt (`rotateX`/`rotateY` capped at `±4.5deg`) with a subtle moving specular gold highlight across the border rim.
3. **Scroll-Linked Bento Stagger (`data-gsap="stagger-grid"`)**:
   - As the user scrolls into the Backing Wedge (`About.tsx`), Bento Capabilities (`Features.tsx`), and 3-Line Fee Inspector (`SmartAssist.tsx`), cards rise `24px` with `power3.out` easing and a border illumination sweep from `#282D34` to `rgba(201,162,39,0.38)`.
4. **Reduced-Motion Accessibility (`prefers-reduced-motion: reduce`)**:
   - Automatically respected by `MotionEnhancer.tsx` — disables 3D tilt and parallax scrubbing while keeping instant opacity/focus clarity.
