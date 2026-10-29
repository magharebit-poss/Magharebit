# Testing the merchant journey on a fresh local database

For `npm run dev` on port 3004 with the local Docker Mongo from `docs/local-setup.md`. There are **no seeded
accounts and no OTP bypass** in the code, on purpose. Two ways to get a merchant with a license key; both work
on an empty database.

## Path A: self-service sign-up (fastest, 14-day trial key)

1. Open `http://localhost:3004/ar/auth/signup` (or `/fr/auth/signup`).
2. Choose the **بريد إلكتروني / Email** tab (not WhatsApp: the WhatsApp code is never printed), type any
   address you like, send the code.
3. The code appears in the **terminal running `npm run dev`**, in a block starting with
   `[send-otp-email] ── DEV MODE ──` (only when `RESEND_API_KEY` is unset and not in production).
   Type it on the code screen.
4. Fill in the shop details and finish. The confirmation screen shows the real `MGH-…` trial key and opens a
   portal session. The merchant is approved automatically.

## Path B: lead → admin activation (the sales-led flow)

1. On the public site (`http://localhost:3004/ar`), click **تفضّل أن نتصل بك؟ / Préférez-vous être rappelé ?**
   under the hero buttons. In the pop-up, fill **اسم المحل / Nom du commerce** and **الهاتف (واتساب)** (a
   Moroccan number such as `0612345678`), then **تواصلوا معي / Être contacté**.
2. Admin: `http://localhost:3004/ar/admin` → sign in (password = `ADMIN_SECRET`) → sidebar **العملاء المحتملون /
   Prospects** → click the lead's row.
3. In the drawer, under **تفعيل الاشتراك / Activer l’abonnement**, choose the plan and duration, then
   **إنشاء مفتاح الترخيص / Générer la clé de licence**.
4. The drawer shows the key with **نسخ المفتاح / Copier la clé**. "WhatsApp not sent" is expected locally
   (Green API is not configured). The lead's phone is now an approved merchant.

There is no "add lead" button in the admin console: leads come from the public site (step 1). Merchants →
**Generate license** works only on a merchant that already exists (from either path).

## Signing in to the merchant portal

`http://localhost:3004/ar/portal/login`: **no OTP on this page**. It asks for the phone or email the merchant
signed up with, plus the license key. Path A: the email from step 2. Path B: the lead's phone (`0612345678`
and `212612345678` both work).

## Store logo

Portal → **الإعدادات** → **شعار المتجر**: click the zone, pick a PNG, JPG or WebP (up to 8 MB). The browser
shrinks it to 512 px on the long side (WebP), it is saved immediately (no Save button needed) and appears in
the sidebar avatar. **إزالة الشعار** removes it. SVG and GIF are refused. Details: `src/lib/store-logo.ts`.
