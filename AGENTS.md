# GreenGo POS — Engineering Rules (AGENTS.md)

## Verdent Execution Rules (added after native folder failure)

BEFORE marking any story complete that involves:
- React Native: verify android/ folder exists with gradlew
- Next.js i18n: verify locale resolves to a non-undefined
  value before importing JSON
- Any new npm package: verify the import path compiles
  with tsc --noEmit before claiming success

NEVER claim a mobile story complete without confirming:
  apps/pos/android/gradlew EXISTS
  apps/pos/android/app/build.gradle EXISTS
  apps/pos/index.js EXISTS with AppRegistry.registerComponent

## Project Identity

- GreenGo is a B2B SaaS Unified Commerce POS and Inventory Management platform specializing in fresh produce, juices, and perishables.
- Platform: Android (React Native PWA), PostgreSQL 17 with pg_uuidv7, RxDB + SQLCipher 4.x (local), Node.js Fastify (backend API), Next.js (admin dashboard + public web portal).
- Architecture model: B2B SaaS, Multi-Tenant (schema-per-tenant + RLS), Offline-First.
- Parent company: Wayloz. Development team: Verdent.ai.
- Target market: Morocco. Languages: Arabic, French. Currency: MAD.

## Pipeline Rules (Verdent-Specific)

- Default mode: Quality Mode unless I explicitly say Speed Mode.
- Always use the Plan → Code → Verify pipeline for every task.
- In Plan stage: output the list of files to be created/modified and the logic approach BEFORE writing any code.
- In Code stage: write code only after Plan is approved.
- In Verify stage: run the relevant CI gate checklist (Section 6) against your own output before marking a task done.
- Never combine Plan and Code in a single response.
- Never re-read the uploaded Blueprint .docx files. All rules are encoded in this file.
- AGENTS.md is the single source of truth for all engineering sessions.

## The 5 Architectural Laws (Non-Negotiable)

### LAW 1 — SOFT ALLOCATION (ADR-003)

- Never use pure CRDT for inventory deductions. CRDT handles non-bounded data only (catalog, customers, shift metadata).
- All BOM deductions: local allocated_stock reservation first → pending_deductions queue → backend adjudication sorted by UUIDv7 timestamp → correction_events returned on sync.
- Negative stock is architecturally impossible. If a deduction would produce negative stock locally: warn cashier, require manager PIN, log the override. Never silently allow it.
- Stock floor is per-SKU per-store, configured in Super-Admin. Default: 10% of average daily sales. Breach triggers UI badge + audio cue + manager alert.

### LAW 2 — HARDWARE SERVICE BOUNDARY (ADR-004)

- :hardware-service is a sealed Gradle module. It owns all hardware I/O: printer (ESC/POS), scale (BLE/USB 200ms poll), payment terminal (PAX SDK IPC), barcode scanner.
- apps/pos imports ONLY packages/hardware-client/HardwareClient.ts for hardware interaction. Zero other hardware imports permitted.
- All UI↔hardware communication: WebSocket on localhost:7730 exclusively.
- HardwareIOService is START_STICKY, started by BootReceiver, survives WebView crash. PrintQueue is SQLite-backed (separate from RxDB).
- If any task requires a hardware import in apps/pos: output CONFLICT DETECTED and stop.

### LAW 3 — SQLCIPHER (ADR-002)

- RxDB uses SQLCipher 4.x adapter. AES-256-CBC. Active in every environment: dev, staging, production. No plaintext fallback exists anywhere.
- Key derivation: HKDF-SHA256(input: ANDROID_ID || tenant_license_hash, salt: app_install_uuid, info: 'greengo-rxdb-v1'). Key never written to disk. Derives at boot from hardware-backed Android Keystore.
- PRAGMA cipher_page_size = 4096, PRAGMA kdf_iter = 256000. These values are locked and must not be reduced.
- CI gate 01 asserts the raw .db file is NOT readable as plaintext SQLite. This test is never skipped or marked pending.
- On license revocation: tenant_license_hash changes → all local encrypted databases become permanently unreadable.

### LAW 4 — RETURNS STATE MACHINE (Addendum §1)

