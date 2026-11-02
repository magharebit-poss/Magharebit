# Security audit, phase 2: admin APIs, public endpoints, edge headers

Date: 2026-11-02. Scope: `src/app/api/admin/*` (29 handlers), the public routes (`leads`, `newsletter`,
`quick-callback`, `demo-request`, `licenses/*`, `health`, `stores/*/logo`, `whatsapp-test`, `dev-installer`,
`download`, `cron`), the OTP senders under `/api/auth`, `src/middleware.ts`, `next.config.ts`, client bundle hygiene.
Method: code review of every handler, then `scripts/e2e/security-phase2-e2e.mjs` (54 checks, real Chrome for the
CSP crawl, a mock Green API so nothing real is contacted).

## Summary

| ID | Severity | Title | Status |
|---|---|---|---|
| SEC2-01 | High | Lead form: anonymous text echoed in WhatsApp sent from the company number to any phone | Fixed |
| SEC2-02 | High | Anonymous traffic can drain WhatsApp / OTP credit (per-IP limits only) | Fixed |
| SEC2-03 | Medium | `send-otp-email`: no per-IP limit (mail any number of addresses) | Fixed |
| SEC2-04 | Medium | `demo-request`: no limit, no validation, raw relay to the marketing backend | Fixed |
| SEC2-05 | Medium | No Content-Security-Policy | Fixed (see residual) |
| SEC2-06 | Low | State-changing API calls accepted from other origins (simple-request bypass) | Fixed |
| SEC2-07 | Low | Non-string JSON fields crash public/OTP handlers (500) | Fixed |
| SEC2-08 | Low | Rate-limit key trusts a spoofable `x-forwarded-for` | Mitigated |
| SEC2-09 | Low | Callback `page` stored unfiltered | Fixed |
| SEC2-10 | Info | Deprecated `X-XSS-Protection: 1; mode=block` | Fixed (`0`) |
| SEC2-11 | Info | CSP keeps `'unsafe-inline'` on scripts (no nonce) | Open, follow-up |
| SEC2-12 | Info | Owner break-glass login has an IP limit only | Open, note |

Verified sound, no change needed:
- **Admin authorization.** All 29 admin handlers authenticate (login/logout excluded by design). Proven by sweeping
  every route found on disk with: no credentials, a valid merchant session (also presented as an admin cookie), a
  forged admin cookie signed with NEXTAUTH_SECRET alone, and a wrong `x-admin-secret`: **every one answers 401**. The
  admin signing key mixes both secrets with a distinct label, so a merchant token can never verify as an admin one.
- **RBAC.** Writes call `canWrite` (owner/operator); user management and exports are owner / owner+operator; a viewer
  gets 403 on 9 write/export/user routes and cannot touch admin accounts. The role is re-read from the database on
  each request (a demoted user loses rights immediately).
- **Admin session cookie:** `HttpOnly`, `SameSite=Strict`, `Secure` in production, 8 h; login limited per IP and per
  username; unknown users cost the same as known ones (`dummyVerify`).
- **Stored XSS in the admin UI:** React escapes everything; the only `dangerouslySetInnerHTML` uses are JSON-LD blocks
  built from static content (the dynamic `[sector]` slug is validated against the list before use).
- **Secrets in the client bundle:** no `NEXT_PUBLIC_` variable carries a secret; no client component reads a server
  variable. `/api/health` returns only status and timestamp. `whatsapp-test` and `dev-installer` answer 403/404
  outside development.
- **CORS:** no `Access-Control-Allow-*` anywhere, so browsers refuse cross-origin reads (checked on a preflight and a
  cross-origin GET).

---

## SEC2-01: High: CWE-74 injection into an outbound channel / CWE-940

**Location.** `src/app/api/leads/route.ts` `POST` (validation then `whatsappTemplates.leadConfirmation(storeName)`).

**Analysis.** The confirmation goes to the phone number the visitor typed, from the company's WhatsApp number, and it
contains the visitor's store name (up to 100 free characters). Anyone could therefore send a victim a message from
the official number containing "Gagnez 500 DH: https://…", repeatedly (per-IP limit only), and get the number reported
as spam. The same text reaches the team's own WhatsApp.

