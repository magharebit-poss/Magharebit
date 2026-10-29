# MAGHAREBIT web: local setup for QA

> **Admin sign-in (local):** open `apps/magharebit-web/local-credentials.md` in your editor. It is git-ignored and holds
> `Identifiant: owner` and `Mot de passe: ...` for http://localhost:3004/fr/admin/leads. It is never committed and has no effect on production.
> If it is missing on your machine, create it from the template in section "Admin sign-in (local)" below (the password is your `ADMIN_SECRET`).

Everything below was checked against the code in this repo. Items marked **(not run)** were read from the source but not executed.

## 1. Topology: is there a separate backend?
**No.** Every `/api/*` endpoint (auth/OTP, leads, callbacks, licenses, portal, admin, health, cron) is a Next.js route handler inside `apps/magharebit-web`. One process, one port. External services it talks to:

| Service | Needed for | Required locally? |
|---|---|---|
| **MongoDB** | OTP, sign-up, login, portal, admin merchants, products seed | **Yes, with no fallback** for the routes in the box below. Leads, callbacks, subscribers and part of licenses fall back to local JSON in `data/` |
| Resend (email) | Email OTP delivery | No: without `RESEND_API_KEY` the OTP is printed to the server console (dev only) |
| Green API (WhatsApp) | WhatsApp OTP, lead notifications, license delivery | No, but WhatsApp OTP then cannot be completed (see 5) |
| Twilio | SMS OTP fallback | No |
| `NEXT_PUBLIC_API_URL` | `/api/demo-request` forwards to `<url>/marketing/demo-request` (fire-and-forget, errors swallowed) | No: leave **unset** locally so test data is not posted anywhere |

### Hard MongoDB dependency (no JSON or in-memory fallback)
These routes return **HTTP 503** when the database is unreachable, so on a machine that cannot reach MongoDB, sign-up, login and the portal are untestable:

`/api/auth/send-otp` · `/api/auth/send-otp-email` · `/api/auth/send-otp-sms` · `/api/auth/verify-otp` · `/api/auth/complete-signup` · `/api/portal/auth/login` · `/api/portal/products/seed`

Other portal and admin-merchant routes use MongoDB repositories with no JSON fallback either. OTP codes and sessions live in the `otp_sessions` and `auth_sessions` collections. `/api/health` shows the state: `{"server":"ok","db":"ok|error"}`, status 503 when `db` is `error`.

## 2. Install
Node 20+ (tested on Node 24, npm 12). The app installs **its own** dependencies from its own `package-lock.json`, exactly as Vercel does:
```bash
cd apps/magharebit-web
npm ci
```
npm warns that the install scripts of `sharp` and `unrs-resolver` were blocked; both ship prebuilt binaries and load fine, so this is harmless.

**Never link `node_modules` to another checkout or worktree** (for example a junction from `GreenGo-web/node_modules` to `GreenGo pos/node_modules`). Next then loads React and itself from the other tree and its file watcher walks outside the workspace. `next.config.ts` pins `outputFileTracingRoot` to this folder for the same reason.

## 3. Environment: `apps/magharebit-web/.env.local` (git-ignored; never commit)
Sanitized template. Replace every `<...>`; get real values from the owner over a secure channel.
```dotenv
# Public
NEXT_PUBLIC_BASE_URL=http://localhost:3004
NEXT_PUBLIC_APP_URL=http://localhost:3004
# NEXT_PUBLIC_API_URL=            # leave unset locally (see table above)
NEXT_PUBLIC_DEMO_VIDEO_URL=       # optional; empty shows a placeholder
NEXT_PUBLIC_DOWNLOAD_WINDOWS_URL= # optional; empty shows "coming soon"
NEXT_PUBLIC_DOWNLOAD_ANDROID_URL= # optional

# Admin. SERVER-ONLY: never put a NEXT_PUBLIC_ prefix on this.
# It is the admin login password and the x-admin-secret value for scripts.
ADMIN_SECRET=<local-admin-password>

# Sessions, OTP hashing, license keys, employee PINs and the ADMIN SESSION COOKIE derive from this.
# Generate once: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Changing it later invalidates existing sessions, license keys and PIN hashes.
NEXTAUTH_SECRET=<64-hex>
NEXTAUTH_URL=http://localhost:3004

# Database (required for login/portal/admin merchants)
MONGODB_URI=<mongodb+srv://user:password@host/magharebit?...  OR  mongodb://127.0.0.1:27017/magharebit>
MONGODB_DB=magharebit

# Optional integrations
RESEND_API_KEY=                   # unset: email OTP is printed in the server console
EMAIL_FROM=MAGHAREBIT <contact@magharebit.com>   # only used when RESEND_API_KEY is set; sender domain must be verified
GREEN_API_BASE_URL=https://api.green-api.com
GREEN_API_INSTANCE_ID=
GREEN_API_API_TOKEN=
WHATSAPP_BUSINESS_NUMBER=<number>
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
CRON_SECRET=                      # /api/cron/daily-report only
```
**`NEXT_PUBLIC_ADMIN_PASSWORD` no longer exists.** If it is still in your `.env.local`, delete it (it is ignored by the code now). The code reads `NEXT_PUBLIC_BASE_URL` for sitemap/robots; `DEPLOY.md`'s old mention of `NEXT_PUBLIC_SITE_URL` is not read.

