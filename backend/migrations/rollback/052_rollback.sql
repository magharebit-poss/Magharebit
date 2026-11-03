-- Rollback of 052_products_stock_numeric.sql. DRAFT, not applied.
-- PRECISION IS LOST: decimals are rounded back to whole numbers (4995.900 becomes 4996, 0.400 becomes 0).
-- It also fails if any value exceeds the INTEGER range. Take a copy of the exact values first:
--   COPY (SELECT product_id, tenant_id, name_fr, is_weighted, stock_quantity FROM products WHERE stock_quantity <> trunc(stock_quantity)) TO STDOUT CSV HEADER;
-- Do not roll back once weighted stock is being recounted in kg: the recounted values would be rounded.
-- Rewrites the table under ACCESS EXCLUSIVE, like the forward migration.

SET LOCAL lock_timeout = '5s';

ALTER TABLE products
  ALTER COLUMN stock_quantity TYPE INTEGER USING ROUND(stock_quantity)::integer;

COMMENT ON COLUMN products.stock_quantity IS NULL;