- Returns follow: RETURN_INITIATED → TIME_CHECK → INSPECTION_PENDING → RESTOCK_APPROVED | WASTE_ROUTED → terminal state.
- Time window: 30 minutes (1800 seconds) from original server_received_at only. Client timestamp is never used for this calculation.
- Manager PIN is a non-bypassable gate for RESTOCK_APPROVED. No code path completes a restock without manager_approved_by.
- Failure of time OR PIN → auto WASTE_ROUTED with no cashier override. waste_records entry created automatically.
- returns table has: elapsed_seconds GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (initiated_at - original_server_received_at))), immutable route ENUM('RESTOCK','WASTE'), manager_pin_verified_at field.
- Implement as an explicit state machine, not if/else branches.

### LAW 5 — PCI P2PE (ADR-007)

- PAN data never enters GreenGo code, database, or logs. Ever. This is architectural, not configurable.
- Encryption happens inside the CMI-certified hardware terminal before any data leaves the terminal chip.
- GreenGo stores only the tokenized CMI transaction reference. No card numbers, no track data, no CVV.
- CI gate 02 scans all files for card_number, pan, track_data, cvv strings. Any hit blocks the merge.
- CMI offline floor limit: if transaction > offline_floor_limit AND register is offline → payment declined (card). Cash-only fallback. Forced offline above floor is a contractual violation logged to Super-Admin.

## Module Boundary Contract

| Module | Owns | Forbidden |
|---|---|---|
| android/hardware-service | All hardware I/O, PrintQueue, ScalePoller, PaymentTerminalBridge, WebSocketHardwareServer :7730 | React, RxDB, business logic, UI |
| packages/local-db | RxDB schema, SQLCipher init, soft-allocation, pending_deductions queue, UUIDv7 generator | Hardware libs, direct API calls, UI |
| packages/uom-engine | uom_convert(), conversion tables, UoM types, cross-family density logic | Everything else |
| packages/hardware-client | WebSocket client wrapper HardwareClient.ts, message type definitions | Direct hardware libs, native Android APIs |
| packages/shared-types | TypeScript types shared across packages (returns, inventory, license, hardware messages) | Implementation logic |
| apps/pos | UI components, cart engine, screens, HardwareClient import only | Hardware libs, direct DB access, backend logic |
| apps/admin | Super-Admin dashboard: tenants, licenses, subscriptions, store health, returns analytics | POS logic, hardware |
| apps/web | Public marketing portal: landing, pricing, demo, client portal | POS logic, admin logic |
| backend | Sync API, deduction adjudication, PG17 migrations, PgBouncer, license engine, cron jobs | Business logic duplication from packages |

## Sprint 1 Story Checklist

- [x] S1-001 — UoM Engine: Schema & Conversion API — COMPLETE
- [x] S1-002 — Ingredient Lots & Dynamic Yield Model — COMPLETE
- [x] S1-003 — RxDB + SQLCipher Setup on Android — COMPLETE
- [x] S1-004 — Soft Allocation Data Model in RxDB — COMPLETE
- [x] S1-005 — HardwareIOService Scaffold & WebSocket IPC — COMPLETE
- [x] S1-006 — UUIDv7 Generation Client Library — COMPLETE
- [x] S1-007 — Backend Sync API: Batch Deduction Adjudication — COMPLETE
- [x] S1-008 — Concurrent Load Test: BOM Race Condition — COMPLETE

## Sprint 2 Story Checklist

- [x] S2-001 — Product Catalog UI & PLU Management — COMPLETE
- [x] S2-002 — Cart Engine & BOM Auto-Deduction — COMPLETE
- [x] S2-003 — ESC/POS Printing via HardwareIOService — COMPLETE
- [x] S2-004 — Scale Integration via HardwareIOService — COMPLETE
- [x] S2-005 — Barcode Scanner Integration — COMPLETE
- [x] S2-006 — Shrinkage / Waste Recording UI — COMPLETE
- [x] S2-007 — Shift Management: Open & Close — COMPLETE

## Sprint 3 Story Checklist

