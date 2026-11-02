# Security audit: `/api/portal/*` and `/api/auth/*`

Date: 2026-11-02. Scope: every route under `src/app/api/portal` (31 handlers) and `src/app/api/auth` (5), their
repositories (`src/lib/repositories/*`), `src/lib/portal-session.ts`, `src/lib/otp.ts`. Method: code review of every
handler and every MongoDB call, then black-box checks against a dev server with two real merchants
(`scripts/e2e/portal-security-e2e.mjs`, 41 checks).

Out of scope (AGENTS.md): CMI payment hooks and S3-004/S3-005 (human-written only); `apps/pos-web`, `backend/`.

## Summary

| ID | Severity | Title | Status |
|---|---|---|---|
| SEC-01 | High | Employee PIN brute force (no attempt limit) | Fixed |
| SEC-03 | High | Portal sale deducts stock with no check: stock goes negative (LAW 1) | **Open — human fix** |
| SEC-04 | Medium | Product create/update store any JSON type (negative stock, object prices) | Fixed |
| SEC-05 | Medium | Manual stock adjustment accepts NaN and any decrease (LAW 1) | Fixed |
| SEC-06 | Medium | Sessions survive suspension / license revocation for up to 7 days | **Open — design decision** |
| SEC-02 | Low | PIN hash compared with `!==` (timing) | Fixed |
| SEC-07 | Low | Session tokens: secret-suffix SHA-256 instead of HMAC, `exp` optional | Fixed |
| SEC-08 | Low | Portal login: non-string fields crash the handler (500) | Fixed |
| SEC-09 | Low | Account enumeration through distinct login errors | Open (accepted?) |
| SEC-10 | Info | `SameSite=Lax` kept rather than `Strict` | Decision needed |
| SEC-11 | Info | No Content-Security-Policy header | Open (outside these routes) |

Verified sound (no change needed):
- **Tenant isolation.** Every read and write on products, customers, transactions, suppliers, purchase orders,
  employees, settings, campaigns and logos filters on the `merchantId` from the signed session; no route takes a
  merchant id from the body or the query. The two `_id`-only updates (`employees.verifyPin` lastLoginAt, campaign
  completion) follow a tenant-scoped read of the same document. Proven for 6 resource types with 13 cross-tenant
  calls (all 404, data unchanged).
- **Operator injection through the query string**: `searchParams.get()` always returns a string; search terms are
  regex-escaped before use (`customers`, `products`, `suppliers`).
- **OTP**: 5 attempts per OTP session (atomic `$inc`), sending is rate-limited, the hash compare is constant time.
- **Logs**: no phone, email, license key or OTP is logged in production. The only such log
  (`send-otp-email`, "DEV MODE") is guarded by `NODE_ENV !== 'production'`. Daily-report logs carry the merchant
  ObjectId only.
- **Client bundle**: no secret uses a `NEXT_PUBLIC_` name. `NEXT_PUBLIC_ADMIN_PASSWORD` was removed in 208509f and
  is no longer read; it is not defined locally. **Check that it is also deleted in the Vercel dashboard.**
- **Frame restrictions**: `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy` on every route.

---

## SEC-01 — High — CWE-307 Improper Restriction of Excessive Authentication Attempts

**File & vector.** `src/app/api/portal/employees/pin-login/route.ts` `POST`. `loginId` + `pin` were checked with no
limit. PINs are 4–6 digits (10 000 values at 4).

**Impact.** Anyone holding the merchant session (any cashier at the shared till) can enumerate a manager's or the
owner's PIN in minutes and act with their role — e.g. the manager-PIN gates of LAW 1 (stock override) and LAW 4
(restock approval) once the POS relies on this route.

**Patch (applied).** 10 attempts per merchant + loginId per 15 minutes in the shared MongoDB rate-limit store
(`checkRateLimit`), counted *before* verification so a correct guess after the limit is still refused; `429` with
`Retry-After`. A failure-only counter was rejected: it would still accept a correct guess past the limit. Body
fields must be strings (an object is a 422).

**Verification.** `portal-security-e2e`: 10 wrong guesses → 401, the 11th with the right PIN → 429; another login
of the same merchant is unaffected; operator objects → 422. `portal-batch3-e2e` (PIN change, sign-in) still passes.

## SEC-02 — Low — CWE-208 Observable Timing Discrepancy

**File & vector.** `src/lib/repositories/employees.ts` `verifyPin`: `doc.pinHash !== hashPin(pin)`.

**Impact.** Leaks how many leading hex characters of the peppered hash match. Not practically exploitable on its own
(the hash is keyed with the server secret), but it is the pattern the brief forbids.

**Patch (applied).** Compare the decoded hashes with `crypto.timingSafeEqual` after a length check.

**Verification.** Code review; PIN sign-in with the right and wrong PIN behaves as before (security + batch 3 suites).

## SEC-03 — High — CWE-362 / CWE-20, LAW 1 (negative stock) — OPEN, needs a human fix

**File & vector.** `src/lib/repositories/transactions.ts` `create`: the product is read, the transaction is inserted,
then each line calls `productsRepo.adjustStock(…, -qty, 'sale')`, an unconditional `$inc`. Nothing compares `qty`
with the stock; `src/app/api/portal/transactions/route.ts` maps an `insufficient_stock:` error that the repository
never throws.

**Impact.** Proven: stock 2, sale of 5 → `201`, stock −3. Concurrent sales overshoot the same way. This violates LAW 1
("negative stock is architecturally impossible… warn cashier, require manager PIN, log the override").

**Why it is not patched here.** This is the sale-deduction path. AGENTS.md classes BOM/deduction and the
soft-allocation engine as "draft only — human rewrites core", with a mandatory review and the S1-008/RCT-01 race gate.

