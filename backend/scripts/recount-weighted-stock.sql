-- Weighted products whose stock must be RECOUNTED BY HAND after migration 052. Read-only.
-- Run: psql "$DATABASE_URL" -f scripts/recount-weighted-stock.sql   (or paste into any SQL client)
--
-- Why recount: stock_quantity was an INTEGER and, for fractional (weighted) sales, either rounded on
-- assignment or, before commit 77383f2, not deducted at all. Weighted stock history is unreliable and no
-- corrected value can be derived from the database. Do not invent values: count the shelf in kilograms.
--
-- A product needs a recount when it is weighted AND (stock is tracked OR it holds a non-zero quantity).
-- Rows with track_stock = false and stock 0 never carried stock and need nothing.
SELECT
  t.slug                         AS tenant,
  p.product_id,
  p.name_fr,
  p.uom,
  p.track_stock,
  p.stock_quantity               AS recorded_quantity,
  p.low_stock_threshold,
  p.is_active,
  (SELECT count(*) FROM transactions x WHERE x.tenant_id = p.tenant_id
     AND x.items @> jsonb_build_array(jsonb_build_object('productId', p.product_id::text)))  AS sales_containing_product,
  (SELECT max(x.sold_at) FROM transactions x WHERE x.tenant_id = p.tenant_id
     AND x.items @> jsonb_build_array(jsonb_build_object('productId', p.product_id::text)))  AS last_sold_at,
  CASE
    WHEN p.uom NOT IN ('kg', 'KG', 'Kg') THEN 'check unit: weighted but uom is not kg'
    ELSE ''
  END                            AS note
FROM products p
JOIN tenants t ON t.id = p.tenant_id
WHERE p.is_weighted
  AND (p.track_stock OR p.stock_quantity <> 0)
ORDER BY t.slug, p.name_fr;
