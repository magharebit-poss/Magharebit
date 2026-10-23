# End-to-end checks

All except the unit check need a dev server on its own cache folder (`NEXT_DIST_DIR=.next-test`, already listed in tsconfig) and real MongoDB in Docker (see `scripts/admin-smoke/README.md` for the container command). Chrome is used headless over CDP, no extra packages.

| Script | What it proves | Last result |
|---|---|---|
| `signup-e2e.mjs` | landing CTA -> phone OTP -> store details -> confirmation -> trial license -> POS `validate` -> admin list (fr + ar) | 26 passed |
| `leads-e2e.mjs` | leads API: search, status rules, **server-side activation** (real MGH key, audit, merchant, POS `validate`), double-activation race | 33 passed |
| `leads-ui-e2e.mjs` | Leads page in the console shell (fr + ar), activation from the drawer, light/dark theme switch and persistence, 375 px layout | 26 passed |

| `license-token-unit.mjs` | Ed25519/JWT module: keys, claims, signing, the reference POS verifier, tamper/alg/kid/expiry/offline-window rules, rotation, and the contract test vector. No server needed. | 28 passed |
| `license-v2-e2e.mjs` | v2 server: jwks, activate, terminal limits (incl. an 8-way race), validate refresh, suspend toggle, extend, revoke, release, audit. Needs a server started with a signing key (see the file header); `NO_KEY=1` mode checks fail-closed behaviour without a key. | 63 passed (+4 fail-closed) |

| `merchants-licenses-ui-e2e.mjs` | Merchants + Licenses pages (fr + ar): filters, literal-regex search, suspend/reactivate switch, approve from drawer, terminal release, extend, revoke, viewer read-only, 375 px, audit entries. Needs a server with a signing key (see license-v2-e2e header) and `MONGODB_DB` set to the server's database. | 65 passed on `next start` (a dev-server run had 2 false timeouts from on-demand compiles) |
| `coupons-notifications-e2e.mjs` | Coupons + Notifications scaffolds: validation, roles, duplicate code, search, toggle, atomic redemption (8 concurrent on a limit of 2), queued notifications, audit. | 37 passed |

**Run E2E against a production build, not `next dev`:** `NEXT_DIST_DIR=.next-test npx next build` (nothing else may touch that folder while it builds), then `npx next start -p 3021` with the same env. The login rate limit is in memory: restart the server if many runs in a row hit `rate_limited`.

Warm the pages first (first compile can take minutes on a slow machine), start a **fresh** database per run.
