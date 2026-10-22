# POS ↔ Central Admin: license contract

**Contract version: 2.0 (specification FINAL, server implementation DONE and tested; not yet deployed).**
Audience: the POS Logiciel team. This file is read-only reference for them; it changes only through a reviewed PR.

| | Status |
|---|---|
| **v1** (typable key + `POST /api/licenses/validate`) | **Live.** Section 2. Keep working until v2 is announced live. |
| **v2** (signed license token, terminal limits, JWKS) | **Implemented on the server (branch `feat/magharebit-web`), 63 end-to-end checks passing on real MongoDB; becomes live when deployed with a signing key configured.** Do not ship v2 verification against production until `GET /api/licenses/jwks` answers 200 and `activate` returns a token (section 3.6). Build and test against the test vector in section 6 now. |

Base URL: the site origin (e.g. `https://magharebit.com`). All bodies are JSON, UTF-8, `Content-Type: application/json`.

## 1. Concepts

- **License key** (v1, unchanged): short typable code the merchant receives, e.g. `MGH-202610-234EC341-3667-C4`. It is a *handle*: it identifies a license record on the server. It carries no expiry and cannot be verified offline.
- **License token** (v2): a signed JWT the POS receives after activation. It carries expiry, plan and terminal limits and **is verified offline** with a public key.
- **Signing, not encryption.** The token is signed (integrity and origin). It is not encrypted: its contents are not secret and the POS may read them. Do not treat it as confidential.

## 2. v1: live behaviour

### Key format
`MGH-{YYYYMM}-{8 hex}-{4 hex}-{2 hex}`, upper case. `YYYYMM` is the issuance month, not the expiry. The last two characters are a keyed checksum that **the POS cannot verify** (secret is server-side) and is not a security control. Use only this shape check for typo detection: `^MGH-\d{6}-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{2}$`.

### `POST /api/licenses/validate` (public, no auth header)
Request: `{ "key": "MGH-…", "machineId": "optional, max 128 chars" }`. `machineId` is recorded at first activation and not enforced.

Valid:
```json
{ "valid": true, "key": "MGH-…", "plan": "Starter|Business|Enterprise", "storeName": "string",
  "expiresAt": "2027-04-21T16:49:25.089Z", "daysRemaining": 182, "firstActivation": true,
  "isTrial": false, "maxRegisters": 3, "maxBranches": 2,
  "features": ["basic_pos", "receipts", "inventory", "discounts"] }
```
Invalid: `{ "valid": false, "reason": "invalid_key" | "checksum_failed" | "expired" | "revoked" }` (HTTP 200). A non-JSON request gets 400 `{ "valid": false, "reason": "invalid_request" }`.

### Plan limits (source: `src/lib/plans.ts`)
| Plan | maxRegisters | maxBranches | features |
|---|---|---|---|
| Starter | 1 | 1 | basic_pos, receipts |
| Business | 3 | 2 | + inventory, discounts |
| Enterprise | 10 | 5 | + api_access, advanced_analytics |

Trial licenses: Starter limits, `isTrial: true`, 14 days.

### Intended POS behaviour (v1)
Valid: unlock and cache the response with a local timestamp. Invalid: lock/activation screen. Network error: use the cached response with a **72 h** grace. Call at startup and daily.

## 3. v2: specification

### 3.1 Token format: JWT (RFC 7519), signed with EdDSA / Ed25519 (RFC 8037)
Compact serialization: `base64url(header).base64url(payload).base64url(signature)`.

Header:
```json
{ "alg": "EdDSA", "typ": "JWT", "kid": "2026-10" }
```
- Signature: **Ed25519** over the ASCII bytes of `base64url(header) + "." + base64url(payload)`. 64 bytes.
- Any standard JOSE library works (for example `jose`, `jsonwebtoken` with EdDSA support, libsodium). **Reject** any token whose `alg` is not exactly `EdDSA` (never `none`, never HS*), and any `kid` you do not hold a key for.

### 3.2 Payload (claims)
Times are integer seconds since the Unix epoch, UTC.

