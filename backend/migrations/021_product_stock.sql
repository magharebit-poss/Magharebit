-- 021_product_stock.sql
-- Adds simple product-level stock tracking.
-- This is the web-POS stock layer (per-product, in units or grams for
-- weighted items).  The BOM ingredient-level pipeline (migrations 002,
-- backend_stock table, deduction-adjudicator) is separate and is NOT
-- affected by this migration.
--
-- Depends on: 013_remaining_tables (products table must exist)
-- Idempotent: ADD COLUMN IF NOT EXISTS is safe to re-run.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_quantity      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS track_stock         BOOLEAN NOT NULL DEFAULT false;

-- track_stock = false  →  stock is not tracked for this product
--                          (services, unlimited items, etc.).
--                          Only products with track_stock = true show stock
--                          badges and trigger low-stock alerts in the POS.
--
-- stock_quantity       →  current on-hand quantity (units for normal
--                          products, grams for is_weighted products).
--                          Decremented by POST /transactions.
--                          Incremented by POST /returns (disposition=restock).
--                          Never goes below 0 (GREATEST guard in application).
--
-- low_stock_threshold  →  alert threshold per-product.  The POS also reads
--                          NEXT_PUBLIC_LOW_STOCK_THRESHOLD as a global
--                          fallback; effective threshold =
--                          MAX(low_stock_threshold, globalEnvThreshold).
--
-- DEFAULT 0 means all existing products start at zero stock.
-- Merchants must set initial stock levels (stock-take UI is a future task).