## 4. Run
From `apps/magharebit-web`:
```bash
npm run dev
```
This runs `next dev -p 3004`. (In the full monorepo checkout, `npm run dev` at the repo root runs `turbo run dev` and starts every workspace: use `npm run dev -w magharebit-web` there.)
- Dev server crash `SyntaxError: Unexpected end of JSON input` / `Unexpected non-whitespace character after JSON` (from `next-dev-server.js`): Next's dev server corrupted `.next/prerender-manifest.json` when two routes compiled at once. Fixed in code (`src/lib/static-params.ts`: static params are only generated for `next build`). If you still have a cache from before the fix, stop the server, delete `.next` and start again.
- Frontend: **http://localhost:3004** (default locale `/ar`; also `/fr`, `/en`). No separate API port.
- The first request to each route compiles it (15-60 s). Dev serves `/_next/static/*` with `Cache-Control: immutable`, so after code changes do a **hard refresh** (Ctrl+Shift+R) or you may see stale JavaScript.
- Stop it with Ctrl-C in the terminal that runs it. See Troubleshooting if the port stays busy.
- Health: `GET /api/health`. `GET /api/admin/health` needs an admin session or `x-admin-secret: <ADMIN_SECRET>`.

## 5. Database, test flows and credentials
- **No automatic seeding.** Options: `npx tsx scripts/test-mongodb.ts` (connection check) and `npx tsx scripts/migrate-json-to-mongodb.ts` (copies `data/*.json` into Mongo), run from `apps/magharebit-web` **(not run)**. `POST /api/portal/products/seed` seeds demo products for a logged-in merchant.
- **Local Mongo instead of Atlas:** a plain `mongodb://127.0.0.1:27017/magharebit` URI should work with the driver **(not run; Docker/mongod not tested here)**.
- **OTP in development:** use the **email** OTP option in the sign-up/login UI. With no `RESEND_API_KEY` the server console prints `[send-otp-email] ── DEV MODE ──` with the code. The **WhatsApp** OTP route stores only a hash and never prints the code, so it cannot be completed without a working Green API. SMS needs Twilio.
- **There are no built-in test accounts or bypass flags** in the code.

### Admin sign-in (local)
Open `http://localhost:3004/fr/admin/leads`. **Identifiant:** leave empty (or type `owner`). **Mot de passe:** the value of `ADMIN_SECRET` in your `apps/magharebit-web/.env.local`. There is deliberately no shared default password: each machine sets its own. Print yours in your own terminal with `grep ADMIN_SECRET apps/magharebit-web/.env.local`. Per-admin accounts (operator/viewer) are created by the owner under Admins.

### Admin pages
`/ar/admin/leads`, `/ar/admin/licenses`, `/ar/admin/merchants`.
- The password is whatever you put in `ADMIN_SECRET`. The page posts it to `POST /api/admin/login`; the server checks it and sets an **HttpOnly, SameSite=Strict cookie** (`mgh_admin`, 8 hours). The browser never sees the secret, and a reload keeps you signed in. `POST /api/admin/logout` ends the session.
- Login needs **both** `ADMIN_SECRET` and `NEXTAUTH_SECRET`; otherwise it returns 503 ("لوحة الإدارة غير مهيأة على الخادم").
- Limit: 10 login attempts per 15 minutes per IP (stored in MongoDB when it is configured, so shared by all instances; in-memory otherwise). In dev every local request shares one bucket, so after ten bad tries you get 429 until you wait or restart the server.
- Scripts can skip the cookie: `curl -H "x-admin-secret: <ADMIN_SECRET>" http://localhost:3004/api/leads`.

