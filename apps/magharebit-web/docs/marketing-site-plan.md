# Public site: layout fix, rich-media components and routing

**Status (30/10/2026): approved and delivered** with the defaults in section 3, except D2: Partenaires/Carrières
are **hidden** until real pages exist (the coordinator's "hide temporarily" option), not built as empty pages.

## How to add the real media (no code change beyond one line each)
- **Screenshots:** save the file in `public/media/` at the size listed in `src/content/media.ts` (no device frame
  in the image; the site draws it) and set that slot's `src`, e.g. `src: '/media/pos-sale.webp'`.
  Slots: `pos-sale` (desktop till, 1600×1000), `tablet-order` (1600×1200), `phone-pos` (780×1688),
  `portal-dashboard` (laptop, 1600×1000).
- **Video:** set `NEXT_PUBLIC_DEMO_VIDEO_URL` (Vercel env + local `.env.local`) to a YouTube or Vimeo link, or a
  same-origin `/media/….mp4`. Rebuild. Optional cover: `DEMO_VIDEO.poster` in the same file.

## What was built
| Piece | File | Where |
|---|---|---|
| Media manifest + video URL parser | `src/content/media.ts` | everywhere |
| Device frames (desktop till, laptop, tablet, phone) with sketched placeholder screens | `src/components/landing/DeviceFrame.tsx` | showcase |
| Video section (cover + play) and the dialog player (native `<dialog>`, click-to-load, youtube-nocookie) | `VideoSection.tsx`, `src/components/VideoModal.tsx` | home, after the hero; the hero's ▶ button uses the same dialog |
| Feature bento (8 tiles, 12-column grid, illustrations in the large tiles), keeps `#products` | `FeatureBento.tsx` | home (replaces `IntentCards`) |
| Product showcase (4 alternating rows: till, tablet, phone, portal) | `ProductShowcase.tsx` | home (replaces `FeatureStories`) and `/features` |
| Navbar: "Produits"/"Secteurs" are links, chevron button opens the menu (Esc / click outside close); menu items go to `#inventory` / `#ai` | `Navbar.tsx` | all public pages |
| Footer: Partenaires/Carrières hidden, Analytique → `/features#ai` | `Footer.tsx` | all public pages |
| Link guard | `scripts/e2e/site-links-e2e.mjs` | test |

---

Continues `docs/landing-ux-plan.md` (media specs, Inyad teardown). That plan's decisions D1-D6 are still open;
this one is scoped to what the coordinator asked for on 30/10/2026: rich-media components **with placeholders**
now, real assets later.

## 0. Done in this update (no approval needed: it was a bug)

What was actually broken, measured on `/fr/clients` at 1440×880:
- **The white strip.** `TrustRibbon` ("✓ Conçu pour le Maroc | Support en Darija…") was rendered by the root
  layout **after** every page, i.e. below the footer, on `<body>`, which is white. Its text is 70 % white, so it
  was close to invisible (the blue boxes in the report are a text selection). The dark `TrustBar` came right
  after it, repeating the same claims, and both also showed on the auth pages, which have no footer.
- **Header/footer.** No overlap in the layout itself: the page is 3053 px, the footer follows it normally. The
  navbar is `position: fixed` (64 px), so at the bottom of the scroll it covers the first footer lines, as
  any fixed header does. What *was* missing is a floor for short pages and a dark background behind them.

Fix:
- `TrustRibbon` and `TrustBarConditional` deleted. **One** trust bar now renders inside `Footer` (top band),
  so it only appears on pages that have a footer, and always above it. Separators use `border-inline-end`
  (correct in Arabic).
- The ribbon's "Données stockées au Maroc" claim is gone with it. **Do not re-add it unless it is true**: the
  database is MongoDB (Atlas region not confirmed here) and hosting is Vercel.
- `globals.css`: public pages (`<main>` directly in `<body>`) get the dark shell background and
  `main { min-height: 100dvh }`, so a short page pushes the footer below the fold. Admin, portal and auth wrap
  their content in a layout div, so they are untouched (checked: portal body stays white).

Checked: `/fr/clients` ends exactly at the footer bottom with the bar above it; `/fr/status` and the 404 page
fill the screen on dark; nothing renders after any footer.

## 1. Link audit (all Navbar + Footer links, against the routes that exist)

Every link resolves to a real route and every sector slug exists, so most of the site is not "dead". The real
problems:

| Where | Link | Problem | Proposed fix |
|---|---|---|---|
| Footer → Entreprise | Partenaires, Carrières | `href="#"`, no page | **Build** `/partners` and `/careers` (standard layout, placeholder copy, contact CTA), or drop the links (D2) |
| Footer → Produits | Analytique | `/features#analytics`, no such anchor (the page has `inventory`, `waste`, `qr`, `ai`, `whatsapp`, `offline`…) | Give the analytics content on `/features` an `id="analytics"`, adding a short section if there is none |
| Navbar → Produits menu | Gestion des stocks, Rapports | both land on the top of `/features` | `/features#inventory`, `/features#analytics` |
| Navbar | "Produits", "Secteurs" labels | open a hover menu only; a click goes nowhere | Label becomes a link (`/features`, `/sectors`); the chevron toggles the menu (keyboard and touch) |

Plus an automated guard: `scripts/e2e/site-links-e2e.mjs` crawls the navbar, mobile menu and footer in ar/fr/en,
asserts every target is 200 and every `#anchor` exists on its page.

## 2. Rich-media components (built now, with honest placeholders)

All are server-rendered where possible, RTL-mirrored, `prefers-reduced-motion` aware, and reserve their space
with `aspect-ratio` (no layout shift when an image arrives).

| Component | What it does | Where |
|---|---|---|
| `DeviceFrame` | CSS frames for **desktop POS / tablet / phone / laptop (portal)**. Takes a screenshot `src`; without one shows a branded placeholder naming the expected shot and size (e.g. "POS – écran de vente · 1600×1200") | Inside the next two |
| `MediaSlot` + `src/content/media.ts` | One manifest of every visual on the site (id, alt in ar/fr/en, size, file). Dropping a file in `public/media/` and setting its path is the whole "upload" step; `next/image` serves AVIF/WebP, lazy below the fold | Everywhere |
| `VideoSection` | Poster + play button opening the existing in-page `<dialog>` player. **YouTube/Vimeo: click-to-load** (no third-party request until the visitor clicks; `youtube-nocookie`), or HTML5 `<video>` with captions when we self-host. Fixes the gaps listed in `landing-ux-plan.md` §2 (focus trap/return, localized labels, RTL close button) | Home, right after the hero |
| `ProductShowcase` | Alternating feature rows: device frame on one side, title + 3 bullets + link on the other; sides swap per row and mirror in RTL. Rows: caisse (desktop), tablette, application mobile, back-office (portal) | Home (replaces the text-only feature stories) and `/features` |
| `FeatureBento` | 12-column bento grid of icon cards, some with an image slot (2×1 tiles for the hero features: offline, WhatsApp report, stock, multi-store) | `/features` top, home "why MAGHAREBIT" |

What placeholders will **not** be: fake screenshots, AI "customers", invented logos or numbers.

## 3. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | Video hosting | **YouTube or Vimeo now** (you upload, I paste the ID), click-to-load. Self-hosted MP4 on a CDN later if wanted |
| D2 | Partners / Careers | **Build the two pages** with placeholder copy, so the links work and marketing can fill them |
| D3 | Who provides screenshots | POS/tablet/mobile: the POS team. Portal and admin: **I can capture them** from the running app with demo data (no real merchant data) |
| D4 | Home page length (already 15 sections) | Video section added; `ProductShowcase` **replaces** `FeatureStories`; bento **replaces** `IntentCards`. Net +1 section |

## 4. Delivery after approval

1. Routing fixes + link-check test.
2. `DeviceFrame`, `MediaSlot`, media manifest.
3. `VideoSection` (dialog fixes included).
4. `ProductShowcase` + `FeatureBento` on home and `/features`.
5. QA: ar/fr/en, 375 / 768 / 1440 px, keyboard, reduced motion, Lighthouse (mobile LCP ≤ 2.5 s, CLS ≤ 0.1), screenshots.
