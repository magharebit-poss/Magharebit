# End-to-end checks

All except the unit check need a dev server on its own cache folder (`NEXT_DIST_DIR=.next-test`, already listed in tsconfig) and real MongoDB in Docker (see `scripts/admin-smoke/README.md` for the container command). Chrome is used headless over CDP, no extra packages.

| Script | What it proves | Last result |
|---|---|---|
| `signup-e2e.mjs` | landing CTA -> phone OTP -> store details -> confirmation **showing the real trial key** -> portal session opened -> **license-gated download** (302 / 503 / login redirect / 403 after revoke) -> POS `validate` -> admin list (fr + ar). Start the server with `DOWNLOAD_WINDOWS_URL` set | 52 checks |
| `leads-e2e.mjs` | leads API: search, status rules, **server-side activation** (real MGH key, audit, merchant, POS `validate`), double-activation race | 33 passed |
| `leads-ui-e2e.mjs` | Leads page in the console shell (fr + ar), activation from the drawer, light/dark theme switch and persistence, 375 px layout | 26 passed |

| `license-token-unit.mjs` | Ed25519/JWT module: keys, claims, signing, the reference POS verifier, tamper/alg/kid/expiry/offline-window rules, rotation, and the contract test vector. No server needed. | 28 passed |
| `license-v2-e2e.mjs` | v2 server: jwks, activate, terminal limits (incl. an 8-way race), validate refresh, suspend toggle, extend, revoke, release, audit. Needs a server started with a signing key (see the file header); `NO_KEY=1` mode checks fail-closed behaviour without a key. | 63 passed (+4 fail-closed) |

| `merchants-licenses-ui-e2e.mjs` | Merchants + Licenses pages (fr + ar): filters, literal-regex search, suspend/reactivate switch, approve from drawer, terminal release, extend, revoke, viewer read-only, 375 px, audit entries. Needs a server with a signing key (see license-v2-e2e header) and `MONGODB_DB` set to the server's database. | 65 passed on `next start` (a dev-server run had 2 false timeouts from on-demand compiles) |
| `coupons-notifications-e2e.mjs` | Coupons + Notifications scaffolds: validation, roles, duplicate code, search, toggle, atomic redemption (8 concurrent on a limit of 2), queued notifications, audit. | 37 passed |
| `rate-limit-e2e.mjs` | Shared rate limiter with **two server instances on one database**: login limit enforced across both, 150 concurrent `validate` calls split over both admit exactly 120, hashed keys, TTL index, window reset. Start commands are in the file header. | 10 passed |

| `otp-delivery-unit.mjs` | OTP delivery layer (Infobip adapter) against a **mock** Infobip server: request shapes, `App` auth header, error mapping, timeout, config guards, provider selection. Proves our side only; the live Infobip test is a go-live step (see `src/lib/otp-delivery/infobip.ts`). No server needed. | 29 passed |
| `site-seo-leadmodal-e2e.mjs` | Production build: `<html lang/dir>` per locale, hreflang cluster, canonical, og:locale, JSON-LD graph (Morocco), sitemap alternates, 404; lead capture modal (fr + ar, desktop + 375 px, validation, DB row, Esc, exit-intent); auth shell and signup stepper. | see Phase 2 report |

| `phase3-admin-api-e2e.mjs` | Tipping, commission rates, catalog (shop types, cuisines, banners), notification status/resend, audit entries, old audit-log URL 308. Roles, validation, searches. | 90 passed |
| `phase3-admin-ui-e2e.mjs` | The new admin pages in Chrome (fr + ar): grouped sidebar, tipping steppers, commission save, catalog add/toggle/thumbnail, notification send/resend/status, audit timeline, viewer read-only, 375 px, dark theme. Run the API suite first (it resets the database). | 113 passed |
| `admin-nav-e2e.mjs` | Signs in and clicks all 12 sidebar page links (the Command Center is covered by the Phase 5 UI suite) twice (both orders) plus direct loads; fails on any console error, exception or failed request. Guards the "JSON.parse" navigation bug. | 76 passed |

| `downloads-unit.mjs` | `installerUrl()`: a configured URL wins; the placeholder exists only under `NODE_ENV=development`; production never fakes a URL. No server needed. | 6 passed |
| `download-dev-e2e.mjs` | `next dev` with no installer URLs: sign up through the API, get the trial key, download Windows and Android through the gated route, receive the clearly labelled placeholder file. | 10 passed |

| `phase5-unit.mjs` | Morocco day boundaries (incl. the Ramadan UTC+0 switch), CSV escaping (BOM, RFC 4180, formula guard), the XLSX writer (parts, RTL, frozen bold header, numbers vs text), Arabic-tolerant search patterns. No server needed. | 30 passed |
| `phase5-api-e2e.mjs` | Command Center metrics (today vs same time yesterday, 7 Morocco days, licenses, online/24 h terminals, 30 s cache + `fresh=1`), exports (roles, audit before download, CSV + XLSX, filters, no license keys or customer ids), global search (roles, Arabic variants, literal regex, status codes), no marketing chrome in admin HTML. Drops its database; start the server with `MONGODB_DB=magharebit_p5`. | 44 passed |
| `phase5-ui-e2e.mjs` | Command Center in Chrome (fr + ar): KPIs, chart order LTR/RTL, hover, table view, activity; Ctrl+K palette (pages, Arabic data search, arrows + Enter into a filtered table, Esc); Excel download; viewer cannot export; translated statuses, «الإكرامية», no WhatsApp/trust chrome; 375 px; dark theme. Run after the API suite. | 59 passed |

| `store-logo-e2e.mjs` | Merchant store logo: session required, type from the bytes (SVG/GIF/text refused), 512 KB cap, versioned public URL with year-long cache, 304, settings PATCH cannot set `logoUrl`, per-merchant isolation, delete, rate limit; settings page in Chrome (portal login with phone + key, a 1600x900 PNG is resized to a 512 px WebP, preview and sidebar avatar update without reload, survives reload, remove, GIF error). Drops its database; start the server with `MONGODB_DB=magharebit_logo`. | 32 passed |

| `site-links-e2e.mjs` | Every link on the public pages resolves: home (ar/fr/en) and `/fr/features`, desktop with both navbar menus opened by their chevrons, 375 px with the mobile menu expanded. Same-origin targets answer 200, every `#anchor` exists on its page, no `#`/empty links; navbar labels are links and Escape closes the menu. Read-only (GETs), no database. | see the Phase 7 report |

**Run E2E against a production build, not `next dev`:** `NEXT_DIST_DIR=.next-test npx next build` (nothing else may touch that folder while it builds), then `npx next start -p 3021` with the same env. Rate limits are stored in MongoDB (`rate_limits`), so they survive a server restart: the scripts drop their database at start, which also clears them.

Warm the pages first (first compile can take minutes on a slow machine), start a **fresh** database per run.
