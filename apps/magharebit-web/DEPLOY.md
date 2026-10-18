# MAGHAREBIT Web — Deployment Checklist

> Complete every section before going live. Tick items off in order.

---

## Backend Integration Status

| Component | Status | Implementation |
|---|---|---|
| Lead storage | ✅ **MongoDB Atlas ACTIVE** (`magharebit.tftevc8.mongodb.net`) + JSON fallback on connection failure | `lib/repositories/leads.ts` |
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
| License system | NOT INTEGRATED — defers to software/superadmin side | `data/licenses.json` (stub) |
| Admin auth system | STUB — `ADMIN_SECRET` header + localStorage password | Pre-production TODO |
| Download URLs | NOT READY — software not built yet | `NEXT_PUBLIC_DOWNLOAD_*` env (empty) |

## Pre-launch Backend Integration TODOs

Before production deployment, complete these in order:

1. **MongoDB Atlas connection — COMPLETE**
   - [x] Provision production cluster (`magharebit.tftevc8.mongodb.net`)
   - [x] Database user `magharebit_db_user` with `readWriteAnyDatabase` role
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
   mongodb://magharebit_db_user:<PASSWORD>@ac-bzvoijn-shard-00-00.tftevc8.mongodb.net:27017,ac-bzvoijn-shard-00-01.tftevc8.mongodb.net:27017,ac-bzvoijn-shard-00-02.tftevc8.mongodb.net:27017/magharebit?ssl=true&replicaSet=atlas-v67us9-shard-0&authSource=admin&retryWrites=true&w=majority&appName=magharebit
   ```
   **For Vercel** (cleaner SRV form, recommended):
   ```
   mongodb+srv://magharebit_db_user:<PASSWORD>@magharebit.tftevc8.mongodb.net/magharebit?appName=magharebit&retryWrites=true&w=majority
   ```

2. **Green API WhatsApp credentials** (instance 7107643319 on 212619522487)
   - [ ] Rotate `GREEN_API_API_TOKEN` in greenapi.com dashboard (previous token was exposed)
   - [ ] Set `GREEN_API_INSTANCE_ID=7107643319` and new `GREEN_API_API_TOKEN` in `.env.local`
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
   - [ ] Replace localStorage password check with real auth provider
   - [ ] Remove `NEXT_PUBLIC_ADMIN_PASSWORD` env var
   - [ ] Migrate `ADMIN_SECRET` to proper API auth (consider NextAuth or Clerk)

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
| `ADMIN_SECRET` | ✅ | Server-only secret for `/api/leads` and `/api/licenses` admin endpoints |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | ✅ | Password for the client-side admin UI gate — set equal to `ADMIN_SECRET` value in production |
| `MONGODB_URI` | ✅ | MongoDB connection string (used by leads/licenses API routes) |
| `NEXT_PUBLIC_SITE_URL` | optional | Canonical site URL for OG tags and sitemap (e.g. `https://magharebit.com`) |

> ⚠️ **Security note:** `NEXT_PUBLIC_ADMIN_PASSWORD` is visible in the client JS bundle. The actual API is protected server-side by `ADMIN_SECRET`. Restrict admin page access at the network/CDN layer (IP allowlist) for additional security.

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
- [ ] `/api/leads` requires `x-admin-secret` header matching `ADMIN_SECRET` ✅
- [ ] `/api/licenses` requires `x-admin-secret` header ✅
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