**Patch (applied).** `src/lib/public-guard.ts` `cleanLabel()` refuses links, bare domains, `@handles`, markup,
wa.me/t.me links and control/bidi characters in `storeName` and `city` (shared validator `src/lib/lead-input.ts`,
also used by `demo-request`). Accented, Arabic and `& ' -` names are accepted. At most one confirmation per phone per
24 h (`lead-confirm:<phone>`), whatever the IP.

**Verification.** 9 hostile payloads → 400, nothing stored; an accented Arabic+French name → 201; the same phone
twice → 201 both times but only one confirmation (the team alert is the only extra message).

## SEC2-02: High: CWE-770 allocation without limits

**Location.** `leads`, `newsletter`, `send-otp`, `send-otp-sms`, `send-otp-email`.

**Analysis.** Every limit was per IP (and per recipient for OTP). A botnet or rotating proxies bypass any per-IP rule
and spend the WhatsApp/SMS/e-mail credit or get the sender number banned.

**Patch (applied).** `outboundBudget()` (`src/lib/public-guard.ts`): a global hourly ceiling shared by every instance
(MongoDB rate-limit store), `PUBLIC_WA_PER_HOUR` (default 400: lead confirmations, team alerts, newsletter welcomes)
and `PUBLIC_OTP_PER_HOUR` (default 1500). Leads and subscriptions are still saved when the WhatsApp budget is
exhausted; only the messages are skipped, and an error is logged. OTP senders answer 429 over budget.

**Verification.** With a budget of 6: six leads all return 201 and exactly 6 messages go out (2,2,2,0,0,0); the
newsletter subscription is kept and its welcome skipped. Email OTP: with a different IP each time the global cap
stops the flood.

## SEC2-03: Medium: CWE-770

**Location.** `src/app/api/auth/send-otp-email/route.ts`. Only the per-address cap (3 / 10 min) existed, so one
client could mail unlimited different addresses and burn the Resend quota.

**Patch.** Same 12 per 10 min per IP as the WhatsApp/SMS senders, plus the global budget.
**Verification.** 12 accepted, the 13th and 14th → 429.

## SEC2-04: Medium: CWE-20 / CWE-770

**Location.** `src/app/api/demo-request/route.ts`. Public, no limit, `storeName/phone/...` unvalidated and relayed
as-is to `${NEXT_PUBLIC_API_URL}/marketing/demo-request`, no timeout.

**Patch.** 5 per hour per IP, the shared validator, only validated fields forwarded, 5 s timeout.
**Verification.** link → 400, operator object → 400, valid → 200, 6th → 429.

## SEC2-05: Medium: CWE-1021 / CWE-79 defence in depth

**Location.** `next.config.ts` (`securityHeaders`). No CSP.

**Patch.** CSP on every route (pages and API): `default-src 'self'`; scripts/styles self + inline; images self, data,
blob, Cloudinary; fonts self; `connect-src 'self'`; media self/blob/Cloudinary; frames only YouTube-nocookie and
Vimeo (demo modal); `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`;
`upgrade-insecure-requests` in production; `'unsafe-eval'` in development only. Plus `X-XSS-Protection: 0` and
`Cross-Origin-Opener-Policy: same-origin`.

**Verification.** A real Chrome crawl of 12 pages (public, auth, portal, admin, demo-video modal opened) records
**zero** `securitypolicyviolation` events; positive controls prove the policy bites: a remote `<script>`, a `fetch` to
another origin, a foreign iframe and an `<object>` are all blocked.

## SEC2-06: Low: CWE-352

**Location.** `src/middleware.ts` (new). A cross-site `<form>`/`fetch` with `Content-Type: text/plain` skips the CORS
preflight and our handlers parse the body as JSON whatever the type.