- [x] S3-001 — CMI P2PE Terminal Integration — COMPLETE
- [x] S3-002 — CMI Offline Floor Limit Enforcement — COMPLETE
- [x] S3-003 — Lana Cash QR Payment — COMPLETE
- [ ] S3-004 — Certificate Pinning — SCAFFOLD COMPLETE, HUMAN IMPLEMENTATION PENDING (7 action items)
- [ ] S3-005 — Root & Tamper Detection — SCAFFOLD COMPLETE, HUMAN IMPLEMENTATION PENDING (11 action items)
- [x] S3-006 — Super-Admin Dashboard — COMPLETE
- [x] S3-007 — Automated Subscription Expiry Lockout — COMPLETE

## Sprint 4 Story Checklist

- [x] S4-001 — Sentry Integration (crash reporting + error tracking) — COMPLETE
- [x] S4-002 — Structured Logging (Loki/ELK) — COMPLETE
- [x] S4-003 — Store Health Dashboard (real-time register monitor) — COMPLETE
- [x] S4-004 — MDM Enrollment (Scalefusion or Intune) — COMPLETE
- [x] S4-005 — Public Web Portal (landing, pricing, demo, portal) — COMPLETE
- [x] S4-006 — Client Portal (auth-gated APK download, license view) — COMPLETE
- [x] S4-007 — End-to-End UAT (full flow, 4-hour offline simulation) — COMPLETE

## Sprint 3 Security Invariants

- S3-004 and S3-005 code is HUMAN-WRITTEN ONLY.
  AI may draft comments and documentation only.
  No AI-generated implementation in these two stories.
  Any AI-generated code in certificate pinning or root
  detection files is grounds for automatic PR rejection.
- CMI P2PE: PAN data never enters GreenGo stack (LAW 5).
  Payment terminal SDK calls are the boundary. Nothing
  crosses from the terminal into GreenGo code except
  the tokenized transaction reference.
- All Sprint 3 security work requires a dedicated
  security-focused PR review before merge.

## Design System — MAGHAREBIT identity (apps/pos-web, Capacitor, Tauri)

Owner-approved brand migration (feat/magharebit-brand). Customer-facing
product name: **MAGHAREBIT POS**. The Tauri identifier
`ma.magharebit.greengo-pos` is intentionally unchanged so in-place
auto-updates keep working.

Source of truth for tokens: `apps/magharebit-web/docs/brand-handoff/brand-tokens.json`
(implemented in pos-web as CSS variables via Tailwind v4 `@theme` in `globals.css`).
Names follow the design board, not Tailwind built-ins.

**Theme hierarchy: dark shell, light content.**
- Dark shell — login, activation, lock/idle screen (subtle zellige watermark at
  4–6% opacity, behind content only) and the global top dock/header:
  - Deep Forest `#0A2318` (brand-950): background
  - Pine Green `#0F3D2A` (brand-900): cards and borders on dark
  - Moroccan Gold `#F0B429` (gold-400): primary action/accent on dark
- Light content — product catalog, POS grid, operational tables:
  - Background `#F8F9FA`, surface `#FFFFFF`
  - Deep Ochre `#B8860B` (gold-600): accent on light (gold-400 is only 1.7:1 on white)
  - Text primary `#111827`, text secondary `#6B7280`, border `#E0E0E0`
- Gold action buttons always use dark text `#0A2318` (never white).
- Error `#D32F2F`. Success on dark: `#5EC485` (brand-400).
- Legacy `#2E8B57` is still in the scale as brand-600 but is no longer the
  dominant brand color. `#FF9800` and `#F5F5F0` are retired in pos-web.
- Fonts: bundled locally via npm (@fontsource) — Plus Jakarta Sans (Latin
  display), Cairo (Arabic display), Noto Naskh Arabic (Arabic body), Inter (UI).
  No requests to Google Fonts; the POS must work fully offline.
  Western digits (0-9) everywhere, including Arabic UI.
- Receipts (80mm ESC/POS): the merchant's own logo stays at the top. A
  "Powered by MAGHAREBIT" footer with the 1-bit emblem (`emblem-mono-192w.png`)
  is printed via a `GS v 0` raster routine.
- Scope: apps/pos-web, the Capacitor tablet container and the Tauri desktop
  target. `apps/pos` (React Native) is out of scope and keeps its current styling.

