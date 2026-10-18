# MAGHAREBIT brand handoff for the POS (Logiciel) team

**Status: DRAFT. Prepared by the web team. Not yet sent to, or acknowledged by, the POS developer.**
Source of truth for visuals: `board_final.png` (design workspace) and `apps/magharebit-web` (branch `feat/magharebit-brand`).

## Read first: five things that need a decision or correction

These were found by reading the POS code (`apps/pos-web`, `apps/pos`) and the root `AGENTS.md`. Please resolve them before restyling anything.

1. **Token names were mislabeled in the request.** On the board, `#0A2318` is *Deep Forest* (`brand-950`) and `#0F3D2A` is *Pine Green* (`brand-900`). "Mint" is `#F0FDF6` (`brand-50`). The gold `#F0B429` is our custom `gold-400`; Tailwind's built-in `amber-400` is `#FBBF24`, a different color. Use `brand-tokens.json` (next to this file), not the Tailwind names from chat.
2. **The root `AGENTS.md` design system differs from this identity.** It specifies primary `#2E8B57`, accent `#FF9800`, background `#F5F5F0`. Current POS usage: `#2E8B57` x169 and `#FF9800` x11 in `pos-web`; pine/gold appear less (`#F0B429` x68, `#0A2318` x36, `#0F3D2A` x25); `apps/pos` (React Native) uses neither pine nor gold. Adopting this identity in the POS changes a documented rule. The repo owner should approve it and update `AGENTS.md`; this handoff does not override it.
3. **Product name is split.** Tauri `productName` is "GreenGo POS" (identifier `ma.magharebit.greengo-pos`), the PIN screen i18n says "GreenGo POS", while Capacitor says "MAGHAREBIT POS" and the activation screen says "MAGHAREBIT". Decide the customer-facing name before swapping logos.
4. **Fonts.** `pos-web/src/app/layout.tsx` loads Cairo and Inter from `fonts.googleapis.com`. `AGENTS.md` says no external font downloads, and the POS must work offline. Bundle the font files locally (or use the system stack). Note the web site has the opposite gap: Inter is referenced but never loaded.
5. **Receipts.** Printing is 80mm ESC/POS over WebUSB (`pos-web/src/lib/printer/escpos.ts`, CP1256). That builder has **no raster-image command**, and `Receipt.tsx` prints the *merchant's* logo (`branding.logoUrl`), not ours. A Magharebit mark would only be an optional "powered by" footer, and needs a new `GS v 0` raster routine. `assets/emblem-mono.svg` and the 1-bit PNGs were derived by the web team from the approved emblem and **have not been approved by design**.

## Tokens
See `brand-tokens.json`. Short version: Deep Forest `#0A2318` (background), Pine Green `#0F3D2A` (cards), Moroccan Gold `#F0B429` (accent/action), Deep Ochre `#B8860B` (accent on light), Surface Mint `#F0FDF6`, white `#FFFFFF`, light surface `#F8F9FA`, text `#111827` / `#6B7280`.
Fonts: Plus Jakarta Sans (Latin display), Cairo (Arabic display), Noto Naskh Arabic (Arabic body), Inter (UI). Western digits (0-9) everywhere, including Arabic.

## Assets (`assets/`)
| File | Use |
|---|---|
| `emblem-light.svg` | Shield emblem for **dark** screens/headers |
| `emblem-dark.svg` | Shield emblem for **light** surfaces |
| `logo-horizontal-dark.svg` / `logo-horizontal-light.svg` | Lockup (emblem + MAGHAREBIT + Arabic wordmark) for dark / light backgrounds. Arabic wordmark curve repaired |
| `emblem-mono.svg` | Black emblem, star knocked out, for white paper (derived, unapproved) |
| `emblem-mono-192w.png`, `emblem-mono-128w.png` | 1-bit rasters (0/255 only) for thermal printing; widths are in dots (80mm head = 576 dots) |
| `zellige-pattern.svg` | Ambient background lattice, tile 368 x 506.7 |
| `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.ico` | App icon set (opaque, maskable-safe) |
| `icon-1024.png` | Master for `tauri icon` and Android adaptive-icon generation |

Rule: pick by **background**, not by file suffix. `emblem-light` and `logo-horizontal-dark` are both for dark backgrounds.

## Alignment scope, with what the POS code looks like today
1. **Login / lock / activation screens.** `ActivationScreen.tsx` draws a 44px gold rounded square containing the letter "م" plus a text wordmark. The PIN screen's i18n title is "🌿 GreenGo POS" (its markup was not inspected). Replace the legacy marks with the emblem at **84px** with the web login's glow: `filter: drop-shadow(0 0 32px rgba(240,180,41,0.45))`, bundled locally (no remote image).
2. **Sidebar / nav dock.** I did not find a shared logo header component in a quick scan of `pos-web`; the POS developer should locate or create it. Use the horizontal lockup at 28-32px height on dark. At 28px the lockup's Arabic line is very small; prefer 32px, or the emblem alone.
3. **Receipts / Z-reports.** See item 5 above. Needs a decision first, then a raster routine; do not change merchant-logo behavior.
4. **App icons.** Android has legacy `ic_launcher*` and Tauri has a full legacy `src-tauri/icons/` set. Regenerate from `icon-1024.png`; the 16px favicon frame is blurry because the design team has not delivered the small-size cut.
5. **Zellige on lock/idle screens.** The stroke is pine, so it vanishes on dark backgrounds; use it as a mask over gold at 4-6% opacity, behind content only:
   ```css
   .zellige-bg { position:absolute; inset:0; pointer-events:none; z-index:0;
     background-color:#F0B429; opacity:.05;
     -webkit-mask-image:url('zellige-pattern.svg'); mask-image:url('zellige-pattern.svg');
     -webkit-mask-repeat:repeat; mask-repeat:repeat;
     -webkit-mask-size:368px 506.7px; mask-size:368px 506.7px; }
   ```
Keep existing POS rules (RTL logical properties, 48dp touch targets, no animation on the checkout path).

## Acknowledgment checklist (to be filled by the POS developer)
- [ ] Received the package  - name: ______  date: ______
- [ ] Decided product name (GreenGo POS vs MAGHAREBIT POS)
- [ ] Owner approved palette change; `AGENTS.md` design-system section updated
- [ ] Fonts bundled locally
- [ ] Decision on receipt branding (merchant logo only vs powered-by footer)
- [ ] Icons regenerated from `icon-1024.png`
