-- Migration 052: products.stock_quantity INTEGER -> NUMERIC(14,3)   *** DRAFT: NOT APPLIED ***
-- Review before applying. Apply with: npx tsx scripts/migrate-052.ts (from backend).
-- Rollback: migrations/rollback/052_rollback.sql. Dry run: npx tsx scripts/dry-run-052.ts (always rolled back).
-- Depends on: 021 (stock_quantity), 050/051 (sale recording, stock_variances)
--
-- Why: stock_quantity is INTEGER, so a fractional deduction is rounded on assignment. Live check on the
-- real request path (2026-11-03): 5000 - 1.2 - 0.4 - 2.5 left 4997 instead of 4995.9, and a 0.4 kg sale
-- decremented nothing. Before 77383f2 the deduction for fractional quantities was skipped silently.
--
-- UNIT (decision): for is_weighted products stock_quantity is in KILOGRAMS, with 3 decimals (1 g precision).
-- That is what the POS sends as the sale quantity, what supplier invoice lines (NUMERIC(12,3)) and the demand
-- forecast use, and it makes the default low_stock_threshold of 5 mean 5 kg. For unit products the value is
-- unchanged (whole units). NO DATA IS CONVERTED OR INVENTED by this migration: existing rows keep their
-- numbers. Existing weighted rows were already inaccurate (rounded, and skipped before 77383f2), so they
-- must be recounted by hand (scripts/recount-weighted-stock.sql lists them).
--
-- After applying, two code changes must ship with it (see the impact audit):
--   1. SELECT/RETURNING of stock_quantity sent to clients must cast to float8 (pg returns NUMERIC as a
--      string, which breaks pos-web `=== 0` checks).
--   2. pos-web must stop dividing weighted stock by 1000 (pos/page.tsx badge and low-stock list), and
--      product-routes.ts must parse the multipart stock_quantity as a decimal, not parseInt.
--
-- Lock: ALTER COLUMN TYPE rewrites the table and its indexes under ACCESS EXCLUSIVE (the POS catalogue
-- cannot be read or written meanwhile). lock_timeout makes the migration give up instead of queueing
-- behind a long query and blocking everything behind it.

SET LOCAL lock_timeout = '5s';

ALTER TABLE products
  ALTER COLUMN stock_quantity TYPE NUMERIC(14,3) USING stock_quantity::numeric;

-- The DEFAULT 0 and NOT NULL set in migration 021 are carried over by ALTER ... TYPE.

COMMENT ON COLUMN products.stock_quantity IS
  'On-hand quantity. Whole units for normal products; KILOGRAMS (3 decimals) for is_weighted products. Not converted by migration 052: recount weighted rows.';
