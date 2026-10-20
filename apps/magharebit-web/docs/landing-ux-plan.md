# Landing page: Architecture & Media Implementation Plan

**Status: DRAFT for coordinator approval. No frontend code has been written for this plan.**
The only code change made so far is the Step 1 deletion (the hero's YouTube text link), uncommitted.

---

## 0. Decisions needed from you (everything below depends on these)

| # | Decision | My recommendation |
|---|---|---|
| D1 | Approve consolidating the page from **20 sections to 12** (section 3 below). This removes existing sections | Approve |
| D2 | Hero visual approach: **AI loop as ambience + real UI overlay** vs. a pure real screen recording | AI ambience + real UI (section 5.4) |
| D3 | Where media is stored. About 40 MB of video would bloat git | Object storage/CDN with immutable URLs, not git |
| D4 | **Higgsfield plan and budget.** The account is on the **free plan with 8 credits** | Upgrade before any batch; get a quote per batch (section 6) |
| D5 | Merchant imagery: AI people vs. real photos with consent | Real photos for people; AI only for hardware and ambience |
| D6 | Proof numbers (500+ stores, 99.9% uptime, 4.9 rating): are they real? | Show only verified numbers |

---

## 1. Inyad deconstruction (what I actually observed on inyad.com/fr)

Observed at 1440px and 390px. Layout and technique only; none of their copy or imagery is reused.

| Brief assumed | What the page actually does |
|---|---|
| "Dynamic hero: hardware + software integrated mockup with ambient glow" | **Text-led hero**: big headline, one paragraph, two CTAs (filled + outline), a microcopy line ("free demo, no commitment, in your language"). Below it a **curved mosaic wall of ~60 merchant/sector photos** fading at the edges. No device mockup, no glow |
| "Live micro-interactions" | **No `<video>`, no Lottie, no `<canvas>`.** Motion is ~30 CSS entrance animations (0.35 s) with 7 `prefers-reduced-motion` rules |
| "Hardware visualized in real commercial contexts" | One small payment-terminal product photo inside a card. People-in-context imagery appears only in the hero mosaic |
| Problem/solution blocks | **Yes, but static**: an intent-first product grid ("I work from a notebook", "I sell at the counter"...), and a dark **"Without / With"** split card (broken vs. connected icon chain, crosses vs. ticks) |
| (not in brief) | Sector cards, quote-style testimonials with name/role/city (one is an offline-outage story told in text), FAQ, closing CTA |

Structure: **11 `h2` sections, 7,433 px tall on desktop, 8,703 px on mobile.**
Tech: 83 images, **82 lazy-loaded**; WebP 51, AVIF 18, SVG 14; no `srcset`; ~2.1 MB transferred by mid-page; fixed floating pill nav; no sticky mobile CTA.

**Takeaways to borrow:** intent-first framing; the Without/With contrast; a single dominant promise in the hero; short page; lazy images; reduced-motion respect.
**Where we can beat them:** real hardware in real Moroccan contexts, motion that demonstrates our moat (offline-first), and an Arabic-first RTL experience. They have none of these on this page.

---

## 2. Where we are today

- **20 sections**, many overlapping: 3 waste/ROI blocks (WasteCalculator, RoiTeaser, WasteTracker), 3 comparison blocks (ComparisonSection, WhyNotCompetitors, LoyverseCounter), 3 proof blocks (ProofBar, MetricsSection, Testimonial), 2 closing CTAs (DemoForm, CTASection).
- Hero is **pure HTML/CSS** (no `<img>`/`<video>`); the secondary "▶ See how it works" button already opens an in-page `VideoModal`.
- `VideoModal` embeds an **external iframe** when `NEXT_PUBLIC_DEMO_VIDEO_URL` is set, otherwise shows "coming soon". Gaps: no focus trap or focus return, English-only `aria-label`, `right: 12px` close button (not RTL-aware).
- **0 `prefers-reduced-motion` rules** in `globals.css` despite several infinite animations (float, shimmer, pulse, ticker).
- `next.config.ts` already serves `.mp4`/`.webm` with range requests (`max-age=86400`; should become immutable once files are hashed).
- `public/` is 128 KB today.

---

## 3. Proposed section order and responsive flow

| # | Section | Job | Media | Existing component → action |
|---|---|---|---|---|
| 1 | **Hero v2** | Convert | Loop **A1** inside a device stage, ambient pine/gold glow, zellige at 5%, two floating stat chips | HeroSection → rebuild the stage; keep copy and both CTAs |
| 2 | Proof strip | Trust | None (verified numbers only) | ProofBar + MetricsSection → merge into one |
| 3 | **Intent cards** | Route the visitor | None | ProductsSection → rework as "I sell at the counter / I track stock / I watch from my phone / I can't lose a sale offline" |
| 4 | **Feature stories ×4** | Problem → solution | Clips **C1, C2, C3** + a coded offline animation | SalesFlowDiagram + HowItWorks content → fold into new `FeatureStory` blocks |
| 5 | **Hardware showcase** | Make it tangible | Renders **R1-R3** (+R4/R5), context tabs Boulangerie / Café / Épicerie | New `HardwareShowcase`; absorbs SectorsPreview; links to /materiel |
| 6 | Without / With comparison | Differentiate | None | ComparisonSection + WhyNotCompetitors + LoyverseCounter → merge |
| 7 | WhatsApp report preview | Differentiator | Static UI | Keep |
| 8 | ROI tool | Quantify | None | Keep **WasteCalculator** only; drop RoiTeaser and WasteTracker; move here from directly under the hero |
| 9 | Pricing | Decide | None | PricingSection, keep |
| 10 | Testimonials | Proof | None | Keep; **real quotes only** |
| 11 | FAQ | Objections | None | HomeFaqSection, keep |
| 12 | Final CTA + demo form | Convert | None | DemoForm + CTASection → merge |

Footer and StickyCtaBar stay (sticky bar mobile-only, appearing after ~600 px of scroll).
**Targets:** desktop ≤ 6,500 px, mobile ≤ 8,000 px (Inyad: 7,433 / 8,703). I have not measured our current height; phase 0 does that.

**Responsive behaviour**
- **Breakpoints:** 375 / 768 / 1024 / 1440. RTL-first, logical CSS properties throughout.
- **Hero:** ≥1024 two columns (text on the start side, stage on the end side). <1024 stacked: headline → sub → CTAs → stage. Stage has a fixed aspect box (16:10 desktop, 4:3 mobile) so nothing shifts when media loads.
- **Hardware grid:** desktop 12-col bento (R1 six columns, R2 and R3 three each); tablet 2 columns; mobile horizontal scroll-snap carousel with dots. Context tabs become horizontal chips.
- **Feature stories:** alternate start/end on desktop (mirrored automatically in RTL); mobile text first, clip below.

---

## 4. Replacement for the removed YouTube button: the in-page video dialog

The hero's existing "▶ See how it works" button stays and opens a **self-hosted video dialog**. Nothing routes off the page.

- Native `<dialog>` (free focus trap and Esc), focus returns to the trigger, scroll lock, pause on close.
- `<video controls playsinline preload="none" poster>` with MP4 and WebM sources and a `<track kind="captions">` per language (WebVTT ar/fr/en). No autoplay with sound.
- Per-locale source: `demo-ar`, `demo-fr`, `demo-en`; falls back to Arabic, then to "coming soon" if no file exists.
- Close button positioned with logical properties; localized `aria-label`.
- **Remove the iframe path** and deprecate `NEXT_PUBLIC_DEMO_VIDEO_URL` in favor of `NEXT_PUBLIC_DEMO_VIDEO_SRC` (same-origin or our CDN).
- A play badge on the hero stage opens the same dialog.
- Footer social links (including YouTube) are outside the conversion funnel and are not changed by this plan.

---

## 5. Media manifest (asset specifications)

### 5.1 Global rules
Silent (no audio track), no on-screen text generated by AI, no real brand logos (Epson, PAX, Sunmi and so on), palette Pine `#0A2318`, Gold `#F0B429`, Mint `#F0FDF6`; warm 3200-3800 K light. **Keep the subject within the centre 70% of the frame** so 16:9, 4:3 and 1:1 crops all work.

### 5.2 Assets

| ID | Asset | Ratio | Generate at | Deliver (px) | Length / fps | Size budget | Formats |
|---|---|---|---|---|---|---|---|
| **A1** | Hero loop: POS in a Moroccan café | 16:9 | 1080p, 1920×1080 | 1920×1080 and **1280×720** (mobile/tablet) | 6 s (range 5-8), 30 fps | 1080: MP4 ≤ 2.2 MB, WebM ≤ 1.6 MB. 720: MP4 ≤ 1.0 MB, WebM ≤ 0.75 MB | MP4 H.264 High (`yuv420p`, `+faststart`, no audio) + WebM VP9 |
| A1-poster | Poster / LCP image | 16:9 | frame 1 of A1 | 1920×1080 + 1280×720 | n/a | AVIF ≤ 120 KB | AVIF + WebP fallback |
| **R1** | Desktop POS screen (all-in-one on a counter), blank screen | 4:3 | highest res offered (4K requested) | master PNG; **1600×1200** + 800×600 (alpha) | n/a | AVIF ≤ 140 KB at 1600w | PNG master, AVIF + WebP with alpha |
| **R2** | Mobile POS (phone/handheld), blank screen | 4:3 | as R1 | as R1 | n/a | as R1 | as R1 |
| **R3** | 80mm ESC/POS thermal printer with a short receipt strip | 4:3 | as R1 | as R1 | n/a | as R1 | as R1 |
| R4 (optional) | Barcode scanner + cash drawer | 4:3 | as R1 | as R1 | n/a | as R1 | as R1 |
| R5 (optional) | Generic scale (we support DIBAL/CAS/Brecknell protocols) | 4:3 | as R1 | as R1 | n/a | as R1 | as R1 |
| **C1** | Rapid barcode scan (hand, scanner, product; screen not shown) | 4:3 | 1080p crop | **1280×960** + 960×720 | 5 s, 24 fps | MP4 ≤ 0.9 MB, WebM ≤ 0.65 MB | MP4 + WebM + AVIF poster ≤ 70 KB |
| **C2** | Instant receipt print (printer ejects a receipt; paper text illegible) | 4:3 | as C1 | as C1 | 5 s, 24 fps | as C1 | as C1 |
| **C3** | Real-time dashboard analytics | 4:3 | **screen recording, not AI** | 1280×960 | 5 s, 24 fps | as C1 | as C1; **localized ar/fr/en** |
| C4 (recommended) | Offline resilience: connection drops → "offline · 14 queued" → syncs | n/a | **coded UI animation, not video** | n/a | n/a | 0 KB video | CSS/JS in the page |
| **D1** | Demo video for the dialog | 16:9 | **screen recording + voice/captions** | 1920×1080 + 1280×720 | 45-60 s, 30 fps | 1080 MP4 ≤ 10 MB, 720 ≤ 5 MB | MP4 + WebM + WebVTT ar/fr/en + poster; **per locale** |

`R1`-`R3` are rendered on a flat neutral backdrop, then cut out with background removal, so they sit on our dark sections with the glow behind them.
Cutouts and clips both ship with a poster; the poster is what loads first.

### 5.3 Encoding pipeline (post-generation, mine to run)
`ffmpeg`: MP4 `-c:v libx264 -profile:v high -pix_fmt yuv420p -crf 23 -movflags +faststart -an`; WebM `-c:v libvpx-vp9 -crf 34 -b:v 0 -an`; posters via `-frames:v 1` then AVIF/WebP. Verify each loop by comparing the first and last frames.

### 5.4 The honest limit of AI video for a POS product
AI models **cannot render faithful Arabic/Latin UI text or correct numbers**, and a fake-looking POS screen hurts credibility with merchants. So:
- AI produces **environment, hands, hardware and light**, with screens left blank or dark.
- **Real UI** (from our actual portal/POS) is overlaid as HTML inside a CSS device frame (hero) or recorded (C3, D1).
- Hero A1 is therefore an ambient plate; the glowing device stage with live UI sits in front of it.

### 5.5 Prompt skeletons (to be refined at generation time)
- **A1:** "Locked-off cinematic shot, Moroccan café counter at golden hour, zellige tile backsplash, a barista's hands tapping a tablet POS on a stand, deep pine-green cabinetry, warm gold rim light, shallow depth of field, steam rising, screen dark, no readable text, no logos, no watermark, seamless loop, last frame matches first frame."
- **R1-R3:** "Studio product render on a seamless light-gray backdrop, soft top-left key light, three-quarter view, blank screen, generic unbranded design, no logos, no text, sharp edges for clean cutout."
- **C1/C2:** "Close-up, shallow depth of field, hands scanning a packaged product / thermal printer ejecting a plain receipt strip, bakery counter, warm light, no readable text, no logos, 5 second loop."
- **Negative prompt (all):** text, letters, logos, watermark, extra fingers, distorted hands, flicker, camera shake.

---

## 6. Higgsfield execution plan

**Capabilities found (read-only lookup, nothing generated):**

| Model | Video | Notes |
|---|---|---|
| Seedance 2.5 (ByteDance) | 4-30 s, 480p/720p/1080p, ratios 16:9, 9:16, 1:1, 4:3, 3:4, 21:9 | `start_image` **and** `end_image` supported → seamless loops; `generate_audio:false`; **480p draft mode** (finalize within 7 days) |
| Seedance 2.0 | 4-15 s, up to 1080p/4K in `std` mode | `std` mode needs a **Plus plan** |
| Gemini Omni Flash | 4-10 s, 720p only, 16:9/9:16 | Too low-res for the hero |
| Marketing Studio video | 12-15 s only | Wrong length |
| Images: Nano Banana 2.1 / 2 / Marketing Studio Image | 1k / 2k / 4k, ratios incl. 4:3, 3:2, 16:9 | Photoreal product renders |

**Blockers:** free plan, **8 credits**; commercial-use terms on the free tier not confirmed. Nothing will be generated until you approve a plan and a budget.

**Workflow:** (1) get a cost quote for the batch; (2) generate **480p drafts** first and review; (3) finalize only the approved ones at 1080p; (4) loop technique = same still as start and end frame; (5) encode, check first/last frame, and run the acceptance list.

**Acceptance checklist per clip:** no text artifacts, no logos, clean hands, loops without a jump, palette within brand, centre-70% safe area, file within budget.

**Legal/brand:** no real brand marks; label illustrative imagery where it implies a real store; verify the plan permits commercial use; no AI-generated "customers" presented as real testimonials.

---

## 7. Delivery phases (each needs your go-ahead)

0. **Baseline:** measure current page height, LCP and total bytes (desktop + mobile). Add a global `prefers-reduced-motion` policy.
1. **Assets:** Higgsfield batch (after D4), screen recordings, encoding, posters.
2. **Hero v2 + video dialog.**
3. **Feature stories (C1-C4).**
4. **Hardware showcase.**
5. **Consolidation** (remove merged sections) + QA.

**Performance and accessibility acceptance:** mobile LCP ≤ 2.5 s (poster preloaded with `fetchpriority="high"`); CLS ≤ 0.1; added JS ≤ 15 KB gzipped (native `<dialog>` and `IntersectionObserver`, no new libraries); only one clip plays at a time; videos load `preload="none"` and start when in view; **`prefers-reduced-motion` and `Save-Data` → poster only**; every loop longer than 5 s has a visible **pause control** (WCAG 2.2.2); captions for D1; keyboard, screen-reader and RTL checks; the network panel shows only same-origin or our CDN requests.

## 8. Risks and open questions
- Unverified proof numbers on the page today (see D6).
- Localized recordings multiply work: C3 and D1 in three languages.
- Removing 8 sections is a content decision with SEO implications; keep URLs and headings the pages already rank on.
- Whether Higgsfield output at "4K" is truly 4096 px wide needs checking at generation time.