**Draft for the reviewer (not applied).** Make the decrement conditional and atomic, and do it *before* inserting the
transaction (or inside a MongoDB transaction):

```ts
// per line, in one session/transaction:
const r = await db.collection('products').findOneAndUpdate(
  { _id: new ObjectId(item.productId), merchantId, stock: { $gte: item.qty } },
  { $inc: { stock: -item.qty }, $set: { updatedAt: new Date() } },
  { returnDocument: 'after', session },
)
if (!r) throw new Error(`insufficient_stock:${item.productId}`) // → 409, already mapped by the route
```

A manager-PIN override (LAW 1) would then be an explicit, logged second path. `productsRepo.adjustStock(…,
{ floorAtZero: true })` added for SEC-05 implements the same filter and can be reused.

**Verification once fixed.** The `INFO` line of `portal-security-e2e` turns into an assertion (409, stock unchanged);
add RCT-01 (10 concurrent sales on stock 5).

## SEC-04 — Medium — CWE-20 Improper Input Validation / CWE-1287 type confusion

**File & vector.** `src/app/api/portal/products/[id]/route.ts` `PATCH` copied allow-listed keys straight into `$set`
with no type check; `products/route.ts` `POST` used `Number()` / `String()` casts (NaN, objects stringified).

**Impact.** A merchant (or a script holding the session) could store `stock: -5`, `stock: "beaucoup"`,
`price: {"$gt":0}`, a 1 MB name, etc. Prices that are not numbers poison every total computed from them; negative
stock breaks LAW 1. Not cross-tenant (filters were scoped), but it corrupts the merchant's own books.

**Patch (applied).** `src/lib/product-input.ts` — one typed, bounded validator for create and update; values are
copied into a fresh object, unknown keys never reach MongoDB; malformed ids → 404 instead of a 500. `null` for an
optional field on create means "use the default" (what the UI sends for an empty input).

**Verification.** 7 hostile PATCH bodies → 422 with the field named; MongoDB unchanged; a valid PATCH with a UI unit
(`mL`) still works; POST with an operator object → 422; `portal-batch1-e2e` (product UI) passes.

## SEC-05 — Medium — CWE-20, LAW 1

**File & vector.** `products/[id]/adjust/route.ts`: `Number(body.delta)` (a string became `NaN` and was `$inc`'ed
into the stock); any decrease accepted.

**Patch (applied).** `delta` must be a finite number within bounds; the route calls
`adjustStock(…, { floorAtZero: true })`, which puts `stock: { $gte: -delta }` in the update filter, so the check and
the write are one atomic operation; a refused decrease returns `409 stock_would_be_negative` (translated in the
products page). Sales and purchase receipts keep the old behaviour (see SEC-03).

**Verification.** −1000 on 40 → 409, stock 40; `"abc"` → 422; **10 concurrent −5 on 40 → exactly 8 succeed, stock 0**.

## SEC-06 — Medium — CWE-613 Insufficient Session Expiration — OPEN

**File & vector.** `getPortalSession` only verifies the signed cookie. A merchant suspended by an admin, or whose
license is revoked, keeps full portal API access until the cookie expires (7 days); logout only deletes the cookie
in that browser.

**Recommendation (needs a decision, not applied).** Either (a) a `sessionVersion` on the merchant document, copied
into the token and compared on each request (one indexed read; bump it on suspend/revoke/"log out everywhere"), or
(b) server-side sessions (`portal_sessions` collection, token = random id). (a) is the smaller change; both make every
route's guard `async` (31 call sites).

## SEC-07 — Low — CWE-327 / CWE-347

**File & vector.** `portal-session.ts` and `otp.ts` signed tokens as `sha256(payload + ":" + secret)` (a custom
secret-suffix MAC) and accepted tokens without `exp` forever.

**Patch (applied).** One implementation in `otp.ts`: HMAC-SHA256, `exp` mandatory and numeric, exactly two segments;
`portal-session.ts` reuses it. Tokens in the old format stay valid until their own expiry (no forced logout); the
fallback stops being accepted on 10 Nov 2026 and can then be deleted.

**Verification.** HMAC token → 200; the issued cookie is HMAC; tampered payload, no `exp`, expired, extra segment →
401; old-format token → 200 (transition).

## SEC-08 — Low — CWE-20

`portal/auth/login`: `body.identifier.trim()` on a non-string threw → 500. Now strings only (bounded), else empty →
the existing `identifier_required` / 400. Verified with `{"$ne": null}` and a JSON array (400, no cookie). No
injection was possible before either (the value was never put in a query unconverted).

## SEC-09 — Low — CWE-204 Observable Response Discrepancy — open

`portal/auth/login` returns `account_not_found` vs `license_not_for_this_account` vs `account_pending`. Requires a
valid license key first, so the enumeration value is small; a single generic error would cost the merchant a clear
message. Recommend: keep, but add a per-IP rate limit on this route (none today).

## SEC-10 — Info — `SameSite=Lax` instead of `Strict`

Kept deliberately. `Strict` drops the cookie on every top-level navigation from another site, so a merchant opening
the portal from a WhatsApp or e-mail link would appear logged out. `Lax` already withholds the cookie from cross-site
`POST`/`PATCH`/`DELETE` and from cross-site `fetch`, and every state change here uses those methods. Cookies are
`HttpOnly`, `Path=/`, and `Secure` in production. Switch to `Strict` if you accept the link behaviour.

## SEC-11 — Info — no Content-Security-Policy

`next.config.ts` sets frame, MIME and HSTS headers but no CSP. Outside the two route families audited; a CSP for the
pages needs the inline JSON-LD and the Next runtime accounted for (nonce or hashes). Recommend a follow-up.