| Claim | Type | Meaning |
|---|---|---|
| `iss` | string | Always `https://magharebit.com`. Check it. |
| `aud` | string | Always `magharebit-pos`. Check it. |
| `sub` | string | Merchant id (normalised phone `212XXXXXXXXX`, or email for email-only sign-ups). |
| `jti` | string | License id, e.g. `LIC-MG1X2Y-4F2A`. Stable across refreshes of the same license. |
| `iat` | int | When this token was issued by the server. |
| `nbf` | int | Not valid before. Equals `iat`. |
| `exp` | int | **End of the licensed period.** Hard stop. See 3.4. |
| `refreshBy` | int | Latest time by which the POS must have refreshed online. See 3.4. |
| `schema` | int | `2`. Private-claim schema version; ignore tokens with a higher major you do not know. |
| `plan` | string | `Starter` \| `Business` \| `Enterprise`. |
| `trial` | bool | `true` for the 14-day trial. |
| `maxRegisters` | int | Terminal limit. See 3.5. |
| `maxBranches` | int | Branch limit (informational for the POS; enforced where branches are created). |
| `features` | string[] | Feature flags the POS must honour. Unknown flags: ignore. |
| `machineId` | string | The terminal this token was issued to (sent at activation). |

Durations, coupons and trial modifiers are **resolved by the server into `exp`**. The POS never sees or interprets a "1 month / 6 months / coupon" value.

### 3.3 Endpoints (v2)

**`POST /api/licenses/activate`** registers the terminal and returns a token.
Request: `{ "key": "MGH-…", "machineId": "stable terminal id, 8-128 chars" }`
Success (200):
```json
{ "valid": true, "schema": 2, "token": "<JWT>", "plan": "Business", "storeName": "string",
  "expiresAt": "2027-04-21T16:49:25.089Z" }
```
Failure (200): `{ "valid": false, "reason": "invalid_key" | "checksum_failed" | "expired" | "revoked" | "suspended" | "terminal_limit" }`.

**`POST /api/licenses/validate`** (existing). With v2 live it additionally returns `"schema": 2` and a fresh `"token"` (same shape as above) for a key and `machineId` that are already activated. Existing v1 fields are unchanged, so v1 clients keep working. New failure reasons (additive): `suspended`, `terminal_limit`. Treat any unknown `reason` as "not valid".

**`GET /api/licenses/jwks`** public keys in standard JWKS format:
```json
{ "keys": [ { "kty": "OKP", "crv": "Ed25519", "x": "<base64url 32 bytes>", "kid": "2026-10", "alg": "EdDSA", "use": "sig" } ] }
```
Several keys can be live during rotation; pick by `kid`. Ship the current JWKS inside the POS build as a fallback and refresh it online.