### Merchant approval and the license key (verified from the route)
`POST /api/admin/merchants/[id]/approve` body `{ "plan": "Starter|Business|Enterprise", "durationMonths": 1|3|6|12|24 }` (defaults Starter, 12).
1. Works only on merchants in status `pending`. Already-approved returns 409 with the existing license; suspended returns 409.
2. **The license key is generated here and nowhere earlier**, via `licensesRepo.create`. Format: `MGH-YYYYMM-XXXXXXXX-XXXX-CC` (e.g. `MGH-202606-A3F91B2C-E47D-K9`).
3. The merchant is then marked approved atomically. If two admins approve at once, the loser's license is revoked automatically and it returns 409.
4. The key is sent to the merchant by **WhatsApp** (Green API). Delivery failure does **not** block approval. The response (201) always contains the full `license` object and `whatsapp: { sent, messageId?, error? }`.
5. Where QA sees the key without WhatsApp: the approval result panel on `/ar/admin/merchants`, and `/ar/admin/licenses` (keys are masked there; click the eye icon to reveal).

### Merchant portal
`/ar/portal/login` needs the merchant's email/phone **and** that license key, and the merchant must be `approved`. End-to-end path: sign up with **email OTP** → approve in `/ar/admin/merchants` → log in at `/ar/portal/login`.

## 6. Troubleshooting
| Symptom | Cause / fix |
|---|---|
| `Port 3004 is in use`, or old pages keep appearing after you stopped the server | A `node ... next/dist/server/lib/start-server.js` process outlived its terminal (the `npm` wrapper can leave it behind). **PowerShell:** `Get-NetTCPConnection -LocalPort 3004 -State Listen \| Select OwningProcess` then `Stop-Process -Id <PID>`. **cmd:** `netstat -ano \| findstr :3004` then `taskkill /PID <PID> /F`. Confirm it is a Next dev server before killing. Repeat for any other port you used |
| Started something on many ports at once | You ran `npm run dev` at the repo root (turbo). Stop it and use `npm run dev -w magharebit-web` |
| Stale UI after a code change | Hard refresh (Ctrl+Shift+R). Dev chunks are cached as immutable |
| `/api/health` → 503, `db: error`; log shows `tlsv1 alert internal error` / `SSL alert number 80` | MongoDB Atlas is rejecting this machine. See "Atlas allowlist" below |
| Sign-up / login / OTP / portal → 503 | MongoDB unreachable (see section 1). Fix the DB first |
| Admin login → 503 `admin_not_configured` | `ADMIN_SECRET` or `NEXTAUTH_SECRET` missing in `.env.local`. Restart the server after editing env files |
| Admin login → 429 | 10 failed attempts in 15 minutes; wait or restart the dev server |
| Admin pages fall back to the login form after a while | The 8-hour session expired, or `ADMIN_SECRET` / `NEXTAUTH_SECRET` changed |
| WhatsApp OTP "sent" but no code | No Green API configured. Use the email OTP option |

### Atlas allowlist (must be done by someone with Atlas access)
The `tlsv1 alert internal error` above is the usual symptom of a client IP that is **not** in the cluster's Network Access list (or a paused cluster). An agent without Atlas credentials cannot fix this. In Atlas: **Security → Network Access → Add IP Address → Add Current IP Address** (each QA machine and each new network needs its own entry), or point `MONGODB_URI` at a local Mongo. Prefer specific IPs over `0.0.0.0/0`.

## 7. Security notes
1. **Fixed in this branch:** the admin secret used to be shipped to every visitor as `NEXT_PUBLIC_ADMIN_PASSWORD`. The code no longer reads that variable and the secret stays on the server (verified: the old value, set deliberately in the test environment, appears 0 times in the admin pages' HTML and 14 JavaScript bundles). **Because the old value was public, rotate `ADMIN_SECRET` and delete `NEXT_PUBLIC_ADMIN_PASSWORD` in every deployed environment.** Admin access is still one shared password; per-user auth is a later task.
2. **`DEPLOY.md` no longer contains the Atlas host, database user, shard names or Green API instance ID** (replaced with placeholders). They remain in git **history** (commit `617c5e6` and the pushed branch). No password was ever in them, but treat the names as known: keep the repo private, keep the Atlas allowlist tight, and use a least-privilege Atlas user (`readWrite` on `magharebit` only, not `readWriteAnyDatabase`). Removing them from history would need a force-push and is a deliberate owner decision.
3. `.env.local` holds live secrets (Mongo, Twilio, Green API, session secret). It is git-ignored. Use separate throwaway values for QA.
4. **Fixed:** there is no hard-coded fallback secret any more. Merchant sessions, OTP sessions, license keys and the admin session all fail closed (503) when `NEXTAUTH_SECRET` is unset. Always set it.