**Patch.** For POST/PUT/PATCH/DELETE on `/api/*` the middleware refuses a request whose `Origin` host differs from
`Host`, whose `Origin` is `null`/garbage, or with `Sec-Fetch-Site: cross-site` → 403 `cross_origin_blocked`. Requests
without `Origin` (curl, server-to-server) pass. Exempt: `/api/licenses/*` and `/api/cron/*` (POS apps send their own
app origin, the cron is platform-called; both have their own secrets and limits).

**Verification.** Evil origin, text/plain bypass, `null` origin, cross-site → 403; same-origin and no-Origin pass;
`tauri://localhost` on the licence route is not blocked; GET is never blocked.

## SEC2-07 / 09: Low

OTP senders, newsletter, quick-callback: non-string `phone`/`email`/`locale` threw on `.trim()` → 500; now 400. The
callback's `page` (shown to the admin team) is restricted to a path; markup becomes `/`.

## SEC2-08: Low: CWE-348

`clientIp()` (`src/lib/client-ip.ts`) now prefers `x-vercel-forwarded-for` / `x-real-ip` (platform-set) before the
first `x-forwarded-for` entry, and is the single implementation. On a host that only appends to a client-supplied
`x-forwarded-for` the fallback is spoofable, which is why SEC2-01/02 add limits an attacker cannot rotate (per phone,
global). Keep the site on Vercel, or put a trusted proxy in front.

## SEC2-11: Info: residual, follow-up

`script-src` keeps `'unsafe-inline'`: Next.js streams hydration data in inline scripts and the pages are statically
rendered, so a per-request nonce is not possible without making them dynamic. The policy still blocks remote
scripts, exfiltration (`connect-src`), form/`<base>` hijack, plugins and framing. Moving to nonces (or hash-based
`'strict-dynamic'`) is the follow-up; it costs static rendering of the marketing pages.

## SEC2-12: Info

The owner break-glass login (`ADMIN_SECRET`, no username) has only the per-IP limiter (10 / 15 min); a per-account
limiter would let an attacker lock the owner out. Keep `ADMIN_SECRET` a random value of at least 32 characters
(never a phrase), rotate it if it was ever shared, and prefer named operator accounts.

## Operational notes

- New optional variables: `PUBLIC_WA_PER_HOUR`, `PUBLIC_OTP_PER_HOUR` (see `.env.example`).
- If marketing hosts the demo video somewhere other than YouTube-nocookie, Vimeo or Cloudinary, add its origin to
  `frame-src` / `media-src` in `next.config.ts`.
- Confirm in the Vercel dashboard that `NEXT_PUBLIC_ADMIN_PASSWORD` (removed from the code) is deleted.

## SEC2-13: Medium: CWE-209 information exposure through error messages — Fixed

**Location.** 10 portal handlers (`customers`, `customers/[id]`, `employees`, `products`, `purchase-orders/[id]/receive`,
`suppliers`, `suppliers/[id]`, `transactions`, `whatsapp/campaigns`, `whatsapp/campaigns/[id]`) answered 500 with
`detail: err.message`; `licenses` (admin) answered 503 with the raw message.

**Analysis.** A MongoDB error carries the database, collection and index names and the offending value (a duplicate
key echoes e.g. a customer's phone), and driver/network errors describe the infrastructure.

**Patch.** `src/lib/server-error.ts`: `internalError(scope, err, code)` returns `{ error: code }` only and logs the
cause with `maskPii()` (e-mail addresses → `<email>`, digit runs ≥ 6 → `<n digits>`). Provider error bodies logged
by the OTP senders and the daily-report cron are masked the same way.

**Verification.** A static check in `security-phase2-e2e` fails if any API route returns raw exception text in a 5xx.

## Law 09-08 log review

No production log line writes a phone, e-mail, license key, OTP or token. The OTP/e-mail echo in `send-otp-email`
is development-only. Provider errors and driver errors are masked (SEC2-13). Rate-limit keys are stored hashed.

## Test runs

`security-phase2-e2e.mjs`: **55/55 on `next dev` and 55/55 on a production build (`next start`)**, the latter with
the production CSP (no `'unsafe-eval'`, `upgrade-insecure-requests`): zero violations on 12 pages.