### 3.4 How the POS interprets time
Let `now` be trusted time (see rollback guard), in seconds.
1. Verify the signature, `alg`, `kid`, `iss`, `aud`, then `schema`.
2. **Not yet valid:** `now < nbf - 300` (5 min skew allowed) → reject.
3. **Expired:** `now >= exp` → the license has ended. **No grace after `exp`.** The POS goes read-only: a sale already in progress may be completed, the next sale attempt is refused (consistent with the platform's license-expiry rule, RCT-03).
4. **Offline window:** the POS must refresh online (call `validate`) at least every 7 days. If `now > refreshBy + 72 h` and no successful refresh happened, treat the license as lapsed until a refresh succeeds. Between `refreshBy` and `refreshBy + 72 h` keep working and retry in the background.
5. **Refresh** returns a new token with a later `refreshBy`; replace the cached one. If the server answers `revoked`, `suspended` or `expired`, apply it immediately even before `refreshBy`.
6. **Clock rollback guard:** persist the highest trusted time seen (from tokens and server `Date` headers). If the device clock is more than 24 h behind it, treat time as untrusted: do not extend validity, and require an online refresh.
7. Show `daysRemaining = ceil((exp - now) / 86400)` in the UI; warn at 14, 7 and 1 days.

### 3.5 Terminal limits
- `maxRegisters` is the number of **distinct terminals** that may hold an active activation for the license at the same time.
- Each terminal sends a stable `machineId` (survives app restarts and reinstalls on the same device; not a user-editable value). `activate` registers it; once the number of distinct `machineId`s equals `maxRegisters`, a new one gets `{ "valid": false, "reason": "terminal_limit" }`.
- The token's `machineId` claim binds it to its terminal: **reject a token whose `machineId` differs from the local one**. A token copied to another device is therefore useless.
- Freeing a slot (device replaced) is an admin action; the POS cannot do it.
- Enforcement of `maxBranches` and `features` is the POS's responsibility using the claims.

### 3.6 Rollout signal
Until the operator configures a signing key, `GET /api/licenses/jwks` and `POST /api/licenses/activate` answer **503** (`v2_not_configured`) and `validate` stays v1-only. When the key is set: `jwks` answers 200, `activate` returns tokens, and `validate` adds `"schema": 2` and a token for registered terminals. Use v1 only until then.

Other server rules worth knowing:
- `validate` and `activate` are rate limited per IP (120 and 60 requests per minute); a 429 means back off and keep the cached token.
- Revoking one license, extending it, switching a merchant off (`suspended`) and freeing a terminal are all admin actions that take effect on the next refresh.
- A suspended merchant is a reversible switch: the license is untouched and `validate`/`activate` answer `suspended` until the admin switches the merchant back on.

### 3.7 Key management (server side, for information)
Private signing key lives only in the server secret store (`LICENSE_SIGNING_PRIVATE_KEY`, with `LICENSE_SIGNING_KID`); never in the repo or POS. Generate one with `node scripts/gen-license-keypair.mjs <kid>` and copy the two printed lines into the secret store; the script prints the public JWK too. Rotation: a new `kid` is added to the JWKS while the old one stays until its tokens expire. A compromised key is retired by removing its `kid`; the POS then rejects those tokens after the next JWKS refresh.

## 4. Error handling summary
| Situation | POS action |
|---|---|
| Signature/alg/kid/iss/aud/machineId invalid | Reject token; treat as unlicensed; show activation screen. |
| `now >= exp` | Read-only; show renewal message. |
| Server says `revoked` / `suspended` | Lock immediately; show the message; no grace. |
| Server unreachable | Keep working until `refreshBy + 72 h`; then lapsed. |
| `terminal_limit` | Show "too many terminals", contact support. |

## 5. Compatibility
v1 keys and `validate` responses remain valid after v2 launches. A v1-only POS keeps working; it just does not get offline-verifiable expiry or terminal-limit enforcement.

## 6. Test vector (TEST KEY ONLY, never use in production)
Public key (JWK):
```json
{ "kty": "OKP", "crv": "Ed25519", "x": "fcISkcYB-FLx2RII_D0cJYNF1By2hNyy9rgl3WfsHLk", "kid": "test-vector-1", "alg": "EdDSA", "use": "sig" }
```
Token:
```
eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6InRlc3QtdmVjdG9yLTEifQ.eyJpc3MiOiJodHRwczovL21hZ2hhcmViaXQuY29tIiwiYXVkIjoibWFnaGFyZWJpdC1wb3MiLCJzdWIiOiIyMTI2MDAwMDAwMDEiLCJqdGkiOiJMSUMtVEVTVFZFQ1RPUi0wMDAxIiwiaWF0IjoxNzkwMDAwMDAwLCJuYmYiOjE3OTAwMDAwMDAsImV4cCI6MTgwNTAwMDAwMCwicmVmcmVzaEJ5IjoxNzkwNjA0ODAwLCJzY2hlbWEiOjIsInBsYW4iOiJCdXNpbmVzcyIsInRyaWFsIjpmYWxzZSwibWF4UmVnaXN0ZXJzIjozLCJtYXhCcmFuY2hlcyI6MiwiZmVhdHVyZXMiOlsiYmFzaWNfcG9zIiwicmVjZWlwdHMiLCJpbnZlbnRvcnkiLCJkaXNjb3VudHMiXSwibWFjaGluZUlkIjoiUE9TLURFTU8tMDEifQ.84nUFqrWKzLAb9kohRGwXFHBZopcxwxQZNSFhA_ddoJY2crw71YiHCTLWTfLaby9PaP1TQ7GOiRyLQ4LomRBDg
```
Decoded payload:
```json
{ "iss": "https://magharebit.com", "aud": "magharebit-pos", "sub": "212600000001", "jti": "LIC-TESTVECTOR-0001",
  "iat": 1790000000, "nbf": 1790000000, "exp": 1805000000, "refreshBy": 1790604800,
  "schema": 2, "plan": "Business", "trial": false, "maxRegisters": 3, "maxBranches": 2,
  "features": ["basic_pos", "receipts", "inventory", "discounts"], "machineId": "POS-DEMO-01" }
```
A correct verifier: accepts this token with that key; rejects it if any payload byte is changed (the signature then fails); rejects it with `machineId` other than `POS-DEMO-01`; treats it as expired when `now >= 1805000000`; as needing refresh when `now > 1790604800 + 259200`.

## 7. Open points for the POS team
- Confirm the runtime can verify Ed25519 (EdDSA) JWTs offline.
- Confirm a stable `machineId` source on every target platform (Windows, Android).
- Confirm they can adopt the 7 day refresh + 72 h grace.
