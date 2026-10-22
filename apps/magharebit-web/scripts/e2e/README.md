# End-to-end checks

All three need a dev server on its own cache folder (`NEXT_DIST_DIR=.next-test`, already listed in tsconfig) and real MongoDB in Docker (see `scripts/admin-smoke/README.md` for the container command). Chrome is used headless over CDP, no extra packages.

| Script | What it proves | Last result |
|---|---|---|
| `signup-e2e.mjs` | landing CTA -> phone OTP -> store details -> confirmation -> trial license -> POS `validate` -> admin list (fr + ar) | 26 passed |
| `leads-e2e.mjs` | leads API: search, status rules, **server-side activation** (real MGH key, audit, merchant, POS `validate`), double-activation race | 33 passed |
| `leads-ui-e2e.mjs` | Leads page in the console shell (fr + ar), activation from the drawer, light/dark theme switch and persistence, 375 px layout | 26 passed |

Warm the pages first (first compile can take minutes on a slow machine), start a **fresh** database per run.
