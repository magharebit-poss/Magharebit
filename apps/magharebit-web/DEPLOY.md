# MAGHAREBIT Web — Deployment Checklist

> Complete every section before going live. Tick items off in order.

---

## Backend Integration Status

| Component | Status | Implementation |
|---|---|---|
| Lead storage | ✅ **MongoDB Atlas ACTIVE** (cluster host is configured through `MONGODB_URI`, not documented here) + JSON fallback on connection failure | `lib/repositories/leads.ts` |
| Newsletter storage | ✅ **MongoDB Atlas ACTIVE** + JSON fallback on connection failure | `lib/repositories/subscribers.ts` |
| MongoDB connection layer | ✅ Hardened — 5s timeout, catches failures and falls back to JSON instead of throwing 500s; public DNS resolvers (`8.8.8.8`/`1.1.1.1`) wired at module load for SRV reliability across networks | `lib/mongodb.ts` |
| Instrumentation hook | ✅ Sets DNS resolvers at server startup for non-MongoDB SRV lookups | `src/instrumentation.ts` |
| Admin health endpoint | ✅ ACTIVE — `GET /api/admin/health` (x-admin-secret) returns DB + WhatsApp status | `lib/db-check.ts` |
| Middleware API exclusion | ✅ FIXED — `/api/*` routes now bypass next-intl locale redirect (previously POST /api/leads silently 404'd) | `src/middleware.ts` |
| WhatsApp Business API | Green API (code complete, credentials pending rotation) | `lib/whatsapp.ts` |
| Business number | 0619522487 (212619522487 international) | `WHATSAPP_BUSINESS_NUMBER` env |
| OTP auth API | ✅ BUILT — `/api/auth/send-otp`, `/api/auth/verify-otp`, `/api/auth/send-otp-sms`, `/api/auth/complete-signup` | `lib/otp.ts` + `app/api/auth/` |
| Auth UI shells | ✅ BUILT — signup (3-step), login, otp, forgot-password, reset-password; all 3 locales × 5 pages = 15 routes | `app/[locale]/auth/` |
| OTP storage | ✅ MongoDB `otp_sessions` collection, SHA-256 hashed, 5-min TTL index | `app/api/auth/verify-otp/route.ts` |
| Session management | ✅ MongoDB `auth_sessions` + signed HttpOnly cookie `mgh_session` | `lib/otp.ts` → `createSessionToken()` |
| License system | ✅ v1 keys live; v2 signed tokens implemented (needs `LICENSE_SIGNING_*`), see `docs/pos-license-contract.md` | `lib/license-token.ts`, `app/api/licenses/` |
| Admin auth system | ✅ Server-side: `POST /api/admin/login` checks the password against `ADMIN_SECRET` and sets a signed HttpOnly cookie (8 h). Single shared password; no secret in client code | `lib/admin-auth.ts` (per-user auth is a post-launch TODO) |
| Download | ✅ Gated route `/api/download/<platform>` (portal session + active license). Installer URLs not set yet: the POS is not released | `DOWNLOAD_*` env |

## Pre-launch Backend Integration TODOs

Before production deployment, complete these in order:

1. **MongoDB Atlas connection — COMPLETE**
   - [x] Provision production cluster (host: see the Atlas dashboard)
   - [x] Create a dedicated database user for the app
   - [ ] Scope that user to `readWrite` on the `magharebit` database only; avoid `readWriteAnyDatabase`
   - [x] Set `MONGODB_URI` in local `.env.local` — using explicit (non-SRV) form to bypass local DNS SRV-lookup refusal. The `mongodb+srv://` form is preferred on Vercel/cloud.
   - [x] Harden `lib/mongodb.ts` to fall back to JSON on connection failure (5s serverSelectionTimeout)
   - [x] Connection verified via `scripts/test-mongodb.ts` (Connect + Write + Cleanup)
   - [x] Migration of existing JSON data — 1 historic lead migrated via `scripts/migrate-json-to-mongodb.ts` (idempotent)
   - [x] End-to-end smoke test: fresh POST `/api/leads` (UTF-8 Arabic) lands in Atlas `leads` collection
   - [x] `/api/admin/health` confirms `connected:true, database:"magharebit"`
   - [ ] Set `MONGODB_URI` on Vercel — there you can use either the `mongodb+srv://` form OR the explicit form
   - [ ] Confirm credential rotation flow (Atlas Database Access → password change → update `.env.local` + Vercel env)

   **Connection string format used locally** (explicit, no SRV):
   ```
   mongodb://<DB_USER>:<PASSWORD>@<shard-00-00-host>:27017,<shard-00-01-host>:27017,<shard-00-02-host>:27017/magharebit?ssl=true&replicaSet=<replica-set-name>&authSource=admin&retryWrites=true&w=majority&appName=magharebit
   ```
   **For Vercel** (cleaner SRV form, recommended):
   ```
   mongodb+srv://<DB_USER>:<PASSWORD>@<cluster-host>/magharebit?appName=magharebit&retryWrites=true&w=majority
   ```

2. **Green API WhatsApp credentials** (instance ID and token come from the greenapi.com dashboard)
   - [ ] Rotate `GREEN_API_API_TOKEN` in greenapi.com dashboard (previous token was exposed)
   - [ ] Set `GREEN_API_INSTANCE_ID=<instance-id>` and new `GREEN_API_API_TOKEN` in `.env.local`
   - [ ] Test via `curl -X POST http://localhost:3004/api/whatsapp-test` in development
   - [ ] Verify lead confirmation and admin notification flows
   - [ ] Verify OTP delivery to merchant phones (test `/ar/auth/signup`)

3. **Auth OTP system** (code complete — credentials needed)
   - [x] `/api/auth/send-otp` — WhatsApp OTP via Green API, SHA-256 hashed, rate-limited
   - [x] `/api/auth/verify-otp` — up to 5 attempts, issues signed HttpOnly session cookie
   - [x] `/api/auth/send-otp-sms` — Twilio SMS fallback (requires prior WhatsApp session)
   - [x] `/api/auth/complete-signup` — creates merchant record in MongoDB `merchants` collection
   - [x] Auth UI shells — 5 pages × 3 locales = 15 SSG routes under `/[locale]/auth/`
   - [ ] Fill in Twilio credentials after rotation (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`)
   - [ ] End-to-end OTP smoke test once Green API credentials are active

4. **Admin authentication upgrade** (post-launch)
   - [x] Password is verified server-side (`POST /api/admin/login`); the browser only holds an HttpOnly session cookie
   - [x] `NEXT_PUBLIC_ADMIN_PASSWORD` is no longer read anywhere in the code
   - [ ] **Rotate `ADMIN_SECRET` and delete `NEXT_PUBLIC_ADMIN_PASSWORD` from every environment (Vercel, `.env.local`).** The old value was shipped in the browser bundle, so treat it as compromised
   - [ ] Replace the single shared password with per-user auth (consider NextAuth or Clerk)

5. **License system (from software team)**
   - [ ] Wait for software backend to expose license validation API
   - [ ] Connect `/api/licenses` to real validator
   - [ ] Integrate license generation into admin panel

6. **Software downloads**
   - [ ] Wait for software installers (Windows .exe, Android .apk)
   - [ ] Host on Cloudflare R2 or S3
   - [ ] Set `NEXT_PUBLIC_DOWNLOAD_WINDOWS_URL` and `NEXT_PUBLIC_DOWNLOAD_ANDROID_URL`

---

## 1. Environment Variables

Set the following in your hosting platform (Vercel / VPS `.env.production`).
**Never commit secrets to git.**

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API base URL (e.g. `https://api.magharebit.com`) |
| `ADMIN_SECRET` | ✅ | Server-only. The admin login password and the `x-admin-secret` header value for admin API routes. Never give it a `NEXT_PUBLIC_` prefix |
| `NEXTAUTH_SECRET` | ✅ | Server-only. Signs the admin session cookie (and portal/OTP sessions); admin login returns 503 without it |
| `MONGODB_URI` | ✅ | MongoDB connection string. Required for OTP, sign-up, login, the merchant portal and admin merchants (no fallback: those routes return 503 without it) |
| `NEXT_PUBLIC_BASE_URL` | ✅ in production | Canonical site URL: canonical links, hreflang, sitemap, robots and structured data are built from it (e.g. `https://magharebit.com`). Set it at **build** time |
| `MONGODB_DB` | optional | Database name (default `magharebit`). Rate limits live in the `rate_limits` collection (TTL index), shared by all instances |
| `LICENSE_SIGNING_KID`, `LICENSE_SIGNING_PRIVATE_KEY` | ✅ for license v2 | Ed25519 signing key (`node scripts/gen-license-keypair.mjs <kid>`). Without them `jwks`/`activate` return 503; v1 keys keep working. `LICENSE_EXTRA_JWKS` only during key rotation |
| `DOWNLOAD_WINDOWS_URL`, `DOWNLOAD_ANDROID_URL` | ✅ when the POS is released | Installer URLs, server-only. Served only through `/api/download/<platform>` (merchant session + active license). Set at build time (the download page is prerendered) |
| `CRON_SECRET` | ✅ | Protects `/api/cron/daily-report` (scheduled in `vercel.json`) |
| `GREEN_API_INSTANCE_ID`, `GREEN_API_API_TOKEN`, `GREEN_API_BASE_URL`, `WHATSAPP_BUSINESS_NUMBER` | for WhatsApp | License delivery, lead notifications and WhatsApp OTP (default provider) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | for SMS | SMS OTP (default provider) |
| `OTP_SMS_PROVIDER`, `OTP_WHATSAPP_PROVIDER` | optional | `twilio`/`infobip` and `green-api`/`infobip`. Default unchanged until you switch |
| `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, `INFOBIP_SMS_SENDER`, `INFOBIP_WHATSAPP_SENDER`, `INFOBIP_WHATSAPP_TEMPLATE` | for Infobip | Scaffold, see `src/lib/otp-delivery/infobip.ts` |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email OTP | Email one-time codes |

`ADMIN_SECRET` and `NEXTAUTH_SECRET` are **required server-only variables**: admin login returns 503 until both are set to strong random values (generate each with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). A tracked template with the full list is in `.env.example`.

### Deprecated / removed variables: purge from production

| Variable | Status | Action |
|---|---|---|
| `NEXT_PUBLIC_ADMIN_PASSWORD` | **REMOVED.** It was embedded in the browser bundle and exposed the admin secret to every visitor. The code no longer reads it | Delete it from Vercel (all environments), `.env.local`, `.env.production` and CI. **Rotate `ADMIN_SECRET`**: the previously deployed value was public |
| `NEXT_PUBLIC_SITE_URL` | **Not read** by the code (an older version of this document listed it) | Use `NEXT_PUBLIC_BASE_URL` instead; delete the old variable |

> ⚠️ **Security note:** the admin secret is server-only. Admin login: owner password (or a per-admin account) with an 8-hour HttpOnly cookie and a 10-attempts / 15-minute per-IP limit, stored in MongoDB so it holds across server instances. Restrict `/admin` at the network/CDN layer (IP allowlist) and plan per-user auth.

---

## 2. Pre-Build Checks

```bash
# Type-check (must be zero errors)
npx tsc --noEmit

# Lint — next lint is deprecated in Next.js 16; use eslint CLI directly
npx eslint src/ --ext .ts,.tsx

# Production build (must succeed — 28 pages, zero errors)
npm run build
```

---

## 3. Security Checklist

- [ ] `ADMIN_SECRET` is set as a **server-only** env var (no `NEXT_PUBLIC_` prefix)
- [ ] `/admin` is in `robots.ts` disallow list ✅ (already done)
- [ ] `/api/leads` and `/api/licenses` require an admin session cookie or an `x-admin-secret` header matching `ADMIN_SECRET` ✅
- [ ] `NEXT_PUBLIC_ADMIN_PASSWORD` is absent from every environment
- [ ] No secrets hardcoded in source code
- [ ] `NEXT_PUBLIC_API_URL` points to HTTPS endpoint
- [ ] CORS is configured on the backend to allow only the production domain
- [ ] Review admin pages — consider IP allowlist on `/admin/*` via CDN/reverse proxy

---

## 4. DNS & Domain

- [ ] DNS A/CNAME records pointing to production host
- [ ] www redirect configured (www → apex or apex → www, consistent)
- [ ] HTTPS certificate provisioned (Let's Encrypt or Vercel auto-TLS)
- [ ] Test all three locales: `/ar`, `/fr`, `/en`

---

## 5. Vercel-Specific (if deploying to Vercel)

- [ ] Set all env vars in Vercel dashboard → Settings → Environment Variables
- [ ] Enable "Production" environment for all secrets
- [ ] Verify region is set to a low-latency region for Morocco (e.g. `fra1` — Frankfurt)
- [ ] Set custom domain in Vercel dashboard
- [ ] Verify `next.config` does not disable image optimization in production

---

## 6. Content & SEO

- [ ] `sitemap.ts` URLs use the correct production domain
- [ ] `robots.ts` `siteUrl` is updated to the production domain
- [ ] `generateMetadata` `alternates.canonical` URLs are correct
- [ ] OG image assets exist at `/public/og-image.png` (1200×630)
- [ ] Favicon / `icon.svg` present in `/public`
- [ ] `manifest.json` in `/public` has correct `start_url` and `name`
- [ ] Google Search Console: submit sitemap after first deploy

---

## 7. Functional Smoke Tests

Run these manual checks immediately after deploy:

- [ ] Homepage loads in ar/fr/en, hero renders, no console errors
- [ ] Portal login page shows split-screen layout on desktop
- [ ] Portal login form submits (expect 401 with wrong credentials — that's correct)
- [ ] WhatsApp button opens correct wa.me link
- [ ] `/ar/portal/dashboard` redirects to login if not authenticated
- [ ] `/ar/pricing` loads FAQ items correctly
- [ ] `/ar/features` shows ProductTourTabs
- [ ] `/ar/demo` shows contact form
- [ ] `/ar/privacy` loads without error
- [ ] `/ar/sectors/boulangerie` loads the sector page
- [ ] `/admin/leads` is accessible only with the correct admin password
- [ ] `/api/leads` returns 401 without the `x-admin-secret` header
- [ ] Footer links work: Privacy → `/ar/privacy`, Help → `/ar/demo`
- [ ] Language switcher switches locale correctly

---

## 8. Performance Checklist

- [ ] Run Lighthouse on homepage — target score ≥ 85 (Performance, Accessibility, SEO)
- [ ] Verify dynamic imports are code-splitting as expected (check network tab for lazy chunks)
- [ ] Confirm no `<img>` tags are missing `loading="lazy"` (use `next/image` for new images)
- [ ] Enable caching headers on `/public` static assets via CDN

---

## 8a. Post-deployment Lighthouse targets

Run Lighthouse against the production URL after deployment. Targets:

- Performance: 85+ (mobile), 95+ (desktop)
- Accessibility: 95+
- Best Practices: 95+
- SEO: 100

Common issues to verify if scores are lower:
- LCP element optimised? (hero text + stat cards — no heavy images in hero)
- No console errors in production?
- All images have `alt` text?
- All form labels properly associated (`htmlFor` / `aria-label`)?
- Heading hierarchy correct (h1 → h2 → h3, no skips)?
- Color contrast WCAG AA? (brand gold `#F0B429` on dark green `#0A2318` passes 4.5:1)
- No render-blocking resources? (AOS initialises on client, fonts loaded async)
- Verify dynamic import chunks load on scroll — check Network tab for `lazy` chunks appearing after fold

---

## 9. Monitoring & Ops

- [ ] Set up uptime monitoring (e.g. Better Uptime, UptimeRobot) on `/ar`
- [ ] Configure error alerts — optionally wire `ErrorBoundary.tsx` `componentDidCatch` to Sentry
- [ ] Backup MongoDB leads collection before any major release
- [ ] Document the `ADMIN_SECRET` value in a password manager (not in code)

---

## 10. Launch

- [ ] All items above are checked
- [ ] Notify team of go-live time
- [ ] Monitor error logs for the first 30 minutes post-deploy
- [ ] Announce on social media / WhatsApp group

---

*Generated for MAGHAREBIT POS Web — Phase H final deployment checklist.*
