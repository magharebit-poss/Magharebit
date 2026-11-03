# Merge and launch checklist (feat/magharebit-web into main)

Date: 2026-11-03. Detailed variable descriptions live in `.env.example` and `DEPLOY.md` section 1; this is the short list.

## Merge state

- `origin/main` is 0 commits ahead of `feat/magharebit-web` (58 commits ahead), so the merge is a fast-forward with no conflicts.
  Every changed path is under `apps/magharebit-web/`; nothing in the POS app, backend or packages is touched.
- Recommended: open a PR (not a direct push to main) so Vercel builds a preview and CI runs, then merge.
- Vercel project settings: Root Directory `apps/magharebit-web`, Framework Next.js, Node 20+, build `next build`.
  `vercel.json` already schedules `/api/cron/daily-report` at 20:00 UTC.

## Environment variables to set in the Vercel dashboard (Production)

Required (the site fails closed or loses core flows without them):

| Variable | Notes |
|---|---|
| `ADMIN_SECRET` | Server-only, random 64-hex. Admin login returns 503 without it. Rotate the old value (see DEPLOY.md). |
| `NEXTAUTH_SECRET` | Server-only, random 64-hex. Signs sessions, licence keys and PIN hashes; changing it later invalidates them. |
| `MONGODB_URI`, `MONGODB_DB` | Production Atlas cluster (`mongodb+srv://` is fine on Vercel). OTP, signup, login and portal return 503 without it. Allow Vercel egress in the Atlas IP access list. |
| `CRON_SECRET` | Protects the daily-report cron. |
| `NEXT_PUBLIC_BASE_URL` | `https://magharebit.com` (or the final domain). Build-time: redeploy after changing. |
| `NEXT_PUBLIC_APP_URL` | Same domain; used in WhatsApp templates. |

Needed for the features advertised on the site (leave unset and that feature degrades, it does not crash):

| Variable | Feature |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | Email OTP. Unset in production means no email OTP is delivered (the dev console fallback is disabled in production). Sender domain must be verified. |
| `GREEN_API_INSTANCE_ID`, `GREEN_API_API_TOKEN` (`GREEN_API_BASE_URL` optional) | WhatsApp OTP, lead and licence messages. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS OTP fallback. |
| `WHATSAPP_BUSINESS_NUMBER` | Team alert number; defaults to the number in `lib/brand.ts`. |

Optional: `NEXT_PUBLIC_DEMO_VIDEO_URL`, `DOWNLOAD_WINDOWS_URL`, `DOWNLOAD_ANDROID_URL` (POS not released: leave empty),
`PUBLIC_OTP_PER_HOUR`, `PUBLIC_WA_PER_HOUR`, `GREEN_API_TIMEOUT_MS`.

Must NOT exist anywhere: `NEXT_PUBLIC_ADMIN_PASSWORD`, `ALLOW_LOCAL_BASE_URL`, `NEXT_DIST_DIR`, any `localhost` value
for `NEXT_PUBLIC_BASE_URL`.

## Before the domain switch

1. Decide `SHOW_KDS` in `src/lib/brand.ts` (see "Open items").
2. Cloudflare: apply the edge checklist in `docs/security-edge-cloudflare.md` (WAF, rate rules, origin lock).
3. Confirm the Atlas database user is least-privilege and the production DB has the TTL/rate-limit collections created by first use.
4. Smoke the preview deployment: `/fr`, `/ar`, `/fr/features`, submit one lead, one signup with a real OTP provider.

## Open items (need an owner decision, not code)

- `SHOW_KDS`: no KDS is described in the engineering rules or docs. Keep only if it ships at launch.
- `ComparisonSection.tsx` has a `TODO(verify before launch)`: competitor-category claims are unverified.
- About page names a founder and team members in the dictionaries; confirm they are real and consent to being listed.
- Licence/provenance of the three stock-style photos in `public/media/`.
