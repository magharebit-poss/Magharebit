# Edge security review (Cloudflare audit-skill inspired)

Date: 2026-11-03. Scope: `apps/magharebit-web` (marketing site, portal and admin APIs).

## What the reference repository is

`cloudflare/security-audit-skill` is a methodology for a coding agent doing a **source-level** security audit
(recon, coverage-led hunting, adversarial validation, structured findings). It contains no header presets, WAF
rules or scripts to copy into a Next.js app. What we took from it:

- Only confirmed boundary failures count as vulnerabilities; defence-in-depth gaps are hardening notes.
- Check the classes it lists that apply to a web app: auth and brute force, data isolation between tenants,
  resource exhaustion, client-side, supply chain, deployment.

This is a review against those classes, not a claim that the site is "100% bulletproof". No such claim should be
made in marketing copy.

## Findings and changes

| Class | Finding | Action |
|---|---|---|
| Auth / brute force | `POST /api/portal/auth/login` (licence key + identifier) had no rate limit. The key checksum is public logic, so guessing was bounded only by network speed. | Added two fixed-window buckets with the existing shared limiter: 20 / 10 min per IP, 10 / 10 min per identifier. Answers 429 `rate_limited`. |
| Headers | Missing `X-Permitted-Cross-Domain-Policies`, `Origin-Agent-Cluster`; Permissions-Policy left payment, USB, serial, Bluetooth and FLoC defaults. | Added both headers; Permissions-Policy now denies `payment`, `usb`, `serial`, `bluetooth`, `interest-cohort`. |
| Headers (rejected) | `Cross-Origin-Resource-Policy: same-site` and COEP. | NOT applied: the Tauri/Capacitor POS webviews load `/api/stores/*/logo` as a cross-origin image and the demo embeds YouTube/Vimeo. Documented in `next.config.ts`. |
| CSRF | Origin / Sec-Fetch-Site guard on state-changing `/api` calls already in `middleware.ts`. | No change. |
| Dev-only routes | `/api/whatsapp-test`, `/api/dev-installer/*` answer 404 outside development. | No change. |
| Known gap | CSP keeps `'unsafe-inline'` for scripts (static rendering, no per-request nonce). | Unchanged, tracked as SEC-11 in `security-audit-web-phase2.md`. |

## Cloudflare edge configuration to apply at deploy (not code)

These live in the Cloudflare dashboard and cannot be verified from the repository. Treat them as a checklist.

1. **SSL/TLS**: Full (strict), Always Use HTTPS, minimum TLS 1.2, HSTS already sent by the app.
2. **WAF managed rules**: enable the Cloudflare Managed and OWASP core rulesets (start in log mode, then block).
3. **Rate limiting rules** (in addition to the app limiter, which is the authority):
   - `/api/auth/*` and `/api/portal/auth/*`: e.g. 20 requests / minute / IP, action: managed challenge.
   - `POST /api/leads*` and the contact form route: e.g. 10 requests / minute / IP.
   - `/api/licenses/*`: keep a generous limit; POS clients are legitimate and frequent.
4. **Bot protection**: Bot Fight Mode (or Super Bot Fight Mode) on; do NOT challenge `/api/licenses/*` and
   `/api/cron/*` (machine callers, protected by their own keys).
5. **DDoS**: the HTTP DDoS managed ruleset is on by default; keep sensitivity at default and review events weekly.
6. **Origin lock**: only accept traffic from Cloudflare (authenticated origin pulls or a tunnel), so the origin URL
   cannot be hit directly to bypass the WAF.
7. **Cache rules**: cache static assets and `/media`, `/brand`; bypass cache for `/api/*` and `/admin/*`.
8. **Security headers**: keep them in `next.config.ts` (single source of truth); do not duplicate with Transform Rules.

## Not done / needs owner input

- WAF and rate-limit rules above need someone with Cloudflare access.
- A nonce-based CSP (SEC-11) is a post-launch task.
- No penetration test was run; this was a code review of the routes listed.