Rules below apply to all UI:
- RTL: true — Arabic is the primary layout direction
  All StyleSheet values use start/end not left/right.
  marginStart not marginLeft. paddingEnd not paddingRight.
- Border radius: 8px (cards), 4px (inputs), 24px (pill badges)
- Touch target minimum: 48×48dp (WCAG 2.1 AA compliance)
- Animation: none on critical checkout path. 150ms fade only
  for non-blocking UI elements (badges, status indicators).
- Elevation (Android): 2dp for cards, 4dp for floating elements

## CI Gate Self-Verification Checklist

Before marking ANY task complete, verify all applicable gates:

- [ ] 01 — SQLCipher active: raw .db NOT readable as plaintext SQLite
- [ ] 02 — No PAN data: no card_number/pan/track_data/cvv in code or logs
- [ ] 03 — Cert pinning: DISABLE_PINNING=false in release build config
- [ ] 04 — BOM race test: 10 concurrent registers, stock=5, zero negative inventory
- [ ] 05 — No hardware imports in apps/pos (Gradle module dependency lint)
- [ ] 06 — Semgrep SQL injection scan: no HIGH severity findings
- [ ] 07 — APK signature hash matches registered keystore

## AI Generation Governance

| Domain | Generation Permitted | Mode | Human Review |
|---|---|---|---|
| UI components, forms, layouts | Yes — full | Speed Mode OK | Spot check — standard PR |
| API CRUD endpoints (non-financial) | Yes — full | Quality Mode | Standard PR + integration test |
| DB migrations / schema changes | Draft only | Quality Mode | Mandatory senior review before merge |
| Sync / soft-allocation engine | Draft only — human rewrites core | Quality Mode | Mandatory + concurrent race test gate |
| BOM deduction & yield calculation | Draft only | Quality Mode | Mandatory + unit tests + S1-008 gate |
| Security controls (SQLCipher, pinning, root detection) | No — human-written only | N/A | Mandatory security-focused PR review |
| Payment integration (CMI SDK) | No — human-written only | N/A | PCI review checklist sign-off |
| HardwareIOService | Draft — human owns architecture | Quality Mode | Mandatory Android engineer sign-off |

## Race Condition Test Registry

These 5 tests are hard merge gates for any BOM, sync, or inventory code:

- [ ] RCT-01 — 10 registers deduct from stock=5 concurrently. Pass: total deductions ≤ 5, correction_events cover remainder.
- [ ] RCT-02 — 2 registers offline 2h, 50 deductions each, sync simultaneously. Pass: no over-deduction, ordered by UUIDv7.
- [ ] RCT-03 — License set EXPIRED mid-transaction. Pass: current sale completes, next attempt shows read-only mode.
- [ ] RCT-04 — Kill HardwareIOService mid-print. Pass: PrintQueue retains job, service restarts, no duplicate receipt (idempotency key).
- [ ] RCT-05 — UoM edge case: 1 carton oranges (24×180g=4320g), yield 40% → 1728ml juice. Pass: precision to 2 decimal places throughout.

## Conflict Escalation Protocol

- If any task instruction contradicts a Law in this file: output "CONFLICT DETECTED: [description of contradiction]" and stop immediately.
- Never silently resolve an architectural contradiction.
- Never implement a deviation without an explicit CEO written approval message in this session containing the exact phrase "OVERRIDE APPROVED".
- If uncertain whether a task violates a Law: ask for clarification before proceeding.

## Credit Conservation Protocol

- Eco Mode: planning output, document reading, writing comments, scaffolding config files, generating boilerplate JSON/YAML.
- Quality Mode (Sonnet-class): API endpoints, React components, SQL migrations, test files, CI pipeline YAML.
- Quality Mode (Opus-class): sync engine logic, SQLCipher key derivation, soft-allocation adjudication, security controls only.
- Never use Opus-class for UI layout, CSS, config files, or documentation.
- When a task is purely scaffolding (package.json, tsconfig, turbo.json): use Eco Mode.
- AGENTS.md is the source of truth. Never re-read the uploaded Blueprint .docx files after this file is active. All rules are encoded here.
