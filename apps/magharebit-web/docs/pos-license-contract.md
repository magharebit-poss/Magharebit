# POS ↔ Central Admin: license contract (read-only spec for the POS team)

Status: **v1 is the live behaviour (verified from source). v2 is a PROPOSAL** and is not implemented or final until the plan in `admin-licensing-plan.md` is approved. The POS team should not build against v2 yet; v1 stays supported.

Base URL: the site origin (e.g. `https://magharebit.com`). All bodies are JSON, UTF-8.

## v1: current behaviour

### Key format
`MGH-{YYYYMM}-{8 hex}-{4 hex}-{2 hex}`, upper case, for example `MGH-202606-A3F91B2C-E47D-K9`.
- `YYYYMM` is the issuance month. It is **not** the expiry.
- The last 2 characters are a keyed checksum (first 2 hex chars of HMAC-SHA256 with a server secret). **The POS cannot verify it** (the secret is server-side) and it is not a security control. Use only the shape regex for typo detection: `^MGH-\d{6}-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{2}$`.
- Expiry, plan and status exist **only on the server**. The POS must call `validate`.

### `POST /api/licenses/validate`
Public, no auth header.

Request:
```json
{ "key": "MGH-202606-A3F91B2C-E47D-K9", "machineId": "optional string, max 128 chars" }
```
`machineId` is recorded on the first successful call (first activation) and is not enforced afterwards.

Responses, all with HTTP 200 unless the body is not JSON (400 `{ "valid": false, "reason": "invalid_request" }`):

Valid:
```json
{
  "valid": true,
  "key": "MGH-…",
  "plan": "Starter | Business | Enterprise",
  "storeName": "string",
  "expiresAt": "2026-12-01T00:00:00.000Z",
  "daysRemaining": 42,
  "firstActivation": true,
  "isTrial": false,
  "maxRegisters": 3,
  "maxBranches": 2,
  "features": ["basic_pos", "receipts", "inventory", "discounts"]
}
```
Invalid: `{ "valid": false, "reason": "invalid_key" | "checksum_failed" | "expired" | "revoked" }`

Plan limits today (source: `src/lib/plans.ts`):

| Plan | maxRegisters | maxBranches | features |
|---|---|---|---|
| Starter | 1 | 1 | basic_pos, receipts |
| Business | 3 | 2 | + inventory, discounts |
| Enterprise | 10 | 5 | + api_access, advanced_analytics |

Trial licenses use Starter limits, `isTrial: true`, 14 days.

### Intended POS behaviour (from the server's own comments)
- `valid: true` → unlock, cache the response with a local timestamp.
- `valid: false` → show the activation/lock screen.
- Network error → use the cached response with a **72 hour** grace period.
- Call at startup and daily.
- Time: compare `expiresAt` using trusted time, not only the device clock (see v2 note on clock rollback).

## v2: PROPOSED additions (not implemented)

### Signed entitlement
Returned inside `validate` (new field `entitlement`) and by a new `POST /api/licenses/activate` (`{ key, machineId }`).

Format: `MGH2.<base64url(payload JSON)>.<base64url(Ed25519 signature)>`. The signature covers the ASCII bytes of `MGH2.<base64url(payload)>`.

Payload:
```json
{
  "v": 2,
  "kid": "2026-10",
  "lid": "LIC-…",
  "mid": "212XXXXXXXXX",
  "plan": "Business",
  "trial": false,
  "iat": 1790000000,
  "exp": 1805000000,
  "refreshBy": 1790604800,
  "maxRegisters": 3,
  "maxBranches": 2,
  "features": ["basic_pos", "receipts", "inventory", "discounts"],
  "machine": "optional machineId bound at activation"
}
```
- `exp`: end of the paid period (seconds since epoch, UTC). `refreshBy`: latest time the POS may go without a successful online refresh (proposed 7 days after `iat`).
- Duration, coupons and trial modifiers are **resolved by the server into `exp`**. The POS never interprets them.

### POS verification algorithm (proposed)
1. Split on `.`; require prefix `MGH2`; load the public key by `kid` (embedded, or from `GET /api/licenses/public-keys`).
2. Verify the Ed25519 signature. Failure means reject.
3. Reject if `now > exp`. Reject (until a refresh succeeds) if `now > refreshBy + 72h`.
4. Rollback guard: remember the highest trusted time seen; reject if the clock moves back more than 24 h.
5. Apply `plan`, `maxRegisters`, `maxBranches`, `features`.

### New `validate` reasons (additive)
`suspended` (merchant toggled off by an admin, license intact) alongside `revoked`, `expired`, `invalid_key`. Unknown reasons must be treated as invalid.

### Public keys
`GET /api/licenses/public-keys` returns `{ "keys": [{ "kid": "2026-10", "alg": "Ed25519", "publicKey": "<base64url raw 32 bytes>", "notAfter": null }] }`. Several `kid`s can be live during rotation.

## Open points for the POS team to confirm
- Does the POS already call `validate`, and which fields does it read? (We have not looked at POS code by design.)
- Is offline Ed25519 verification available on the POS runtime?
- Preferred refresh window and grace (proposed 7 days + 72 h).
