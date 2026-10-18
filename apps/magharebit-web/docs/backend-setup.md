# MAGHAREBIT Backend Setup Guide

This guide covers provisioning MongoDB Atlas and Green API (WhatsApp), then connecting them to the Next.js app.

---

## MongoDB Atlas

### Step 1 — Create a cluster

1. Go to https://cloud.mongodb.com
2. Create a new project: **"magharebit-production"**
3. Create a free **M0 cluster** (sufficient for initial scale — up to 512 MB storage)
4. Choose the region closest to Morocco: **EU West (Paris or Frankfurt)**

### Step 2 — Create a database user

1. Go to **Database Access → Add New Database User**
2. Username: `magharebit-app`
3. Password: generate a strong password, save it securely in a password manager
4. Role: **readWrite** on database `magharebit`

### Step 3 — Whitelist connection IPs

1. Go to **Network Access → Add IP Address**
2. For Vercel deployment: add `0.0.0.0/0` (allow all — Vercel uses dynamic IPs)
3. For local development: add your current IP address

### Step 4 — Get connection string

1. Go to your cluster → **Connect → Connect your application**
2. Driver: **Node.js**, Version: **6.x**
3. Copy the connection string
4. Replace `<password>` with your database user password
5. The database name is already set via `MONGODB_DB` env var

### Step 5 — Set environment variables

**In `.env.local` (local development):**
```
MONGODB_URI=mongodb+srv://magharebit-app:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=magharebit
```

**In Vercel dashboard (production):**
- Go to **Settings → Environment Variables**
- Add the same two variables, set scope to **Production**

### Step 6 — Verify connection

With your dev server running (`npm run dev`):
```bash
curl -H "x-admin-secret: your_admin_secret" http://localhost:3004/api/admin/health
```

Expected response when connected:
```json
{
  "timestamp": "...",
  "database": { "connected": true, "database": "magharebit", "collections": [] },
  "whatsapp": { "configured": false, "businessNumber": "212619522487" },
  "environment": "development"
}
```

When using JSON fallback (no `MONGODB_URI` set):
```json
{
  "database": { "connected": false, "error": "MONGODB_URI not configured — using JSON fallback" },
  ...
}
```

> MongoDB indexes are created automatically on first write (idempotent). No manual setup needed.

---

## Green API (WhatsApp Business)

### Step 1 — Create an account

1. Go to https://greenapi.com
2. Sign up for an account
3. The **Developer plan** is free for testing (limited messages/day)

### Step 2 — Create an instance

1. Go to your dashboard → **Instances → Create instance**
2. Note the **Instance ID** (format: `110XXXXXXXXX`)
3. Note the **API Token** (long alphanumeric string)

### Step 3 — Authorize the WhatsApp number

1. In your instance settings, click **"Authorize"**
2. Scan the QR code with WhatsApp **on the phone number 0619522487**
3. Wait for instance status to show **"authorized"** (green)
4. The instance must stay authorized — if WhatsApp logs out on the phone, re-scan

### Step 4 — Set environment variables

**In `.env.local`:**
```
GREEN_API_BASE_URL=https://api.green-api.com
GREEN_API_INSTANCE_ID=110XXXXXXXXX
GREEN_API_API_TOKEN=your_api_token_here
WHATSAPP_BUSINESS_NUMBER=212619522487
```

### Step 5 — Test the integration

With dev server running:
```bash
curl -X POST http://localhost:3004/api/whatsapp-test
```

Expected response when Green API is configured:
```json
{ "success": true, "messageId": "BAE5F4886FBFA55..." }
```

Check the WhatsApp account for **0619522487** — you should receive:
> ✅ Test MAGHAREBIT — Green API fonctionne correctement!

**If you get `{ "success": false, "error": "Green API not configured" }`:**
→ Check that `GREEN_API_INSTANCE_ID` and `GREEN_API_API_TOKEN` are set in `.env.local`

**If you get `{ "success": false, "error": "HTTP 401: ..." }`:**
→ API token is incorrect — copy it again from Green API dashboard

**If you get `{ "success": false, "error": "HTTP 466: ..." }`:**
→ Instance is not authorized — re-scan the QR code on the phone

### How message sending works

When a lead submits the demo form, two messages are sent (non-blocking — form success is never delayed):
1. **Merchant confirmation** → sent to the lead's phone in their language (ar/fr/en)
2. **Admin notification** → sent to 0619522487 with the lead details and dashboard link

When a phone number subscribes to the newsletter:
1. **Welcome message** → sent to the subscriber in their language

All sends are fire-and-forget. If Green API is not configured, a `console.warn` is logged and the request succeeds normally.

---

## Vercel Deployment

After MongoDB and Green API are configured and tested locally:

### Step 1 — Add env vars to Vercel

```
MONGODB_URI=...
MONGODB_DB=magharebit
GREEN_API_BASE_URL=https://api.green-api.com
GREEN_API_INSTANCE_ID=...
GREEN_API_API_TOKEN=...
WHATSAPP_BUSINESS_NUMBER=212619522487
ADMIN_SECRET=...
NEXT_PUBLIC_ADMIN_PASSWORD=...  (same value as ADMIN_SECRET)
NEXT_PUBLIC_APP_URL=https://magharebit.com
```

### Step 2 — Deploy

```bash
git push origin main
# Vercel auto-deploys on push to main
```

### Step 3 — Verify production health

```bash
curl -H "x-admin-secret: your_admin_secret" https://magharebit.com/api/admin/health
```

Both `database.connected: true` and `whatsapp.configured: true` should appear.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Build fails with MongoDB error | `throw` in module scope | Already fixed — `getDb()` returns null safely |
| Leads saved to JSON, not MongoDB | `MONGODB_URI` not set | Add to `.env.local` |
| WhatsApp not sending | Instance not configured | Set `GREEN_API_INSTANCE_ID` and `GREEN_API_API_TOKEN` |
| WhatsApp auth error | Instance logged out | Re-scan QR code on 0619522487 |
| `/api/admin/health` returns 401 | Wrong `x-admin-secret` | Use the value of `ADMIN_SECRET` env var |
| Rate limit hit (429) | Too many form submissions | Wait 1 hour, or test with different IP |
